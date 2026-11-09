import { Router } from 'express';
import {
  verifyToken,
  authorize,
  checkBookingOwnership,
  checkStaffCourtAccess,
} from '../../core/middlewares/auth.js';
import {
  getBookings,
  getScheduleData,
  getBookingById,
  createBooking,
  updateBooking,
  createMaintenance,
  deleteMaintenance,
  deleteBooking,
} from './booking.controller.js';

const router = Router();

// [3.1] Lịch sân theo Ngày/Tuần/Tháng dành cho Chủ sân, Nhân viên và Admin
router.get('/schedule', verifyToken, authorize('owner', 'staff', 'admin'), getScheduleData);

// Quản lý lịch bảo trì sân trên Lịch hoạt động
router.post('/maintenances', verifyToken, authorize('owner', 'admin'), createMaintenance);
router.delete('/maintenances/:id', verifyToken, authorize('owner', 'admin'), deleteMaintenance);

// Đặt sân tại quầy (Walk-in) hoặc đặt trực tuyến
router.get('/', verifyToken, getBookings);
router.get('/:id', verifyToken, checkBookingOwnership, getBookingById);
router.post('/', verifyToken, checkStaffCourtAccess, createBooking);

// Cập nhật trạng thái và Hủy đặt sân
router.put('/:id', verifyToken, checkBookingOwnership, updateBooking);
router.patch('/:id/status', verifyToken, checkBookingOwnership, updateBooking);
router.delete('/:id', verifyToken, checkBookingOwnership, deleteBooking);

export default router;
