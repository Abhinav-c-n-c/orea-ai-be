import { Request, Response, NextFunction } from 'express';
import Board from '../models/Board';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

// Create board
export const createBoard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { name } = req.body;

    const board = await Board.create({
      name,
      createdBy: userId,
    });

    ApiResponse.created(res, board, 'Board created successfully');
  } catch (error) {
    next(error);
  }
};

// Get all boards
export const getBoards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const boards = await Board.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();

    ApiResponse.success(res, boards);
  } catch (error) {
    next(error);
  }
};

// Delete board (optional but good to have)
export const deleteBoard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId!;
    const board = await Board.findOneAndDelete({ _id: req.params.id, createdBy: userId });

    if (!board) {
      throw new AppError('Board not found or unauthorized', 404);
    }

    ApiResponse.success(res, null, 'Board deleted successfully');
  } catch (error) {
    next(error);
  }
};
