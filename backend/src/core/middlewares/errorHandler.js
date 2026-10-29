/**
 * Middleware xử lý lỗi tập trung (Centralized Error Handler).
 * Bắt tất cả lỗi được next(err) từ các controller và trả về response nhất quán.
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Đã xảy ra lỗi hệ thống.';

  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
