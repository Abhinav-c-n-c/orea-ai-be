import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionMiddleware } from '../middlewares/permissionMiddleware';

const router = Router();

router.use(authMiddleware);
router.get('/stats', permissionMiddleware('canViewDashboard'), getDashboardStats);

export default router;
