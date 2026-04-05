import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { AppError } from '../utils/AppError';
import User, { IPermissions } from '../models/User';

export const permissionMiddleware = (...requiredPermissions: (keyof IPermissions)[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthRequest).userId;

      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const user = await User.findById(userId).lean();
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const hasAllPermissions = requiredPermissions.every(
        (permission) => user.permissions[permission] === true
      );

      if (!hasAllPermissions) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
