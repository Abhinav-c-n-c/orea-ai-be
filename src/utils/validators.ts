import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: z.string().email('Invalid email format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const updatePermissionsSchema = z.object({
  body: z.object({
    permissions: z.object({
      canViewDashboard: z.boolean().optional(),
      canManageUsers: z.boolean().optional(),
      canManagePermissions: z.boolean().optional(),
      canCreateTask: z.boolean().optional(),
      canEditTask: z.boolean().optional(),
      canDeleteTask: z.boolean().optional(),
      canAssignTask: z.boolean().optional(),
      canCreateNotes: z.boolean().optional(),
      canEditNotes: z.boolean().optional(),
      canDeleteNotes: z.boolean().optional(),
      canAccessChat: z.boolean().optional(),
    }),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createTaskSchema = z.object({
  body: z.object({
    boardId: z.string().min(1, 'Board ID is required'),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().optional(),
    status: z.enum(['to_discuss', 'todo', 'in_progress', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assignees: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    dueDate: z.string().optional(),
  }),
});

export const createNoteSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});
