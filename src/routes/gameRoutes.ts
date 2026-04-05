import express from 'express';
import { getRoom, joinRoom, createRoom, getUserGames } from '../controllers/gameController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authMiddleware);

router.post('/rooms', createRoom);
router.get('/rooms/:roomId', getRoom);
router.post('/rooms/:roomId/join', joinRoom);
router.get('/history', getUserGames);

export default router;
