import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IPermissions {
  canViewDashboard: boolean;
  canManageUsers: boolean;
  canManagePermissions: boolean;
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  canAssignTask: boolean;
  canCreateNotes: boolean;
  canEditNotes: boolean;
  canDeleteNotes: boolean;
  canAccessChat: boolean;
}

export type UserRole = 'super_admin' | 'admin' | 'member';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: IPermissions;
  avatar?: string;
  refreshToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const defaultPermissions: Record<UserRole, IPermissions> = {
  super_admin: {
    canViewDashboard: true,
    canManageUsers: true,
    canManagePermissions: true,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canCreateNotes: true,
    canEditNotes: true,
    canDeleteNotes: true,
    canAccessChat: true,
  },
  admin: {
    canViewDashboard: true,
    canManageUsers: true,
    canManagePermissions: false,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: true,
    canAssignTask: true,
    canCreateNotes: true,
    canEditNotes: true,
    canDeleteNotes: true,
    canAccessChat: true,
  },
  member: {
    canViewDashboard: false,
    canManageUsers: false,
    canManagePermissions: false,
    canCreateTask: true,
    canEditTask: true,
    canDeleteTask: false,
    canAssignTask: false,
    canCreateNotes: true,
    canEditNotes: true,
    canDeleteNotes: false,
    canAccessChat: true,
  },
};

const permissionsSchema = new Schema<IPermissions>(
  {
    canViewDashboard: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canManagePermissions: { type: Boolean, default: false },
    canCreateTask: { type: Boolean, default: true },
    canEditTask: { type: Boolean, default: true },
    canDeleteTask: { type: Boolean, default: false },
    canAssignTask: { type: Boolean, default: false },
    canCreateNotes: { type: Boolean, default: true },
    canEditNotes: { type: Boolean, default: true },
    canDeleteNotes: { type: Boolean, default: false },
    canAccessChat: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'member'],
      default: 'member',
    },
    permissions: {
      type: permissionsSchema,
      default: () => defaultPermissions.member,
    },
    avatar: { type: String },
    refreshToken: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiry: { type: Date, select: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ role: 1 });

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  // Auto-set permissions based on role if new user
  if (this.isNew && !this.permissions) {
    this.permissions = defaultPermissions[this.role];
  }
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export { defaultPermissions };
export default mongoose.model<IUser>('User', userSchema);
