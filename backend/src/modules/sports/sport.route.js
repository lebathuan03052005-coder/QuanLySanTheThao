import { Router } from 'express';
import * as sportController from './sport.controller.js';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';

const router = Router();

// Xem danh mục môn thể thao: mở cho tất cả người dùng
router.get('/', sportController.getAllSports);
router.get('/:id', sportController.getSportById);

// Thao tác Thêm / Sửa / Đổi trạng thái: yêu cầu quyền OWNER hoặc ADMIN
router.post('/', verifyToken, authorize('owner', 'admin'), sportController.createSport);
router.put('/:id', verifyToken, authorize('owner', 'admin'), sportController.updateSport);
router.patch('/:id/status', verifyToken, authorize('owner', 'admin'), sportController.updateSportStatus);

export default router;

