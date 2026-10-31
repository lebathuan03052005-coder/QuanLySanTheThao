import * as bookingService from './booking.service.js';

export async function getBookings(req, res, next) {
  try {
    // Phân quyền dữ liệu theo vai trò (req.user)
    const bookings = await bookingService.getBookingsByUser(req.user);
    res.json({ success: true, data: bookings });
  } catch (err) {
    next(err);
  }
}

export async function getBookingById(req, res, next) {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đặt sân.' });
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

export async function createBooking(req, res, next) {
  try {
    const booking = await bookingService.createBooking({ ...req.body, userId: req.user.id });
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

export async function updateBooking(req, res, next) {
  try {
    const booking = await bookingService.updateBooking(req.params.id, req.body);
    res.json({ success: true, data: booking });
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
