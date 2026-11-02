/**
 * Middleware xử lý lỗi tập trung (Centralized Error Handler).
 * Bắt tất cả lỗi được next(err) từ controller hoặc throw trong luồng request
 * và trả về phản hồi JSON nhất quán kèm mã HTTP tương ứng.
 */
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Đã xảy ra lỗi hệ thống.';

  // Xử lý lỗi trùng lặp dữ liệu (Unique Constraint) trong SQL Server
  if (err.number === 2627 || err.number === 2601) {
    statusCode = 409;
    message = 'Dữ liệu đã tồn tại trong hệ thống (email hoặc mã bị trùng lặp).';
  }

  // Xử lý lỗi cú pháp JSON trong body request
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Dữ liệu JSON gửi lên không đúng định dạng.';
  }

  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[CLIENT ERROR ${statusCode}] ${req.method} ${req.originalUrl} — ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      errorDetails: err.originalError || err.code || undefined,
    }),
  });
}
