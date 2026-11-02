import { Router } from 'express';
import { register, login, googleLogin, logout, getProfile } from './auth.controller.js';
import { verifyToken } from '../../core/middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin); // Đăng nhập / Đăng ký nhanh qua Google OAuth
router.post('/logout', verifyToken, logout);
router.get('/profile', verifyToken, getProfile);

export default router;
