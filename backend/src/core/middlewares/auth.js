import jwt from 'jsonwebtoken';

/**
 * Middleware xác thực JWT.
 * Gắn thông tin user vào req.user nếu token hợp lệ.
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Không có token xác thực.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

/**
 * Middleware phân quyền RBAC (Role-Based Access Control).
 * @param {...string} roles - Danh sách vai trò được phép truy cập.
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này.',
      });
    }
    next();
  };
}
