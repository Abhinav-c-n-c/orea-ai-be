import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Message, { getConversationId } from '../models/Message';
import User from '../models/User';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ApiResponse } from '../utils/ApiResponse';
import { getIO } from '../sockets/socketHandler';

// Send a message via HTTP (reliable fallback when socket is unavailable)
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const senderId = (req as AuthRequest).userId!;
    const { receiverId, content, messageType = 'text', mediaUrl, encrypted = false } = req.body;

    if (!receiverId || !content) {
      res.status(400).json({ success: false, message: 'receiverId and content are required' });
      return;
    }

    const conversationId = getConversationId(senderId, receiverId);

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      conversationId,
      content,
      messageType,
      mediaUrl,
      encrypted,
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name email avatar')
      .populate('receiver', 'name email avatar')
      .lean();

    // Try to notify via socket if available (best-effort, won't fail if not connected)
    try {
      const io = getIO();
      if (io) {
        io.to(receiverId).emit('message:received', populated);
        io.to(senderId).emit('message:sent', populated);
      }
    } catch {
      // Socket not available - that's fine, message is saved to DB
    }

    ApiResponse.created(res, populated);
  } catch (error) {
    next(error);
  }
};


// Get conversations list
export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get all unique conversations for this user
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userObjectId }, { receiver: userObjectId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ['$receiver', userObjectId] }, { $eq: ['$read', false] }],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    // Get other user details for each conversation
    const conversations = await Promise.all(
      messages.map(async (msg) => {
        const otherUserId =
          msg.lastMessage.sender.toString() === userId
            ? msg.lastMessage.receiver
            : msg.lastMessage.sender;

        const otherUser = await User.findById(otherUserId).select('name email avatar').lean();

        return {
          conversationId: msg._id,
          otherUser,
          lastMessage: {
            content: msg.lastMessage.content,
            createdAt: msg.lastMessage.createdAt,
            sender: msg.lastMessage.sender,
            read: msg.lastMessage.read,
          },
          unreadCount: msg.unreadCount,
        };
      })
    );

    ApiResponse.success(res, conversations);
  } catch (error) {
    next(error);
  }
};

// Get messages for a conversation
export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { receiverId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const conversationId = getConversationId(userId, receiverId as string);

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .populate('sender', 'name email avatar')
        .populate('receiver', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversationId }),
    ]);

    // Mark unread messages as read
    await Message.updateMany(
      { conversationId, receiver: userId, read: false },
      { read: true, readAt: new Date() }
    );

    ApiResponse.paginated(res, messages.reverse(), { page, limit, total });
  } catch (error) {
    next(error);
  }
};

// Get unread count
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;

    const count = await Message.countDocuments({
      receiver: userId,
      read: false,
    });

    ApiResponse.success(res, { unreadCount: count });
  } catch (error) {
    next(error);
  }
};
