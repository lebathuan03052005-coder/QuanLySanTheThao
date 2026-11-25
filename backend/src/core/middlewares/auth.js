import jwt from 'jsonwebtoken';
import { getPool } from '../config/db.js';
import { getJwtSecret } from '../utils/crypto.js';

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

  // JWT_SECRET là bắt buộc: thiếu cấu hình thì báo lỗi hệ thống, không dùng secret mặc định
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (err) {
    return next(err);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
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
 * @param {...string} roles - Danh sách vai trò được phép truy cập (ví dụ: 'owner', 'staff', 'player').
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
 * Middleware kiểm tra trạng thái hoạt động của tài khoản (Active Account Check).
 * Ngăn chặn tức thì các tài khoản đã bị khóa (LOCKED) hoặc ngừng hoạt động (INACTIVE).
 */
export async function checkAccountStatus(req, res, next) {
  if (!req.user || !req.user.id) {
    return next();
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', req.user.id)
      .query('SELECT user_id, status, role FROM users WHERE user_id = @id');

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại trong hệ thống.',
      });
    }

    const status = (user.status || 'ACTIVE').toUpperCase();
    if (status === 'LOCKED') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ chủ sân để được hỗ trợ.',
        code: 'ACCOUNT_LOCKED',
      });
    }

    if (status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản này đã ngừng hoạt động trong hệ thống.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware kiểm soát quyền sở hữu sân bóng (Data Ownership Scoping).
 * Đảm bảo Chủ sân (owner) chỉ được sửa/xóa sân của chính mình theo schema bảng courts.
 */
export async function checkCourtOwnership(req, res, next) {
  try {
    const rawId = req.params.id;
    if (rawId === undefined || rawId === null || rawId === '' || isNaN(Number(rawId))) {
      return res.status(400).json({ success: false, message: 'ID sân không hợp lệ.' });
    }
    const courtId = Number(rawId);

    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', courtId)
      .query('SELECT court_id, owner_id, court_name FROM courts WHERE court_id = @id');

    const court = result.recordset[0];
    if (!court) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sân bóng này.' });
    }

    // Kiểm tra quyền sở hữu phía máy chủ
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
 */
export async function checkBookingOwnership(req, res, next) {
  try {
    const rawId = req.params.id;
    if (rawId === undefined || rawId === null || rawId === '' || isNaN(Number(rawId))) {
      return res.status(400).json({ success: false, message: 'ID đặt sân không hợp lệ.' });
    }
    const bookingId = Number(rawId);

    const userRole = (req.user.role || '').toLowerCase();
    const pool = await getPool();
    const result = await pool.request().input('id', bookingId).query(`
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

    // Nếu là Nhân viên (staff) -> kiểm tra xem có được phân công quản lý sân này không
    if (userRole === 'staff') {
      const staffCheck = await pool
        .request()
        .input('staffId', req.user.id)
        .input('courtId', booking.court_id)
        .query('SELECT assignment_id FROM court_staff WHERE staff_id = @staffId AND court_id = @courtId');

      if (staffCheck.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không được phân công quản lý sân chứa lịch đặt này.',
          code: 'COURT_ACCESS_DENIED',
        });
      }
    }

    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware kiểm tra phạm vi sân được phép thao tác của Chủ sân (owner) và Nhân viên (staff).
 * - Owner: chỉ thao tác trên sân thuộc sở hữu của mình (owner_id = req.user.id).
 * - Staff: chỉ thao tác trên sân được phân công trong bảng court_staff.
 */
export async function checkStaffCourtAccess(req, res, next) {
  const userRole = (req.user?.role || '').toLowerCase();

  const rawCourtId = req.params.courtId ?? req.body?.courtId ?? req.query?.courtId;
  if (rawCourtId === undefined || rawCourtId === null || rawCourtId === '' || isNaN(Number(rawCourtId))) {
    return next();
  }
  const courtId = Number(rawCourtId);

  try {
    const pool = await getPool();

    if (userRole === 'owner') {
      const courtCheck = await pool
        .request()
        .input('courtId', courtId)
        .query('SELECT court_id, owner_id FROM courts WHERE court_id = @courtId');

      if (courtCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy sân thể thao này.',
        });
      }

      if (Number(courtCheck.recordset[0].owner_id) !== Number(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền thao tác trên sân của chủ sân khác.',
          code: 'COURT_ACCESS_DENIED',
        });
      }
      return next();
    }

    if (userRole === 'staff') {
      const result = await pool
        .request()
        .input('staffId', req.user.id)
        .input('courtId', courtId)
        .query('SELECT assignment_id FROM court_staff WHERE staff_id = @staffId AND court_id = @courtId');

      if (result.recordset.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không được phân công quản lý sân này.',
          code: 'COURT_ACCESS_DENIED',
        });
      }
      return next();
    }

    if (userRole === 'player') {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền thực hiện thao tác này.',
    });
  } catch (err) {
    next(err);
  }
}
