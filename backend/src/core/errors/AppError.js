/**
 * Lớp lỗi tùy chỉnh cho ứng dụng (Application Error).
 * Cho phép gắn mã trạng thái HTTP (statusCode) để middleware errorHandler xử lý chính xác.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Thông báo lỗi
   * @param {number} statusCode - Mã trạng thái HTTP (400, 401, 403, 404, 409, 500...)
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
