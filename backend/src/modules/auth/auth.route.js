import { Router } from 'express';
import { register, login, googleLogin, logout, getProfile, uploadAvatar } from './auth.controller.js';
import { verifyToken } from '../../core/middlewares/auth.js';
import { uploadAvatarMiddleware } from '../../core/middlewares/upload.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin); // Đăng nhập / Đăng ký nhanh qua Google OAuth
router.post('/logout', verifyToken, logout);
router.get('/profile', verifyToken, getProfile);
router.post('/avatar', verifyToken, uploadAvatarMiddleware.single('avatar'), uploadAvatar);

export default router;
