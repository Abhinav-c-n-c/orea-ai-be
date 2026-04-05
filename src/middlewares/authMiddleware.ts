import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import { AppError } from '../utils/AppError';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    // Check cookie first, then Authorization header
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    const decoded = verifyAccessToken(token);
    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).userEmail = decoded.email;
    (req as AuthRequest).userRole = decoded.role;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired token', 401));
    }
  }
};
