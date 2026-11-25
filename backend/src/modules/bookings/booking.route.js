import { Router } from 'express';
import {
  verifyToken,
  authorize,
  checkAccountStatus,
  checkBookingOwnership,
  checkStaffCourtAccess,
} from '../../core/middlewares/auth.js';
import {
  getCourtAvailability,
  getBookingQuote,
  getBookings,
  getSchedule,
  getBookingById,
  createBooking,
  initiatePayment,
  handlePaymentWebhook,
  getVietQrFallback,
  confirmVietQrPayment,
  cancelBooking,
  updateBooking,
  createMaintenance,
  deleteMaintenance,
  deleteBooking,
} from './booking.controller.js';

const router = Router();

// [4.3] Các API công khai / Webhook cổng thanh toán (Webhook tự xác thực bằng chữ ký HMAC-SHA512)
router.get('/availability', getCourtAvailability);
router.get('/quote', getBookingQuote);
router.post('/quote', getBookingQuote);
router.post('/payment/webhook', handlePaymentWebhook);

// Các API yêu cầu đăng nhập JWT
router.use(verifyToken, checkAccountStatus);

// [3.1] Lịch hoạt động sân theo Ngày / Tuần / Tháng dành cho Owner & Staff
router.get('/schedule', authorize('owner', 'staff'), getSchedule);

// Quản lý lịch bảo trì sân (chỉ Owner)
router.post('/maintenances', authorize('owner'), createMaintenance);
router.delete('/maintenances/:id', authorize('owner'), deleteMaintenance);

// Danh sách & tạo mới đơn đặt sân (S3-07: Transaction Lock chống đặt trùng TC02)
router.get('/', getBookings);
router.post('/', checkStaffCourtAccess, createBooking);
router.get('/:id', checkBookingOwnership, getBookingById);

// [4.3] Thanh toán qua cổng Sandbox, Webhook & Phương án dự phòng VietQR (S3-08, S3-09)
router.post('/:id/payment/init', checkBookingOwnership, initiatePayment);
router.get('/:id/payment/vietqr', checkBookingOwnership, getVietQrFallback);
router.post('/:id/payment/vietqr-confirm', checkBookingOwnership, confirmVietQrPayment);

// [4.3] Hủy đặt sân, giải phóng lịch sân & hoàn tiền tự động (S3-10)
router.post('/:id/cancel', checkBookingOwnership, cancelBooking);
router.put('/:id', checkBookingOwnership, updateBooking);
router.patch('/:id/status', checkBookingOwnership, updateBooking);
router.delete('/:id', checkBookingOwnership, deleteBooking);

export default router;
