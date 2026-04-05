import { Request, Response, NextFunction } from 'express';
import Task from '../models/Task';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

// Create task
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { title, description, status, priority, assignees, tags, dueDate, boardId, images } = req.body;

    if (!boardId) {
      throw new AppError('Board ID is required', 400);
    }

    const task = await Task.create({
      boardId,
      title,
      description,
      status: status || 'to_discuss',
      priority: priority || 'medium',
      assignees: assignees || [],
      createdBy: userId,
      tags: tags || [],
      images: images || [],
      dueDate,
    });

    await ActivityLog.create({
      taskId: task._id,
      userId,
      action: 'created',
      details: `Task "${title}" was created`,
    });

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .lean();

    ApiResponse.created(res, populated, 'Task created successfully');
  } catch (error) {
    next(error);
  }
};

// Get all tasks with filtering, sorting, and pagination
export const getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const assignee = req.query.assignee as string;
    const search = req.query.search as string;
    const tag = req.query.tag as string;
    const boardId = req.query.boardId as string;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (boardId) filter.boardId = boardId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignees = assignee;
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assignees', 'name email avatar')
        .populate('createdBy', 'name email avatar')
        .populate('comments.user', 'name email avatar')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Task.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, tasks, { page, limit, total });
  } catch (error) {
    next(error);
  }
};

// Get single task
export const getTaskById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignees', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('comments.user', 'name email avatar')
      .lean();

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Get activity log
    const activities = await ActivityLog.find({ taskId: task._id })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    ApiResponse.success(res, { ...task, activities });
  } catch (error) {
    next(error);
  }
};

// Update task
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const task = await Task.findById(req.params.id);

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const updates = req.body;
    const changes: string[] = [];

    // Track status change
    if (updates.status && updates.status !== task.status) {
      await ActivityLog.create({
        taskId: task._id,
        userId,
        action: 'status_changed',
        details: `Status changed from "${task.status}" to "${updates.status}"`,
        previousValue: task.status,
        newValue: updates.status,
      });
      changes.push(`status: ${task.status} → ${updates.status}`);
    }

    // Track priority change
    if (updates.priority && updates.priority !== task.priority) {
      await ActivityLog.create({
        taskId: task._id,
        userId,
        action: 'priority_changed',
        details: `Priority changed from "${task.priority}" to "${updates.priority}"`,
        previousValue: task.priority,
        newValue: updates.priority,
      });
    }

    Object.assign(task, updates);
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .lean();

    ApiResponse.success(res, populated, 'Task updated successfully');
  } catch (error) {
    next(error);
  }
};

// Delete task
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    await ActivityLog.create({
      taskId: task._id,
      userId,
      action: 'deleted',
      details: `Task "${task.title}" was deleted`,
    });

    ApiResponse.success(res, null, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Assign users to task
export const assignTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { assignees } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    task.assignees = assignees;
    await task.save();

    await ActivityLog.create({
      taskId: task._id,
      userId,
      action: 'assigned',
      details: 'Task assignees updated',
    });

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .lean();

    ApiResponse.success(res, populated, 'Task assigned successfully');
  } catch (error) {
    next(error);
  }
};

// Add comment
export const addComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { text, mentions } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    task.comments.push({
      user: userId as unknown as import('mongoose').Types.ObjectId,
      text,
      mentions: mentions || [],
      createdAt: new Date(),
    });
    await task.save();

    await ActivityLog.create({
      taskId: task._id,
      userId,
      action: 'commented',
      details: `Added a comment`,
    });

    const populated = await Task.findById(task._id)
      .populate('assignees', 'name email avatar')
      .populate('comments.user', 'name email avatar')
      .lean();

    ApiResponse.success(res, populated, 'Comment added successfully');
  } catch (error) {
    next(error);
  }
};

// Get task activity log
export const getTaskActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const activities = await ActivityLog.find({ taskId: req.params.id })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    ApiResponse.success(res, activities);
  } catch (error) {
    next(error);
  }
};
