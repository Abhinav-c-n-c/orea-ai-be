import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  assignTask,
  addComment,
  getTaskActivity,
} from '../controllers/taskController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionMiddleware } from '../middlewares/permissionMiddleware';
import { validate } from '../middlewares/validate';
import { createTaskSchema } from '../utils/validators';

const router = Router();

router.use(authMiddleware);

router.post('/', permissionMiddleware('canCreateTask'), validate(createTaskSchema), createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', permissionMiddleware('canEditTask'), updateTask);
router.delete('/:id', permissionMiddleware('canDeleteTask'), deleteTask);
router.patch('/:id/assign', permissionMiddleware('canAssignTask'), assignTask);
router.post('/:id/comments', addComment);
router.get('/:id/activity', getTaskActivity);

export default router;
