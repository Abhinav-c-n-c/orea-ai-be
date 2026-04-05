import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import Message, { getConversationId } from '../models/Message';
import { GameRoom } from '../models/GameRoom';
import { TokenPayload } from '../services/authService';

interface OnlineUser {
  userId: string;
  socketId: string;
  email: string;
}

const onlineUsers = new Map<string, OnlineUser>();

let io: Server;

export const getIO = (): Server => io;

export const setupSocketServer = (server: HttpServer): void => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3800', 'http://localhost:3001'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT Auth middleware for sockets
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      (socket as Socket & { userId: string; userEmail: string }).userId = decoded.userId;
      (socket as Socket & { userId: string; userEmail: string }).userEmail = decoded.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as Socket & { userId: string }).userId;
    const userEmail = (socket as Socket & { userEmail: string }).userEmail;

    console.log(`🔌 User connected: ${userId}`);

    // Add to online users
    onlineUsers.set(userId, { userId, socketId: socket.id, email: userEmail });

    // Broadcast online status
    io.emit('user:online', {
      userId,
      onlineUsers: Array.from(onlineUsers.values()).map((u) => ({
        userId: u.userId,
        email: u.email,
      })),
    });

    // Handle send message
    socket.on(
      'message:send',
      async (data: { receiverId: string; content: string; messageType?: string; mediaUrl?: string; encrypted?: boolean }) => {
        try {
          const conversationId = getConversationId(userId, data.receiverId);

          const message = await Message.create({
            sender: userId,
            receiver: data.receiverId,
            conversationId,
            content: data.content,
            messageType: data.messageType || 'text',
            mediaUrl: data.mediaUrl,
            encrypted: data.encrypted || false,
          });

          const populated = await Message.findById(message._id)
            .populate('sender', 'name email avatar')
            .populate('receiver', 'name email avatar')
            .lean();

          // Send to receiver if online
          const receiverSocket = onlineUsers.get(data.receiverId);
          if (receiverSocket) {
            io.to(receiverSocket.socketId).emit('message:received', populated);

            // Auto-mark as delivered
            await Message.findByIdAndUpdate(message._id, {
              delivered: true,
              deliveredAt: new Date(),
            });

            io.to(receiverSocket.socketId).emit('message:delivered', {
              messageId: message._id,
              conversationId,
            });
          }

          // Confirm to sender
          socket.emit('message:sent', populated);
        } catch {
          socket.emit('message:error', { error: 'Failed to send message' });
        }
      }
    );

    // Handle message read
    socket.on('message:read', async (data: { messageId: string; senderId: string }) => {
      try {
        await Message.findByIdAndUpdate(data.messageId, {
          read: true,
          readAt: new Date(),
        });

        const senderSocket = onlineUsers.get(data.senderId);
        if (senderSocket) {
          io.to(senderSocket.socketId).emit('message:read:ack', {
            messageId: data.messageId,
          });
        }
      } catch (error) {
        console.error('Read receipt error:', error);
      }
    });

    // Mark all messages in conversation as read
    socket.on('messages:read:all', async (data: { conversationId: string; senderId: string }) => {
      try {
        await Message.updateMany(
          {
            conversationId: data.conversationId,
            sender: data.senderId,
            receiver: userId,
            read: false,
          },
          { read: true, readAt: new Date() }
        );

        const senderSocket = onlineUsers.get(data.senderId);
        if (senderSocket) {
          io.to(senderSocket.socketId).emit('messages:read:all:ack', {
            conversationId: data.conversationId,
            readBy: userId,
          });
        }
      } catch (error) {
        console.error('Read all error:', error);
      }
    });

    // Handle typing
    socket.on('typing:start', (data: { receiverId: string }) => {
      const receiverSocket = onlineUsers.get(data.receiverId);
      if (receiverSocket) {
        io.to(receiverSocket.socketId).emit('typing:start', { userId });
      }
    });

    socket.on('typing:stop', (data: { receiverId: string }) => {
      const receiverSocket = onlineUsers.get(data.receiverId);
      if (receiverSocket) {
        io.to(receiverSocket.socketId).emit('typing:stop', { userId });
      }
    });

    // === GAME SOCKETS ===
    socket.on('game:join', async (data: { roomId: string }) => {
      const { roomId } = data;
      socket.join(`game:${roomId}`);
      
      const room = await GameRoom.findOne({ roomId }).populate('players.user', 'name email avatar').populate('winner', 'name').populate('currentTurn', 'name');
      if (room) {
        io.to(`game:${roomId}`).emit('game:update', room);
      }
    });

    socket.on('game:move', async (data: { roomId: string; state: Record<string, unknown>; currentTurn: string | null; winner?: string | null; status?: string }) => {
      const { roomId, state, currentTurn, winner, status } = data;
      
      try {
        const updateData: any = { state };
        if (currentTurn !== undefined) updateData.currentTurn = currentTurn;
        if (winner !== undefined) updateData.winner = winner;
        if (status !== undefined) updateData.status = status;

        const updatedRoom = await GameRoom.findOneAndUpdate(
          { roomId },
          updateData,
          { new: true }
        ).populate('players.user', 'name email avatar').populate('winner', 'name').populate('currentTurn', 'name');

        if (updatedRoom) {
          io.to(`game:${roomId}`).emit('game:update', updatedRoom);
        }
      } catch (err) {
        console.error('Game move error:', err);
      }
    });

    socket.on('game:leave', (data: { roomId: string }) => {
      socket.leave(`game:${data.roomId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${userId}`);
      onlineUsers.delete(userId);

      io.emit('user:offline', {
        userId,
        onlineUsers: Array.from(onlineUsers.values()).map((u) => ({
          userId: u.userId,
          email: u.email,
        })),
      });
    });
  });
};
