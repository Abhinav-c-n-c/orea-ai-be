import { Request, Response, NextFunction } from 'express';
import User, { defaultPermissions } from '../models/User';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { IPermissions, UserRole } from '../models/User';

// Get all users (admin+)
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
      User.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, users, { page, limit, total });
  } catch (error) {
    next(error);
  }
};

// Get single user
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) {
      throw new AppError('User not found', 404);
    }
    ApiResponse.success(res, user);
  } catch (error) {
    next(error);
  }
};

// Update user role
export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role } = req.body;
    const requesterId = (req as AuthRequest).userId;
    const requesterRole = (req as AuthRequest).userRole;
    const targetId = req.params.id;

    if (!requesterId || !requesterRole) {
      throw new AppError('Authentication required', 401);
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    // Role Hierarchy Enforcement
    if (requesterRole === 'admin') {
      // Admins can only modify members
      if (targetUser.role !== 'member') {
        throw new AppError('Admins can only manage members', 403);
      }
      if (role === 'super_admin') {
        throw new AppError('Admins cannot promote to super_admin', 403);
      }
    } else if (requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403);
    }

    // Cannot change own role
    if (targetId === requesterId) {
      throw new AppError('Cannot change your own role', 400);
    }

    targetUser.role = role;
    // Reset permissions to default for the new role
    targetUser.permissions = defaultPermissions[role as UserRole];
    await targetUser.save();

    ApiResponse.success(res, targetUser, 'Role updated successfully');
  } catch (error) {
    next(error);
  }
};

// Update user permissions
export const updateUserPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { permissions } = req.body as { permissions: Partial<IPermissions> };
    const requesterId = (req as AuthRequest).userId;
    const requesterRole = (req as AuthRequest).userRole;
    const targetId = req.params.id;

    if (!requesterId || !requesterRole) {
      throw new AppError('Authentication required', 401);
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    // Role Hierarchy Enforcement
    if (requesterRole === 'admin') {
      if (targetUser.role !== 'member') {
        throw new AppError('Admins can only manage permissions for members', 403);
      }
    } else if (requesterRole !== 'super_admin') {
      throw new AppError('Insufficient permissions', 403);
    }

    // Merge permissions
    Object.assign(targetUser.permissions, permissions);
    await targetUser.save();

    ApiResponse.success(res, targetUser, 'Permissions updated successfully');
  } catch (error) {
    next(error);
  }
};

// Delete user (soft delete)
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const requesterId = (req as AuthRequest).userId;
    if (req.params.id === requesterId) {
      throw new AppError('Cannot delete your own account', 400);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).lean();

    if (!user) {
      throw new AppError('User not found', 404);
    }

    ApiResponse.success(res, null, 'User deactivated successfully');
  } catch (error) {
    next(error);
  }
};

// Update own profile
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId;
    const { name, avatar, currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Handle Password Update
    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password is required to set a new password', 400);
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw new AppError('Incorrect current password', 400);
      }
      user.password = newPassword;
    }

    // Handle Profile Info Update
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    await user.save();

    // Remove password from response
    const userObj = user.toObject();
    delete (userObj as any).password;

    ApiResponse.success(res, userObj, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// Get all users for chat (restricted fields)
export const getChatUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId;
    const users = await User.find({
      isActive: true,
      _id: { $ne: userId },
    })
      .select('name email avatar')
      .sort({ name: 1 })
      .lean();

    ApiResponse.success(res, users);
  } catch (error) {
    next(error);
  }
};
