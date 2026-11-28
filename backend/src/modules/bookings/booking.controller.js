import * as bookingService from './booking.service.js';

export async function getCourtAvailability(req, res, next) {
  try {
    const data = await bookingService.getCourtAvailability(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBookingQuote(req, res, next) {
  try {
    const params = req.method === 'GET' ? req.query : req.body;
    const data = await bookingService.calculateBookingQuote(params);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBookingCartQuote(req, res, next) {
  try {
    const data = await bookingService.calculateCartQuote(req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function checkoutBookingCart(req, res, next) {
  try {
    const data = await bookingService.checkoutBookingCart(req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Đã đặt thành công ${data.totalBookings} khung giờ trong giỏ đặt sân!`,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBookings(req, res, next) {
  try {
    const bookings = await bookingService.getBookingsByUser(req.user, req.query);
    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
}

export async function getSchedule(req, res, next) {
  try {
    const schedule = await bookingService.getScheduleData(req.user, req.query);
    res.json({ success: true, data: schedule });
  } catch (err) {
    next(err);
  }
}

export async function getBookingById(req, res, next) {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy thông tin đặt sân.' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

export async function createBooking(req, res, next) {
  try {
    const booking = await bookingService.createBooking(
      { ...req.body, userId: req.user.id },
      req.user
    );
    res.status(201).json({
      success: true,
      message: 'Tạo đơn đặt sân thành công.',
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function initiatePayment(req, res, next) {
  try {
    const bookingId = req.params.id || req.body?.bookingId;
    const session = await bookingService.initiateBookingPayment(
      bookingId,
      req.body,
      req.user
    );
    res.status(201).json({
      success: true,
      message: 'Đã khởi tạo phiên thanh toán thành công.',
      data: session,
    });
  } catch (err) {
    next(err);
  }
}

export async function handlePaymentWebhook(req, res, next) {
  try {
    const result = await bookingService.processPaymentWebhook(req.body);
    res.status(200).json({
      success: result.status === 'SUCCESS',
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getVietQrFallback(req, res, next) {
  try {
    const data = await bookingService.getVietQrFallbackForBooking(
      req.params.id,
      req.query
    );
    res.json({
      success: true,
      message: 'Đã tạo mã QR chuyển khoản dự phòng VietQR Napas 247.',
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmVietQrPayment(req, res, next) {
  try {
    const result = await bookingService.confirmVietQrPayment(
      req.params.id,
      req.body,
      req.user
    );
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    const result = await bookingService.cancelBookingWithRefund(
      req.params.id,
      req.body || {},
      req.user
    );
    const refundAmt = result.refund?.refundAmount || 0;
    res.json({
      success: true,
      message:
        refundAmt > 0
          ? `Đã hủy đặt sân và hoàn trả ${refundAmt.toLocaleString('vi-VN')}đ thành công.`
          : 'Đã hủy đặt sân thành công.',
      data: result.booking,
      refund: result.refund,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectBooking(req, res, next) {
  try {
    const result = await bookingService.rejectOnlineBooking(
      req.params.id,
      req.body || {},
      req.user
    );
    const refundAmt = result.refund?.refundAmount || 0;
    res.json({
      success: true,
      message:
        refundAmt > 0
          ? `Đã từ chối đơn đặt sân, gửi thông báo kèm lý do cho Người chơi và hoàn trả ${refundAmt.toLocaleString('vi-VN')}đ.`
          : 'Đã từ chối đơn đặt sân và gửi thông báo kèm lý do cho Người chơi.',
      data: result.booking,
      refund: result.refund,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateBooking(req, res, next) {
  try {
    const booking = await bookingService.updateBooking(
      req.params.id,
      req.body,
      req.user
    );
    res.json({
      success: true,
      message: 'Cập nhật trạng thái đơn đặt sân thành công.',
      data: booking,
    });
  } catch (err) {
    next(err);
  }
}

export async function createMaintenance(req, res, next) {
  try {
    const maint = await bookingService.createMaintenance(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Đã thêm lịch bảo trì sân thành công.',
      data: maint,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMaintenance(req, res, next) {
  try {
    await bookingService.deleteMaintenance(req.user, parseInt(req.params.id));
    res.json({
      success: true,
      message: 'Đã mở khóa bảo trì sân thành công.',
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteBooking(req, res, next) {
  try {
    const result = await bookingService.deleteBooking(
      req.params.id,
      req.body || {},
      req.user
    );
    res.json({
      success: true,
      message: 'Đã hủy đặt sân thành công.',
      data: result?.booking || null,
      refund: result?.refund || null,
    });
  } catch (err) {
    next(err);
  }
}
