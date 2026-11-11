import * as bookingService from './booking.service.js';

export async function getBookings(req, res, next) {
  try {
    const bookings = await bookingService.getBookingsByUser(req.user);
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
    await bookingService.deleteBooking(req.params.id);
    res.json({ success: true, message: 'Đã hủy đặt sân thành công.' });
  } catch (err) {
    next(err);
  }
}
