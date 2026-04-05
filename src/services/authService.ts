import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { IUser } from '../models/User';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (user: IUser): string => {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (user: IUser): string => {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
};

export const generateResetToken = (): { token: string; hashedToken: string; expiry: Date } => {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  return { token, hashedToken, expiry };
};

export const hashResetToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
