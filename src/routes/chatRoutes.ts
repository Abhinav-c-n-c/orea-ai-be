import { Router } from 'express';
import { getConversations, getMessages, getUnreadCount, sendMessage } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionMiddleware } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/conversations', permissionMiddleware('canAccessChat'), getConversations);
router.get('/messages/:receiverId', permissionMiddleware('canAccessChat'), getMessages);
router.get('/unread', permissionMiddleware('canAccessChat'), getUnreadCount);
router.post('/send', permissionMiddleware('canAccessChat'), sendMessage);

export default router;
