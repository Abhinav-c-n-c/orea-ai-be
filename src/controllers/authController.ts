import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  hashResetToken,
} from '../services/authService';

// Register
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const user = await User.create({ name, email, password, role: 'member' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    // Set httpOnly cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    ApiResponse.created(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
        accessToken,
      },
      'Registration successful'
    );
  } catch (error) {
    next(error);
  }
};

// Login
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log(`Login attempt for: ${email}`);

    const user = await User.findOne({ email, isActive: true }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    ApiResponse.success(
      res,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          avatar: user.avatar,
        },
        accessToken,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

// Refresh Token
export const refreshTokenHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) {
      throw new AppError('Refresh token required', 401);
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      throw new AppError('Invalid refresh token', 401);
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    ApiResponse.success(res, { accessToken }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as unknown as Record<string, unknown>).userId as string;
    await User.findByIdAndUpdate(userId, { refreshToken: null });

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// Get current user
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as unknown as Record<string, unknown>).userId as string;
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError('User not found', 404);
    }

    ApiResponse.success(res, { user });
  } catch (error) {
    next(error);
  }
};

// Forgot Password
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      ApiResponse.success(res, null, 'If the email exists, a reset link has been sent');
      return;
    }

    const { hashedToken, expiry } = generateResetToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiry = expiry;
    await user.save();

    // In production, this would send an email
    // For now, we log the token
    console.log(`Password reset token for ${email}: ${hashedToken}`);

    ApiResponse.success(res, null, 'If the email exists, a reset link has been sent');
  } catch (error) {
    next(error);
  }
};

// Reset Password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body;
    const hashedToken = hashResetToken(token);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpiry');

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    ApiResponse.success(res, null, 'Password reset successful');
  } catch (error) {
    next(error);
  }
};
