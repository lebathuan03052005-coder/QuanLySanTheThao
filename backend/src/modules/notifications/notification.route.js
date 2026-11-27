import { Router } from 'express';
import { verifyToken, checkAccountStatus } from '../../core/middlewares/auth.js';
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './notification.controller.js';

const router = Router();

// Tất cả API thông báo yêu cầu đăng nhập JWT hợp lệ và tài khoản đang hoạt động
router.use(verifyToken, checkAccountStatus);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
