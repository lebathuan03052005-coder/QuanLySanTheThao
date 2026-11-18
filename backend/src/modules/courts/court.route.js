import { Router } from 'express';
import { verifyToken, authorize, checkCourtOwnership } from '../../core/middlewares/auth.js';
import {
  getCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
  getCourtPrices,
  updateCourtPrices,
} from './court.controller.js';

const router = Router();

// Xem danh sách và chi tiết sân: Công khai cho mọi người
router.get('/', getCourts);
router.get('/:id', getCourtById);

// Tạo mới sân bóng: Chỉ Chủ sân (owner)
router.post('/', verifyToken, authorize('owner'), createCourt);

// Cập nhật thông tin sân: Yêu cầu xác thực + kiểm tra quyền sở hữu (chỉ sửa sân của chính mình)
router.put('/:id', verifyToken, authorize('owner'), checkCourtOwnership, updateCourt);

// Biểu phí động của sân con (WBS 3.2 - S2-07): Xem công khai, cập nhật chỉ Chủ sân sở hữu
router.get('/:id/prices', getCourtPrices);
router.put('/:id/prices', verifyToken, authorize('owner'), checkCourtOwnership, updateCourtPrices);

// Xóa sân bóng: Yêu cầu xác thực + kiểm tra quyền sở hữu (chỉ xóa sân của chính mình)
router.delete('/:id', verifyToken, authorize('owner'), checkCourtOwnership, deleteCourt);

export default router;
