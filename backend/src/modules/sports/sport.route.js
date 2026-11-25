import { Router } from 'express';
import * as sportController from './sport.controller.js';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';

const router = Router();

// Xem danh mục môn thể thao của riêng Chủ sân đang đăng nhập (kèm danh sách sân con thuộc sở hữu của Owner đó)
router.get('/owner', verifyToken, authorize('owner'), sportController.getOwnerSports);

// Xem danh mục môn thể thao công khai (không trả danh sách sân nội bộ của các chủ sân khác)
router.get('/', sportController.getAllSports);
router.get('/:id', sportController.getSportById);

// Thao tác Thêm / Sửa / Đổi trạng thái: giữ quyền OWNER (cô lập phạm vi theo từng Owner)
router.post('/', verifyToken, authorize('owner'), sportController.createSport);
router.put('/:id', verifyToken, authorize('owner'), sportController.updateSport);
router.patch('/:id/status', verifyToken, authorize('owner'), sportController.updateSportStatus);

export default router;
