import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshTokenHandler,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validators';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh-token', refreshTokenHandler);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
