import { Router } from 'express';
import {
  verifyToken,
  authorize,
  checkAccountStatus,
} from '../../core/middlewares/auth.js';
import {
  getCustomers,
  getCustomerHistory,
  updateCustomerReputation,
} from './customer.controller.js';

const router = Router();

// Tất cả route Quản lý khách hàng đều yêu cầu đăng nhập và tài khoản đang hoạt động
router.use(verifyToken, checkAccountStatus, authorize('owner', 'staff'));

router.get('/', getCustomers);
router.get('/:id/history', getCustomerHistory);
router.patch('/:id/reputation', authorize('owner'), updateCustomerReputation);

export default router;

