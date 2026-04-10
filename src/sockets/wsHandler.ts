import { Server as HttpServer, IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import Message, { getConversationId } from '../models/Message';
import { GameRoom } from '../models/GameRoom';
import { TokenPayload } from '../services/authService';
import {
  addOnlineUser,
  removeOnlineUser,
  getOnlineUserIds,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
} from './redis';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  userEmail?: string;
  isAlive?: boolean;
  joinedRooms?: Set<string>;
}

interface WsMessage {
  type: string;
  data?: Record<string, unknown>;
}

// ── In-process connection map ─────────────────────────────────────────────────
// Single-server map of userId → Set of sockets (supports multiple tabs/browsers)
const connections = new Map<string, Set<AuthenticatedSocket>>();

export const getUserConnections = (userId: string): Set<AuthenticatedSocket> | undefined =>
  connections.get(userId);

// ── Helper: send JSON to a socket ─────────────────────────────────────────────
const send = (ws: WebSocket, type: string, data?: unknown): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
};

// ── Helper: send to a specific user ──────────────────────────────────────────
export const sendToUser = (userId: string, type: string, data?: unknown): void => {
  const userSockets = connections.get(userId);
  if (userSockets) {
    for (const ws of userSockets) {
      send(ws, type, data);
    }
  }
};

// ── Helper: broadcast to room ─────────────────────────────────────────────────
const broadcastToRoom = async (roomId: string, type: string, data: unknown, excludeUserId?: string): Promise<void> => {
  const members = await getRoomUsers(roomId);
  for (const uid of members) {
    if (uid !== excludeUserId) {
      sendToUser(uid, type, data);
    }
  }
};

// ── Setup ─────────────────────────────────────────────────────────────────────

export const setupWsServer = (server: HttpServer): WebSocketServer => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // ── Heartbeat: ping all clients every 25s, drop dead ones ─────────────────
  const heartbeatInterval = setInterval(() => {
    for (const [userId, userSockets] of connections.entries()) {
      for (const ws of userSockets) {
        if (!ws.isAlive) {
          userSockets.delete(ws);
          ws.terminate();
          if (userSockets.size === 0) {
            connections.delete(userId);
          }
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 25000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  wss.on('connection', (ws: AuthenticatedSocket, _req: IncomingMessage) => {
    ws.isAlive = true;
    ws.joinedRooms = new Set();

    // Pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // ── Auth timeout: must authenticate within 10s ────────────────────────
    let authTimeout: NodeJS.Timeout | null = setTimeout(() => {
      if (!ws.userId) {
        send(ws, 'auth:error', { message: 'Authentication timeout' });
        ws.terminate();
      }
    }, 10000);

    ws.on('message', async (raw) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(ws, 'error', { message: 'Invalid JSON' });
        return;
      }

      const { type, data = {} } = msg;

      // ── AUTH ─────────────────────────────────────────────────────────────
      if (type === 'auth') {
        try {
          const token = data.token as string;
          const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
          ws.userId = decoded.userId;
          ws.userEmail = decoded.email;

          if (authTimeout) { clearTimeout(authTimeout); authTimeout = null; }

          let userSockets = connections.get(decoded.userId);
          if (!userSockets) {
            userSockets = new Set();
            connections.set(decoded.userId, userSockets);
          }
          userSockets.add(ws);

          // Update Redis presence
          await addOnlineUser(decoded.userId);
          const onlineIds = await getOnlineUserIds();

          send(ws, 'auth:success', { userId: decoded.userId });

          // Broadcast online status to all connected users
          const onlinePayload = { userId: decoded.userId, onlineUsers: onlineIds.map(id => ({ userId: id })) };
          for (const [, socks] of connections) {
            for (const sock of socks) send(sock, 'user:online', onlinePayload);
          }
        } catch (err) {
          console.error('Auth or Redis error:', err);
          send(ws, 'auth:error', { message: 'Invalid token or server setup error' });
          setTimeout(() => ws.terminate(), 200); // Give time for the message to flush
        }
        return;
      }

      // Guard: reject unauthenticated messages
      if (!ws.userId) {
        send(ws, 'error', { message: 'Not authenticated' });
        return;
      }

      const userId = ws.userId;

      // ── PING / PONG ───────────────────────────────────────────────────────
      if (type === 'ping') {
        send(ws, 'pong');
        return;
      }

      // ── CHAT: send message ────────────────────────────────────────────────
      if (type === 'message:send') {
        try {
          const { receiverId, content, messageType = 'text', mediaUrl, encrypted = false } = data as {
            receiverId: string; content: string; messageType?: string; mediaUrl?: string; encrypted?: boolean;
          };

          const conversationId = getConversationId(userId, receiverId);
          const message = await Message.create({
            sender: userId, receiver: receiverId, conversationId,
            content, messageType, mediaUrl, encrypted,
          });

          const populated = await Message.findById(message._id)
            .populate('sender', 'name email avatar')
            .populate('receiver', 'name email avatar')
            .lean();

          // Confirm to sender (notify all sender's tabs)
          sendToUser(userId, 'message:sent', populated);

          // Deliver to receiver (notify all receiver's tabs)
          const receiverSockets = connections.get(receiverId);
          if (receiverSockets && receiverSockets.size > 0) {
            sendToUser(receiverId, 'message:received', populated);
            // Auto mark delivered
            await Message.findByIdAndUpdate(message._id, { delivered: true, deliveredAt: new Date() });
            sendToUser(userId, 'message:delivered', { messageId: message._id, conversationId });
          }
        } catch (err) {
          send(ws, 'message:error', { error: 'Failed to send message' });
        }
        return;
      }

      // ── CHAT: mark single message read ───────────────────────────────────
      if (type === 'message:read') {
        try {
          const { messageId, senderId } = data as { messageId: string; senderId: string };
          await Message.findByIdAndUpdate(messageId, { read: true, readAt: new Date() });
          sendToUser(senderId, 'message:read:ack', { messageId });
        } catch { /* ignore */ }
        return;
      }

      // ── CHAT: mark all in conversation read ──────────────────────────────
      if (type === 'messages:read:all') {
        try {
          const { conversationId, senderId } = data as { conversationId: string; senderId: string };
          await Message.updateMany(
            { conversationId, sender: senderId, receiver: userId, read: false },
            { read: true, readAt: new Date() }
          );
          sendToUser(senderId, 'messages:read:all:ack', { conversationId, readBy: userId });
        } catch { /* ignore */ }
        return;
      }

      // ── CHAT: typing indicators ──────────────────────────────────────────
      if (type === 'typing:start') {
        sendToUser((data as { receiverId: string }).receiverId, 'typing:start', { userId });
        return;
      }
      if (type === 'typing:stop') {
        sendToUser((data as { receiverId: string }).receiverId, 'typing:stop', { userId });
        return;
      }

      // ── GAME: join room ──────────────────────────────────────────────────
      if (type === 'game:join') {
        try {
          const { roomId } = data as { roomId: string };
          ws.joinedRooms!.add(roomId);
          await addUserToRoom(roomId, userId);

          const room = await GameRoom.findOne({ roomId })
            .populate('players.user', 'name email avatar')
            .populate('winner', 'name')
            .populate('currentTurn', 'name');
          if (room) send(ws, 'game:update', room);
        } catch { /* ignore */ }
        return;
      }

      // ── GAME: move ───────────────────────────────────────────────────────
      if (type === 'game:move') {
        try {
          const { roomId, state, currentTurn, winner, status } = data as {
            roomId: string; state: Record<string, unknown>; currentTurn?: string | null;
            winner?: string | null; status?: string;
          };

          const update: Record<string, unknown> = { state };
          if (currentTurn !== undefined) update.currentTurn = currentTurn;
          if (winner !== undefined) update.winner = winner;
          if (status !== undefined) update.status = status;

          const updatedRoom = await GameRoom.findOneAndUpdate({ roomId }, update, { new: true })
            .populate('players.user', 'name email avatar')
            .populate('winner', 'name')
            .populate('currentTurn', 'name');

          if (updatedRoom) {
            // Broadcast to everyone in this room
            const members = await getRoomUsers(roomId);
            for (const uid of members) {
              sendToUser(uid, 'game:update', updatedRoom);
            }
          }
        } catch { /* ignore */ }
        return;
      }

      // ── GAME: leave room ─────────────────────────────────────────────────
      if (type === 'game:leave') {
        const { roomId } = data as { roomId: string };
        ws.joinedRooms!.delete(roomId);
        await removeUserFromRoom(roomId, userId);
        return;
      }

      // ── WEBRTC SIGNALING ─────────────────────────────────────────────────
      if (type === 'webrtc:offer') {
        const { targetId, offer } = data as { targetId: string; offer: unknown };
        sendToUser(targetId, 'webrtc:offer', { from: userId, offer });
        return;
      }
      if (type === 'webrtc:answer') {
        const { targetId, answer } = data as { targetId: string; answer: unknown };
        sendToUser(targetId, 'webrtc:answer', { from: userId, answer });
        return;
      }
      if (type === 'webrtc:ice-candidate') {
        const { targetId, candidate } = data as { targetId: string; candidate: unknown };
        sendToUser(targetId, 'webrtc:ice-candidate', { from: userId, candidate });
        return;
      }
      if (type === 'webrtc:end') {
        const { targetId } = data as { targetId: string };
        sendToUser(targetId, 'webrtc:end', { from: userId });
        return;
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    ws.on('close', async () => {
      try {
        if (!ws.userId) return;
        const userId = ws.userId;

        const userSockets = connections.get(userId);
        if (userSockets) {
          userSockets.delete(ws);
          
          if (userSockets.size === 0) {
            connections.delete(userId);
            await removeOnlineUser(userId);

            const onlineIds = await getOnlineUserIds();
            const offlinePayload = { userId, onlineUsers: onlineIds.map(id => ({ userId: id })) };
            for (const [, socks] of connections) {
              for (const sock of socks) send(sock, 'user:offline', offlinePayload);
            }
          }
        }

        // Leave all game rooms
        if (ws.joinedRooms) {
          for (const roomId of ws.joinedRooms) {
            await removeUserFromRoom(roomId, userId);
          }
        }
      } catch (err) {
        console.error('Error during WS close cleanup:', err);
      }
    });

    ws.on('error', (err) => {
      console.error('WS error:', err.message);
    });
  });

  console.log('🔌 WebSocket server started on /ws');
  return wss;
};
