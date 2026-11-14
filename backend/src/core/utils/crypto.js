/**
 * Hàm tiện ích mã hóa và bảo mật.
 */
import crypto from 'crypto';

/**
 * Tạo chuỗi ngẫu nhiên (dùng cho token xác thực email, v.v.).
 * @param {number} length - Độ dài chuỗi (mặc định 32).
 * @returns {string}
 */
export function generateRandomToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Lấy JWT_SECRET bắt buộc từ biến môi trường.
 * Không có giá trị mặc định: thiếu biến thì hệ thống từ chối chạy thay vì dùng secret công khai.
 * @returns {string}
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    const err = new Error(
      'Hệ thống chưa cấu hình JWT_SECRET. Vui lòng thiết lập biến môi trường JWT_SECRET trước khi chạy backend.'
    );
    err.statusCode = 500;
    throw err;
  }
  return secret;
}
