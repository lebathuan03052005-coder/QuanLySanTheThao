/**
 * SPORTLINK - BOOKING TIME & PAST SLOT VALIDATION UTILITIES
 * Đảm bảo người dùng và hệ thống không thể đặt sân vào ngày hoặc giờ trong quá khứ.
 */

// Danh sách tất cả các mốc giờ mở cửa (06:00 đến 22:00, bước 30 phút)
export const BOOKING_START_TIMES = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00'
];

export const BOOKING_END_TIMES = [
  '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00'
];

/**
 * Lấy chuỗi ngày hôm nay theo múi giờ địa phương (YYYY-MM-DD)
 */
export function getLocalTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Chuyển chuỗi HH:mm thành số phút trong ngày
 */
export function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Kiểm tra xem một khung giờ (ngày + giờ bắt đầu) đã ở trong quá khứ hay chưa.
 * @param bookingDate Ngày đặt sân định dạng YYYY-MM-DD
 * @param startTimeStr Giờ bắt đầu định dạng HH:mm
 */
export function isPastBookingSlot(bookingDate: string, startTimeStr: string): boolean {
  const todayIso = getLocalTodayIso();

  // Ngày đã qua trong quá khứ
  if (!bookingDate || bookingDate < todayIso) {
    return true;
  }

  // Ngày trong tương lai -> chắc chắn hợp lệ
  if (bookingDate > todayIso) {
    return false;
  }

  // Ngày hôm nay -> kiểm tra giờ bắt đầu so với giờ phút hiện tại
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = timeToMinutes(startTimeStr);

  return slotMinutes <= currentMinutes;
}

/**
 * Lấy khung giờ hợp lệ tiếp theo (luôn trong tương lai) cho ngày được chọn.
 */
export function getInitialBookingTimes(bookingDate: string): {
  bookingDate: string;
  startTime: string;
  endTime: string;
} {
  const todayIso = getLocalTodayIso();
  const now = new Date();

  // Nếu là ngày mai hoặc tương lai, mặc định chọn 08:00 - 09:30
  if (bookingDate > todayIso) {
    return {
      bookingDate,
      startTime: '08:00',
      endTime: '09:30',
    };
  }

  // Nếu là ngày hôm nay, tính khung giờ tiếp theo (sau hiện tại ít nhất 15-30 phút)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Tìm mốc giờ bắt đầu sớm nhất còn trong tương lai
  const availableSlot = BOOKING_START_TIMES.find((slot) => {
    return timeToMinutes(slot) > currentMinutes + 15;
  });

  if (availableSlot) {
    const startMin = timeToMinutes(availableSlot);
    const endMin = Math.min(23 * 60, startMin + 90); // Mặc định 90 phút (1.5h)
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const endSlot = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    return {
      bookingDate: todayIso,
      startTime: availableSlot,
      endTime: endSlot,
    };
  }

  // Nếu hôm nay đã quá 21:30 (không còn khung giờ nào), tự động chuyển sang sáng ngày mai
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomYear = tomorrow.getFullYear();
  const tomMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tomDay = String(tomorrow.getDate()).padStart(2, '0');
  const tomorrowIso = `${tomYear}-${tomMonth}-${tomDay}`;

  return {
    bookingDate: tomorrowIso,
    startTime: '08:00',
    endTime: '09:30',
  };
}
