import jwt from 'jsonwebtoken';
import { getPool } from '../config/db.js';

/**
 * Middleware xác thực JWT Token (Authentication).
 * Kiểm tra token trong Authorization header và gắn thông tin người dùng vào req.user.
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để thực hiện hành động này.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sportlink_jwt_super_secret_key_2026');
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Middleware phân quyền RBAC (Role-Based Access Control).
 * @param {...string} roles - Danh sách vai trò được phép truy cập (ví dụ: 'admin', 'owner', 'staff', 'player').
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng.',
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const normalizedRoles = roles.map((r) => r.toLowerCase());

    // Quản trị viên (admin) luôn có toàn quyền truy cập
    if (userRole === 'admin') {
      return next();
    }

    // Kiểm tra xem vai trò của user có nằm trong danh sách được cấp phép không
    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Tài khoản với vai trò '${req.user.role}' không có quyền thực hiện thao tác này.`,
      });
    }

    next();
  };
}

/**
 * Middleware kiểm soát quyền sở hữu sân bóng (Data Ownership Scoping).
 * Đảm bảo Chủ sân (owner) chỉ được sửa/xóa sân của chính mình theo schema bảng courts.
 */
export async function checkCourtOwnership(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    if (!courtId) {
      return res.status(400).json({ success: false, message: 'ID sân không hợp lệ.' });
    }

    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'admin') {
      return next();
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', courtId)
      .query('SELECT court_id, owner_id, court_name FROM courts WHERE court_id = @id');

    const court = result.recordset[0];
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sân bóng này.' });
    }

    // Kiểm tra quyền sở hữu phía máy chủ (Server-side ownership check)
    if (court.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa hoặc xóa dữ liệu sân bóng của chủ sân khác.',
      });
    }

    req.court = court;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware kiểm soát quyền sở hữu lịch đặt sân (Booking Ownership).
 * Phù hợp với schema bảng bookings và courts trong mục dulieu.
 */
export async function checkBookingOwnership(req, res, next) {
  try {
    const bookingId = parseInt(req.params.id);
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'ID đặt sân không hợp lệ.' });
    }

    const userRole = (req.user.role || '').toLowerCase();
    if (userRole === 'admin') {
      return next();
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', bookingId)
      .query(`
        SELECT b.booking_id, b.user_id, b.court_id, b.status, c.owner_id
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        WHERE b.booking_id = @id
      `);

    const booking = result.recordset[0];
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đặt sân này.' });
    }

    // Nếu là Người chơi (player) -> chỉ thao tác trên lịch của chính mình
    if (userRole === 'player' && booking.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập hoặc chỉnh sửa đặt sân của người khác.',
      });
    }

    // Nếu là Chủ sân (owner) -> chỉ thao tác trên các sân do mình sở hữu
    if (userRole === 'owner' && booking.owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Lịch đặt sân này không thuộc sân do bạn quản lý.',
      });
    }

    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
}
