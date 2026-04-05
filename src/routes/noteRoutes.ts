import { Router } from 'express';
import {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  getNoteHistory,
} from '../controllers/noteController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionMiddleware } from '../middlewares/permissionMiddleware';
import { validate } from '../middlewares/validate';
import { createNoteSchema } from '../utils/validators';

const router = Router();

router.use(authMiddleware);

router.post('/', permissionMiddleware('canCreateNotes'), validate(createNoteSchema), createNote);
router.get('/', getNotes);
router.get('/:id', getNoteById);
router.put('/:id', permissionMiddleware('canEditNotes'), updateNote);
router.delete('/:id', permissionMiddleware('canDeleteNotes'), deleteNote);
router.get('/:id/history', getNoteHistory);

export default router;
