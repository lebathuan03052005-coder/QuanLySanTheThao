import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';
import { getLocalDateStr, formatTimeStr, formatDateStr } from '../bookings/booking.service.js';

/**
 * Xác định phân nhóm khách hàng dựa trên lịch sử đặt sân thực tế và điểm uy tín.
 * Chỉ tính các đơn hợp lệ (COMPLETED / CONFIRMED / CHECKED-IN) khi xét hạng VIP / REGULAR.
 */
export function classifyCustomer({
  successfulBookings,
  totalSpent,
  noShowCount,
  cancelledBookings,
  reputationScore,
}) {
  if (noShowCount >= 1 || cancelledBookings >= 2 || reputationScore < 4.0) {
    return 'WARNING'; // Cần lưu ý (hay hủy / bỏ kèo / uy tín thấp)
  }
  if (successfulBookings >= 4 || totalSpent >= 1500000) {
    return 'VIP'; // Khách thân thiết / VIP
  }
  if (successfulBookings >= 2) {
    return 'REGULAR'; // Khách quen (đã đặt thành công từ 2 lần trở lên)
  }
  return 'NEW'; // Khách mới đặt sân lần đầu
}

/**
 * Xây dựng điều kiện lọc phạm vi sân nghiêm ngặt cho Chủ sân (Owner) và Nhân viên (Staff).
 * Tuyệt đối không dùng OR NOT EXISTS để tránh lộ dữ liệu giữa các Chủ sân.
 */
function buildCourtScopeCondition(request, user) {
  const userRole = (user.role || '').toLowerCase();

  if (userRole === 'owner') {
    request.input('ownerId', user.id);
    return `AND c.owner_id = @ownerId`;
  }

  if (userRole === 'staff') {
    request.input('staffId', user.id);
    return `AND c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)`;
  }

  return '';
}

/**
 * [3.1] Lấy danh sách khách hàng ĐÃ TỪNG ĐẶT SÂN thuộc phạm vi quản lý của Owner / Staff.
 * @param {{ id: number, role: string }} user
 * @param {{ search?: string, segment?: string, facilityId?: string }} query
 */
export async function getCustomerList(user, query = {}) {
  const { search = '', segment = 'ALL', facilityId = 'ALL' } = query;
  const pool = await getPool();
  const todayStr = getLocalDateStr();

  const request = pool.request().input('todayStr', todayStr);
  const courtScopeFilter = buildCourtScopeCondition(request, user);

  let facilityClause = '';
  if (facilityId && facilityId !== 'ALL') {
    request.input('facilityId', parseInt(facilityId));
    facilityClause = 'AND c.facility_id = @facilityId';
  }

  let searchClause = '';
  if (search && search.trim()) {
    request.input('search', `%${search.trim().toLowerCase()}%`);
    searchClause = `AND (LOWER(cust.full_name) LIKE @search OR LOWER(ISNULL(cust.email, '')) LIKE @search OR cust.phone LIKE @search)`;
  }

  const sqlQuery = `
    SELECT 
      cust.customer_id,
      cust.user_id,
      cust.full_name,
      cust.phone,
      cust.email,
      cust.status,
      cust.reputation_score,
      cust.created_at,
      COUNT(b.booking_id) AS total_bookings,
      SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
      SUM(CASE WHEN b.status IN ('COMPLETED', 'CONFIRMED', 'CHECKED-IN') THEN 1 ELSE 0 END) AS successful_bookings,
      SUM(CASE WHEN b.status IN ('CONFIRMED', 'CHECKED-IN', 'PENDING') AND b.booking_date >= @todayStr THEN 1 ELSE 0 END) AS active_bookings,
      SUM(CASE WHEN b.status IN ('CONFIRMED', 'CHECKED-IN', 'PENDING') AND b.booking_date = @todayStr THEN 1 ELSE 0 END) AS today_active_bookings,
      SUM(CASE WHEN b.status IN ('CONFIRMED', 'PENDING') AND b.booking_date >= @todayStr AND ISNULL(b.deposit_amount, 0) = 0 THEN 1 ELSE 0 END) AS unpaid_deposit_bookings,
      SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_bookings,
      SUM(CASE WHEN b.status = 'NO-SHOW' THEN 1 ELSE 0 END) AS noshow_bookings,
      SUM(CASE WHEN b.status IN ('COMPLETED', 'CONFIRMED', 'CHECKED-IN') THEN ISNULL(b.total_price, 0) ELSE 0 END) AS total_spent,
      MAX(b.booking_date) AS last_booking_date
    FROM customers cust
    INNER JOIN bookings b ON (
      b.customer_id = cust.customer_id
      OR (b.customer_id IS NULL AND cust.user_id IS NOT NULL AND b.user_id = cust.user_id)
    )
    INNER JOIN courts c ON b.court_id = c.court_id
    WHERE 1=1
      ${courtScopeFilter}
      ${facilityClause}
      ${searchClause}
    GROUP BY 
      cust.customer_id, cust.user_id, cust.full_name, cust.phone, cust.email, cust.status, cust.reputation_score, cust.created_at
    HAVING COUNT(b.booking_id) > 0
    ORDER BY MAX(b.booking_date) DESC, total_spent DESC, total_bookings DESC
  `;

  const result = await request.query(sqlQuery);

  let customers = result.recordset.map((row) => {
    const totalBookings = Number(row.total_bookings || 0);
    const completedBookings = Number(row.completed_bookings || 0);
    const successfulBookings = Number(row.successful_bookings || 0);
    const activeBookings = Number(row.active_bookings || 0);
    const todayActiveBookings = Number(row.today_active_bookings || 0);
    const unpaidDepositBookings = Number(row.unpaid_deposit_bookings || 0);
    const cancelledBookings = Number(row.cancelled_bookings || 0);
    const noShowCount = Number(row.noshow_bookings || 0);
    const totalSpent = Number(row.total_spent || 0);
    const reputationScore = Number(row.reputation_score ?? 5.0);

    const customerSegment = classifyCustomer({
      successfulBookings,
      totalSpent,
      noShowCount,
      cancelledBookings,
      reputationScore,
    });

    return {
      id: row.customer_id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email || '',
      status: (row.status || 'ACTIVE').toUpperCase(),
      reputationScore,
      avatarUrl: null,
      createdAt: row.created_at,
      totalBookings,
      completedBookings,
      activeBookings,
      todayActiveBookings,
      unpaidDepositBookings,
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
 * [3.1] Lấy hồ sơ chi tiết khách hàng kèm toàn bộ lịch sử đặt sân & giao dịch trong phạm vi sân của Owner/Staff.
 * Chống IDOR: Nếu khách hàng không có đơn đặt sân nào thuộc phạm vi sân của người gọi -> trả về 404.
 */
export async function getCustomerHistory(user, customerId) {
  const pool = await getPool();

  const custRes = await pool
    .request()
    .input('customerId', customerId)
    .query(`
      SELECT customer_id, user_id, full_name, phone, email, status, reputation_score, notes, created_at
      FROM customers
      WHERE customer_id = @customerId
    `);

  const customer = custRes.recordset[0];
  if (!customer) {
    throw new AppError('Không tìm thấy thông tin khách hàng.', 404);
  }

  const historyReq = pool
    .request()
    .input('customerId', customerId)
    .input('linkedUserId', customer.user_id || null);
  const scopeClause = buildCourtScopeCondition(historyReq, user);

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
      c.facility_id,
      f.name AS facility_name,
      s.sport_name,
      (
        SELECT TOP 1 t.payment_method 
        FROM transactions t 
        WHERE t.booking_id = b.booking_id AND t.status = 'SUCCESS'
        ORDER BY t.created_at DESC
      ) AS payment_method,
      (
        SELECT SUM(CASE WHEN t.transaction_type = 'REFUND' THEN -t.amount ELSE t.amount END)
        FROM transactions t
        WHERE t.booking_id = b.booking_id AND t.status = 'SUCCESS'
      ) AS paid_amount
    FROM bookings b
    JOIN courts c ON b.court_id = c.court_id
    LEFT JOIN facilities f ON c.facility_id = f.facility_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    WHERE (
      b.customer_id = @customerId
      OR (@linkedUserId IS NOT NULL AND b.customer_id IS NULL AND b.user_id = @linkedUserId)
    )
      ${scopeClause}
    ORDER BY b.booking_date DESC, b.start_time DESC
  `);

  // Chống IDOR: nếu không phải admin và khách không có bất kỳ đơn nào trong phạm vi sân của Owner/Staff
  if (
    (user.role || '').toLowerCase() !== 'admin' &&
    bookingsRes.recordset.length === 0
  ) {
    throw new AppError(
      'Khách hàng này không có lịch sử đặt sân tại cơ sở của bạn.',
      404
    );
  }

  const bookings = bookingsRes.recordset.map((b) => {
    const totalPrice = Number(b.total_price || 0);
    const depositAmount = Number(b.deposit_amount || 0);
    const status = (b.status || 'PENDING').toUpperCase();
    const rawPaid =
      b.paid_amount !== null && b.paid_amount !== undefined
        ? Number(b.paid_amount)
        : depositAmount;
    const paidAmount =
      status === 'COMPLETED' ? Math.max(totalPrice, rawPaid) : Math.max(depositAmount, rawPaid);
    const remainingAmount =
      status === 'COMPLETED' || status === 'CANCELLED'
        ? 0
        : Math.max(0, totalPrice - paidAmount);

    return {
      bookingId: b.booking_id,
      courtId: b.court_id,
      facilityId: b.facility_id,
      facilityName: b.facility_name || 'Cơ sở chính',
      courtName: b.court_name,
      courtAddress: b.court_address,
      sportName: b.sport_name || 'Thể thao',
      bookingDate: formatDateStr(b.booking_date),
      startTime: formatTimeStr(b.start_time),
      endTime: formatTimeStr(b.end_time),
      totalPrice,
      depositAmount,
      paidAmount,
      remainingAmount,
      paymentMethod: b.payment_method || 'CASH',
      status,
      createdAt: b.created_at,
    };
  });

  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED').length;
  const successfulBookings = bookings.filter((b) =>
    ['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(b.status)
  ).length;
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED').length;
  const noShowCount = bookings.filter((b) => b.status === 'NO-SHOW').length;
  const totalSpent = bookings
    .filter((b) => ['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(b.status))
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return {
    customer: {
      id: customer.customer_id,
      userId: customer.user_id,
      fullName: customer.full_name,
      phone: customer.phone,
      email: customer.email || '',
      status: (customer.status || 'ACTIVE').toUpperCase(),
      reputationScore: Number(customer.reputation_score ?? 5.0),
      avatarUrl: null,
      createdAt: customer.created_at,
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowCount,
      totalSpent,
      segment: classifyCustomer({
        successfulBookings,
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
 * Cập nhật điểm uy tín hoặc khóa/mở khóa khách hàng trong bảng [customers] (đồng bộ sang [users] nếu có).
 * Kiểm tra quyền sở hữu: Chỉ Owner có khách đặt sân tại cơ sở của mình mới được phép cập nhật.
 */
export async function updateCustomerReputation(user, customerId, data) {
  const { reputationScore, status } = data;
  const pool = await getPool();

  // Kiểm tra khách hàng tồn tại và có đặt sân thuộc quyền quản lý của Owner
  const custCheck = await pool
    .request()
    .input('customerId', customerId)
    .query('SELECT customer_id, user_id FROM customers WHERE customer_id = @customerId');

  if (custCheck.recordset.length === 0) {
    throw new AppError('Không tìm thấy khách hàng.', 404);
  }

  const linkedUserId = custCheck.recordset[0].user_id || null;
  if ((user.role || '').toLowerCase() === 'owner') {
    const scopeCheck = await pool
      .request()
      .input('customerId', customerId)
      .input('linkedUserId', linkedUserId)
      .input('ownerId', user.id)
      .query(`
        SELECT TOP 1 b.booking_id
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        WHERE c.owner_id = @ownerId
          AND (
            b.customer_id = @customerId
            OR (@linkedUserId IS NOT NULL AND b.customer_id IS NULL AND b.user_id = @linkedUserId)
          )
      `);

    if (scopeCheck.recordset.length === 0) {
      throw new AppError(
        'Bạn không có quyền khóa hoặc thay đổi điểm uy tín của khách hàng thuộc chủ sân khác.',
        403
      );
    }
  }

  const req = pool.request().input('customerId', customerId);
  const fields = [];
  let normalizedScore;
  let normalizedStatus;

  if (reputationScore !== undefined) {
    normalizedScore = Math.max(1.0, Math.min(5.0, Number(reputationScore)));
    req.input('score', normalizedScore);
    fields.push('reputation_score = @score');
  }

  if (status && ['ACTIVE', 'LOCKED'].includes(status.toUpperCase())) {
    normalizedStatus = status.toUpperCase();
    req.input('status', normalizedStatus);
    fields.push('status = @status');
  }

  if (fields.length === 0) {
    throw new AppError('Không có thông tin cần cập nhật.', 400);
  }

  fields.push('updated_at = GETDATE()');

  const res = await req.query(`
    UPDATE customers
    SET ${fields.join(', ')}
    OUTPUT INSERTED.customer_id AS id, INSERTED.user_id AS userId, INSERTED.full_name, INSERTED.reputation_score, INSERTED.status
    WHERE customer_id = @customerId
  `);

  const updated = res.recordset[0];

  // Đồng bộ trạng thái khóa và điểm uy tín sang bảng [users] nếu khách có tài khoản ứng dụng
  if (linkedUserId) {
    const userReq = pool.request().input('uid', linkedUserId);
    const userFields = [];
    if (normalizedScore !== undefined) {
      userReq.input('score', normalizedScore);
      userFields.push('reputation_score = @score');
    }
    if (normalizedStatus !== undefined) {
      userReq.input('status', normalizedStatus);
      userFields.push('status = @status');
    }
    if (userFields.length > 0) {
      await userReq.query(`UPDATE users SET ${userFields.join(', ')} WHERE user_id = @uid`);
    }
  }

  return updated;
}

