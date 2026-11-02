import { Router } from 'express';
import { verifyToken, checkBookingOwnership } from '../../core/middlewares/auth.js';
import {
  getBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
} from './booking.controller.js';

const router = Router();

// Tất cả API đặt sân đều được bảo vệ bởi middleware xác thực JWT
router.get('/', verifyToken, getBookings);
router.get('/:id', verifyToken, checkBookingOwnership, getBookingById);
router.post('/', verifyToken, createBooking);

// Cập nhật và Hủy đặt sân: Kiểm tra quyền sở hữu (chỉ chính người đặt hoặc chủ sân/admin)
router.put('/:id', verifyToken, checkBookingOwnership, updateBooking);
router.delete('/:id', verifyToken, checkBookingOwnership, deleteBooking);

export default router;
