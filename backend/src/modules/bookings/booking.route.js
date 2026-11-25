import { Router } from 'express';
import {
  verifyToken,
  authorize,
  checkAccountStatus,
  checkBookingOwnership,
  checkStaffCourtAccess,
} from '../../core/middlewares/auth.js';
import {
  getBookings,
  getSchedule,
  getBookingById,
  createBooking,
  updateBooking,
  createMaintenance,
  deleteMaintenance,
  deleteBooking,
} from './booking.controller.js';

const router = Router();

router.use(verifyToken, checkAccountStatus);

// [3.1] Lịch hoạt động sân theo Ngày / Tuần / Tháng dành cho Owner & Staff
router.get('/schedule', authorize('owner', 'staff'), getSchedule);

// Quản lý lịch bảo trì sân (chỉ Owner)
router.post('/maintenances', authorize('owner'), createMaintenance);
router.delete('/maintenances/:id', authorize('owner'), deleteMaintenance);

// Danh sách & tạo mới đơn đặt sân
router.get('/', getBookings);
router.post('/', checkStaffCourtAccess, createBooking);
router.get('/:id', checkBookingOwnership, getBookingById);

// Cập nhật trạng thái và Hủy đặt sân
router.put('/:id', checkBookingOwnership, updateBooking);
router.patch('/:id/status', checkBookingOwnership, updateBooking);
router.delete('/:id', checkBookingOwnership, deleteBooking);

export default router;
