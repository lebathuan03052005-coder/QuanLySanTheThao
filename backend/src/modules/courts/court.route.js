import { Router } from 'express';
import { verifyToken, authorize, checkCourtOwnership } from '../../core/middlewares/auth.js';
import {
  getCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
} from './court.controller.js';

const router = Router();

// Xem danh sách và chi tiết sân: Công khai cho mọi người
router.get('/', getCourts);
router.get('/:id', getCourtById);

// Tạo mới sân bóng: Chỉ Chủ sân (owner) hoặc Quản trị viên (admin)
router.post('/', verifyToken, authorize('owner', 'admin'), createCourt);

// Cập nhật thông tin sân: Yêu cầu xác thực + kiểm tra quyền sở hữu (chỉ sửa sân của chính mình)
router.put('/:id', verifyToken, authorize('owner', 'admin'), checkCourtOwnership, updateCourt);

// Xóa sân bóng: Yêu cầu xác thực + kiểm tra quyền sở hữu (chỉ xóa sân của chính mình)
router.delete('/:id', verifyToken, authorize('owner', 'admin'), checkCourtOwnership, deleteCourt);

export default router;
