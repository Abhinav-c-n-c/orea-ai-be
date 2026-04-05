import { Request, Response, NextFunction } from 'express';
import Note from '../models/Note';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

// Create note
export const createNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { title, content, tags, visibility, mentions, linkedTasks } = req.body;

    const note = await Note.create({
      title,
      content: content || '',
      tags: tags || [],
      author: userId,
      visibility: visibility || 'public',
      mentions: mentions || [],
      linkedTasks: linkedTasks || [],
    });

    const populated = await Note.findById(note._id).populate('author', 'name email avatar').lean();

    ApiResponse.created(res, populated, 'Note created successfully');
  } catch (error) {
    next(error);
  }
};

// Get all notes (with permission-based visibility)
export const getNotes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const tag = req.query.tag as string;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      $or: [{ visibility: 'public' }, { author: userId }],
    };

    if (tag) filter.tags = tag;
    if (search) {
      filter.$and = [
        { $or: filter.$or as unknown[] },
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } },
          ],
        },
      ];
      delete filter.$or;
    }

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .populate('author', 'name email avatar')
        .select('-editHistory')
        .skip(skip)
        .limit(limit)
        .sort({ updatedAt: -1 })
        .lean(),
      Note.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, notes, { page, limit, total });
  } catch (error) {
    next(error);
  }
};

// Get single note
export const getNoteById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const note = await Note.findById(req.params.id)
      .populate('author', 'name email avatar')
      .populate('editHistory.editedBy', 'name email avatar')
      .populate('lastModifiedBy', 'name email avatar')
      .populate('mentions', 'name email avatar')
      .populate('linkedTasks', 'title status priority')
      .lean();

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    // Check visibility
    if (note.visibility === 'private' && note.author._id.toString() !== userId) {
      throw new AppError('Access denied', 403);
    }

    ApiResponse.success(res, note);
  } catch (error) {
    next(error);
  }
};

// Update note
export const updateNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const note = await Note.findById(req.params.id);

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    // Save current content to edit history before updating
    if (req.body.content && req.body.content !== note.content) {
      note.editHistory.push({
        content: note.content,
        editedBy: userId as unknown as import('mongoose').Types.ObjectId,
        editedAt: new Date(),
      });
    }

    const { title, content, tags, visibility, mentions, linkedTasks } = req.body;
    if (title) note.title = title;
    if (content !== undefined) note.content = content;
    if (tags) note.tags = tags;
    if (visibility) note.visibility = visibility;
    if (mentions) note.mentions = mentions;
    if (linkedTasks) note.linkedTasks = linkedTasks;
    note.lastModifiedBy = userId as unknown as import('mongoose').Types.ObjectId;

    await note.save();

    const populated = await Note.findById(note._id)
      .populate('author', 'name email avatar')
      .populate('lastModifiedBy', 'name email avatar')
      .lean();

    ApiResponse.success(res, populated, 'Note updated successfully');
  } catch (error) {
    next(error);
  }
};

// Delete note
export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) {
      throw new AppError('Note not found', 404);
    }

    ApiResponse.success(res, null, 'Note deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Get note edit history
export const getNoteHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const note = await Note.findById(req.params.id)
      .select('editHistory title')
      .populate('editHistory.editedBy', 'name email avatar')
      .lean();

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    ApiResponse.success(res, note.editHistory);
  } catch (error) {
    next(error);
  }
};
