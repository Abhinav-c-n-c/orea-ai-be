import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { AppError } from '../utils/AppError';
import { UserRole } from '../models/User';

export const roleMiddleware = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = (req as AuthRequest).userRole as UserRole;

    if (!userRole) {
      throw new AppError('Role information missing', 403);
    }

    if (!allowedRoles.includes(userRole)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    next();
  };
};
