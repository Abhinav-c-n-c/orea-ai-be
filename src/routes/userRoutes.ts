import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserPermissions,
  deleteUser,
  updateProfile,
  getChatUsers,
} from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { permissionMiddleware } from '../middlewares/permissionMiddleware';
import { validate } from '../middlewares/validate';
import { updatePermissionsSchema } from '../utils/validators';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// User profile
router.patch('/profile', updateProfile);

// Chat users list (at the top to avoid /:id collision)
router.get('/chat', permissionMiddleware('canAccessChat'), getChatUsers);

// Admin routes
router.get('/', permissionMiddleware('canManageUsers'), getAllUsers);
router.get('/:id', permissionMiddleware('canManageUsers'), getUserById);
router.patch('/:id/role', roleMiddleware('super_admin', 'admin'), updateUserRole);
router.patch(
  '/:id/permissions',
  permissionMiddleware('canManagePermissions'),
  validate(updatePermissionsSchema),
  updateUserPermissions
);
router.delete('/:id', roleMiddleware('super_admin', 'admin'), deleteUser);

export default router;
