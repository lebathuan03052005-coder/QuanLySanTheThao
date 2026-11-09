import { Router } from 'express';
import { verifyToken, authorize } from '../../core/middlewares/auth.js';
import {
  getCustomerList,
  getCustomerHistory,
  updateCustomerReputation,
} from './customer.controller.js';

const router = Router();

// Chủ sân, Nhân viên và Admin được phép xem danh sách khách hàng và lịch sử đặt sân
router.use(verifyToken, authorize('owner', 'staff', 'admin'));

router.get('/', getCustomerList);
router.get('/:id/history', getCustomerHistory);
router.patch('/:id/reputation', authorize('owner', 'admin'), updateCustomerReputation);

export default router;

