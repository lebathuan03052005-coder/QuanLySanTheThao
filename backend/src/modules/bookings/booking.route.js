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
  getBookingCartQuote,
  checkoutBookingCart,
  getBookings,
  getSchedule,
  getBookingById,
  createBooking,
  initiatePayment,
  handlePaymentWebhook,
  getVietQrFallback,
  confirmVietQrPayment,
  cancelBooking,
  rejectBooking,
  updateBooking,
  createMaintenance,
  deleteMaintenance,
  deleteBooking,
} from './booking.controller.js';

const router = Router();

// [4.3] Các API công khai / Báo giá khung giờ & Giỏ đặt sân (S3-06) / Webhook cổng thanh toán
router.get('/availability', getCourtAvailability);
router.get('/quote', getBookingQuote);
router.post('/quote', getBookingQuote);
router.post('/cart/quote', getBookingCartQuote);
router.post('/payment/webhook', handlePaymentWebhook);

// Các API yêu cầu đăng nhập JWT
router.use(verifyToken, checkAccountStatus);

// [4.3 - S3-06] Đặt sân hàng loạt từ Giỏ đặt sân (Multi-slot Cart Checkout)
router.post('/cart/checkout', checkoutBookingCart);

// [3.1] Lịch hoạt động sân theo Ngày / Tuần / Tháng dành cho Owner & Staff
router.get('/schedule', authorize('owner', 'staff'), getSchedule);

// Quản lý lịch bảo trì sân (chỉ Owner)
router.post('/maintenances', authorize('owner'), createMaintenance);
router.delete('/maintenances/:id', authorize('owner'), deleteMaintenance);

// Danh sách & tạo mới đơn đặt sân (S3-07: Transaction Lock chống đặt trùng TC02 & S3-14: Bộ lọc đơn)
router.get('/', getBookings);
router.post('/', checkStaffCourtAccess, createBooking);
router.get('/:id', checkBookingOwnership, getBookingById);

// [4.3] Thanh toán qua cổng Sandbox, Webhook & Phương án dự phòng VietQR (S3-08, S3-09)
router.post('/:id/payment/init', checkBookingOwnership, initiatePayment);
router.get('/:id/payment/vietqr', checkBookingOwnership, getVietQrFallback);
router.post('/:id/payment/vietqr-confirm', checkBookingOwnership, confirmVietQrPayment);

// [3.1 & 4.3] Xác nhận, Từ chối kèm lý do (S3-14), Hủy đặt sân & hoàn tiền tự động (S3-10)
router.post('/:id/reject', authorize('owner', 'staff', 'admin'), checkBookingOwnership, rejectBooking);
router.post('/:id/cancel', checkBookingOwnership, cancelBooking);
router.put('/:id', checkBookingOwnership, updateBooking);
router.patch('/:id/status', checkBookingOwnership, updateBooking);
router.delete('/:id', checkBookingOwnership, deleteBooking);

export default router;
