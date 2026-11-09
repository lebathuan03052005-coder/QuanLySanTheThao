import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

function formatTimeStr(val) {
  if (!val) return '00:00';
  if (val instanceof Date) {
    const h = String(val.getUTCHours()).padStart(2, '0');
    const m = String(val.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  const str = String(val);
  const match = str.match(/(\d{2}:\d{2})/);
  return match ? match[1] : str.slice(0, 5);
}

function formatDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val).slice(0, 10);
}

/**
 * Xác định phân nhóm khách hàng dựa trên lịch sử đặt sân và uy tín.
 */
function classifyCustomer({ totalBookings, totalSpent, noShowCount, cancelledBookings, reputationScore }) {
  if (noShowCount >= 1 || cancelledBookings >= 2 || reputationScore < 4.0) {
    return 'WARNING'; // Cần lưu ý (hay hủy / bỏ kèo)
  }
  if (totalBookings >= 4 || totalSpent >= 1500000) {
    return 'VIP'; // Khách thân thiết / VIP
  }
  if (totalBookings >= 1) {
    return 'REGULAR'; // Khách thường xuyên
  }
  return 'NEW'; // Khách mới
}

/**
 * [3.1] Lấy danh sách khách hàng và thống kê lịch sử đặt sân thuộc phạm vi sân của Chủ sân.
 * @param {{ id: number, role: string }} user
 * @param {{ search?: string, segment?: string }} query
 */
export async function getCustomerList(user, query = {}) {
  const { search = '', segment = 'ALL' } = query;
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  const request = pool.request();
  let courtScopeFilter = '';

  if (userRole === 'owner') {
    request.input('ownerId', user.id);
    courtScopeFilter = `AND c.owner_id = @ownerId`;
  } else if (userRole === 'staff') {
    request.input('staffId', user.id);
    courtScopeFilter = `AND c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)`;
  }

  let searchClause = '';
  if (search && search.trim()) {
    request.input('search', `%${search.trim().toLowerCase()}%`);
    searchClause = `AND (LOWER(u.full_name) LIKE @search OR LOWER(u.email) LIKE @search OR u.phone LIKE @search)`;
  }

  const sqlQuery = `
    SELECT 
      u.user_id,
      u.full_name,
      u.phone,
      u.email,
      u.status,
      u.reputation_score,
      u.avatar_url,
      u.created_at,
      COUNT(b.booking_id) AS total_bookings,
      SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
      SUM(CASE WHEN b.status IN ('CONFIRMED', 'CHECKED-IN', 'PENDING') THEN 1 ELSE 0 END) AS active_bookings,
      SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_bookings,
      SUM(CASE WHEN b.status = 'NO-SHOW' THEN 1 ELSE 0 END) AS noshow_bookings,
      SUM(CASE WHEN b.status IN ('COMPLETED', 'CONFIRMED', 'CHECKED-IN') THEN ISNULL(b.total_price, 0) ELSE 0 END) AS total_spent,
      MAX(b.booking_date) AS last_booking_date
    FROM users u
    LEFT JOIN (
      SELECT bInner.*
      FROM bookings bInner
      JOIN courts c ON bInner.court_id = c.court_id
      WHERE 1=1 ${courtScopeFilter}
    ) b ON u.user_id = b.user_id
    WHERE u.role = 'PLAYER'
      ${searchClause}
    GROUP BY 
      u.user_id, u.full_name, u.phone, u.email, u.status, u.reputation_score, u.avatar_url, u.created_at
    ORDER BY total_spent DESC, total_bookings DESC, u.created_at DESC
  `;

  const result = await request.query(sqlQuery);

  let customers = result.recordset.map((row) => {
    const totalBookings = Number(row.total_bookings || 0);
    const completedBookings = Number(row.completed_bookings || 0);
    const activeBookings = Number(row.active_bookings || 0);
    const cancelledBookings = Number(row.cancelled_bookings || 0);
    const noShowCount = Number(row.noshow_bookings || 0);
    const totalSpent = Number(row.total_spent || 0);
    const reputationScore = Number(row.reputation_score ?? 5.0);

    const customerSegment = classifyCustomer({
      totalBookings,
      totalSpent,
      noShowCount,
      cancelledBookings,
      reputationScore,
    });

    return {
      id: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      status: (row.status || 'ACTIVE').toUpperCase(),
      reputationScore,
      avatarUrl: row.avatar_url || null,
      createdAt: row.created_at,
      totalBookings,
      completedBookings,
      activeBookings,
      cancelledBookings,
      noShowCount,
      totalSpent,
      lastBookingDate: formatDateStr(row.last_booking_date),
      segment: customerSegment,
    };
  });

  if (segment && segment !== 'ALL') {
    customers = customers.filter((c) => c.segment === segment.toUpperCase());
  }

  return customers;
}

/**
 * [3.1] Lấy hồ sơ chi tiết khách hàng kèm toàn bộ lịch sử đặt sân & giao dịch thanh toán.
 * @param {{ id: number, role: string }} user
 * @param {number} customerId
 */
export async function getCustomerHistory(user, customerId) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  const userRes = await pool.request()
    .input('customerId', customerId)
    .query(`
      SELECT user_id, full_name, phone, email, role, status, reputation_score, avatar_url, created_at
      FROM users
      WHERE user_id = @customerId
    `);

  const customer = userRes.recordset[0];
  if (!customer) {
    throw new AppError('Không tìm thấy thông tin khách hàng.', 404);
  }

  const historyReq = pool.request().input('customerId', customerId);
  let ownerClause = '';
  if (userRole === 'owner') {
    historyReq.input('ownerId', user.id);
    ownerClause = `AND c.owner_id = @ownerId`;
  } else if (userRole === 'staff') {
    historyReq.input('staffId', user.id);
    ownerClause = `AND c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)`;
  }

  const bookingsRes = await historyReq.query(`
    SELECT 
      b.booking_id,
      b.court_id,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.total_price,
      b.deposit_amount,
      b.status,
      b.created_at,
      c.court_name,
      c.address AS court_address,
      s.sport_name,
      (
        SELECT TOP 1 t.payment_method 
        FROM transactions t 
        WHERE t.booking_id = b.booking_id 
        ORDER BY t.created_at DESC
      ) AS payment_method,
      (
        SELECT SUM(CASE WHEN t.transaction_type = 'REFUND' THEN -t.amount ELSE t.amount END)
        FROM transactions t
        WHERE t.booking_id = b.booking_id AND t.status = 'SUCCESS'
      ) AS paid_amount
    FROM bookings b
    JOIN courts c ON b.court_id = c.court_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    WHERE b.user_id = @customerId
      ${ownerClause}
    ORDER BY b.booking_date DESC, b.start_time DESC
  `);

  const bookings = bookingsRes.recordset.map((b) => ({
    bookingId: b.booking_id,
    courtId: b.court_id,
    courtName: b.court_name,
    courtAddress: b.court_address,
    sportName: b.sport_name || 'Thể thao',
    bookingDate: formatDateStr(b.booking_date),
    startTime: formatTimeStr(b.start_time),
    endTime: formatTimeStr(b.end_time),
    totalPrice: Number(b.total_price || 0),
    depositAmount: Number(b.deposit_amount || 0),
    paidAmount: Number(b.paid_amount || b.deposit_amount || 0),
    paymentMethod: b.payment_method || 'CASH',
    status: (b.status || 'PENDING').toUpperCase(),
    createdAt: b.created_at,
  }));

  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED').length;
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED').length;
  const noShowCount = bookings.filter((b) => b.status === 'NO-SHOW').length;
  const totalSpent = bookings
    .filter((b) => ['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(b.status))
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return {
    customer: {
      id: customer.user_id,
      fullName: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      status: (customer.status || 'ACTIVE').toUpperCase(),
      reputationScore: Number(customer.reputation_score ?? 5.0),
      avatarUrl: customer.avatar_url || null,
      createdAt: customer.created_at,
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowCount,
      totalSpent,
      segment: classifyCustomer({
        totalBookings,
        totalSpent,
        noShowCount,
        cancelledBookings,
        reputationScore: Number(customer.reputation_score ?? 5.0),
      }),
    },
    bookings,
  };
}

/**
 * Cập nhật điểm uy tín hoặc trạng thái tài khoản khách hàng.
 */
export async function updateCustomerReputation(customerId, data) {
  const { reputationScore, status } = data;
  const pool = await getPool();
  const req = pool.request().input('customerId', customerId);
  const fields = [];

  if (reputationScore !== undefined) {
    const score = Math.max(1.0, Math.min(5.0, Number(reputationScore)));
    req.input('score', score);
    fields.push('reputation_score = @score');
  }

  if (status && ['ACTIVE', 'LOCKED'].includes(status.toUpperCase())) {
    req.input('status', status.toUpperCase());
    fields.push('status = @status');
  }

  if (fields.length === 0) {
    throw new AppError('Không có thông tin cần cập nhật.', 400);
  }

  const res = await req.query(`
    UPDATE users
    SET ${fields.join(', ')}
    OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.reputation_score, INSERTED.status
    WHERE user_id = @customerId AND role = 'PLAYER'
  `);

  if (res.recordset.length === 0) {
    throw new AppError('Không tìm thấy khách hàng.', 404);
  }

  return res.recordset[0];
}

