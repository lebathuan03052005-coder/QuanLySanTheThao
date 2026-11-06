import { Router } from 'express';
import {
  getStaffList,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffStatus,
  getOwnerCourts,
} from './staff.controller.js';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';

const router = Router();

// Tất cả các route quản lý nhân viên yêu cầu xác thực vai trò Owner hoặc Admin
router.use(verifyToken, authorize('owner', 'admin'));

router.get('/courts', getOwnerCourts);
router.get('/', getStaffList);
router.get('/:id', getStaffById);
router.post('/', createStaff);
router.put('/:id', updateStaff);
router.patch('/:id/status', updateStaffStatus);

export default router;
