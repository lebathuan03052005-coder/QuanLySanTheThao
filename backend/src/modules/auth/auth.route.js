import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  uploadAvatar,
  getNotifications,
  markNotificationsRead,
} from './auth.controller.js';
import { verifyToken } from '../../core/middlewares/auth.js';
import { uploadAvatarMiddleware } from '../../core/middlewares/upload.js';

const router = Router();

// [4.1 - S3-01] Đăng ký, Đăng nhập & Quên mật khẩu (OTP)
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin); // Đăng nhập / Đăng ký nhanh qua Google OAuth
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.post('/logout', verifyToken, logout);

// [4.1 - S3-02] Hồ sơ người chơi & Bảo mật tài khoản
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, changePassword);
router.post('/avatar', verifyToken, uploadAvatarMiddleware.single('avatar'), uploadAvatar);
router.get('/notifications', verifyToken, getNotifications);
router.patch('/notifications/read', verifyToken, markNotificationsRead);

export default router;
