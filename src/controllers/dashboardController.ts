import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Task from '../models/Task';
import Note from '../models/Note';
import Message from '../models/Message';
import ActivityLog from '../models/ActivityLog';
import { ApiResponse } from '../utils/ApiResponse';

export const getDashboardStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      tasksByStatus,
      tasksByPriority,
      totalNotes,
      totalMessages,
      recentActivity,
      usersByRole,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Note.countDocuments(),
      Message.countDocuments(),
      ActivityLog.find()
        .populate('userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ]);

    // Format task stats
    const taskStats = {
      total: 0,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    };

    tasksByStatus.forEach((s) => {
      taskStats.byStatus[s._id] = s.count;
      taskStats.total += s.count;
    });

    tasksByPriority.forEach((p) => {
      taskStats.byPriority[p._id] = p.count;
    });

    const roleStats: Record<string, number> = {};
    usersByRole.forEach((r) => {
      roleStats[r._id] = r.count;
    });

    ApiResponse.success(res, {
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: roleStats,
      },
      tasks: taskStats,
      notes: { total: totalNotes },
      messages: { total: totalMessages },
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};
