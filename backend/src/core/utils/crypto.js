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
