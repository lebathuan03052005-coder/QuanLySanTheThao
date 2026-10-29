/**
 * Hàm tiện ích xử lý định dạng thời gian.
 */

/**
 * Định dạng ngày giờ theo kiểu Việt Nam (DD/MM/YYYY HH:mm).
 * @param {Date | string} date
 * @returns {string}
 */
export function formatDatetime(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Tính khoảng cách thời gian giữa startTime và endTime theo giờ.
 * @param {string} startTime
 * @param {string} endTime
 * @returns {number} Số giờ (có thể là số thập phân)
 */
export function calcHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / (1000 * 60 * 60);
}
