import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    ApiResponse.error(res, err.message, err.statusCode, err.stack);
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    ApiResponse.error(res, 'Validation Error', 400, err.message);
    return;
  }

  // Mongoose duplicate key error
  if ((err as unknown as Record<string, unknown>).code === 11000) {
    ApiResponse.error(res, 'Duplicate entry found', 409, err.message);
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    ApiResponse.error(res, 'Invalid token', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    ApiResponse.error(res, 'Token expired', 401);
    return;
  }

  // Default error
  console.error('Unhandled Error:', err);
  ApiResponse.error(
    res,
    'Internal Server Error',
    500,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
};
