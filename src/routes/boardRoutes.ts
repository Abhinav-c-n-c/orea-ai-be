import { Router } from 'express';
import { createBoard, getBoards, deleteBoard } from '../controllers/boardController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getBoards);
router.post('/', createBoard);
router.delete('/:id', deleteBoard);

export default router;
