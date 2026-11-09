import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';
import bcrypt from 'bcrypt';

/**
 * Chuẩn hóa kiểu TIME của SQL Server hoặc chuỗi giờ về dạng "HH:mm".
 */
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

/**
 * Chuẩn hóa kiểu DATE của SQL Server về dạng "YYYY-MM-DD".
 */
function formatDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val).slice(0, 10);
}

/**
 * Chuyển chuỗi "HH:mm" thành số phút tính từ 00:00.
 */
function timeToMinutes(t) {
  const [h, m] = formatTimeStr(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Tính giá động dựa trên bảng court_prices (hỗ trợ tách biên khung giờ - TC01).
 * @param {Array<{ day_type: string, start_time: any, end_time: any, price: number }>} priceRules
 * @param {string} bookingDate - YYYY-MM-DD
 * @param {string} startTime - HH:mm
 * @param {string} endTime - HH:mm
 * @param {boolean} isHoliday
 */
export function calculateDynamicPrice(priceRules, bookingDate, startTime, endTime, isHoliday = false) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (endMin <= startMin) {
    throw new AppError('Giờ kết thúc phải lớn hơn giờ bắt đầu.', 400);
  }

  const dateObj = new Date(`${bookingDate}T00:00:00`);
  const dayOfWeek = dateObj.getDay(); // 0: CN, 6: Thứ 7
  const dayType = isHoliday
    ? 'HOLIDAY'
    : dayOfWeek === 0 || dayOfWeek === 6
      ? 'WEEKEND'
      : 'WEEKDAY';

  // Lọc các quy tắc giá theo dayType (nếu không có thì fallback về WEEKDAY)
  let applicableRules = (priceRules || []).filter(
    (r) => (r.day_type || '').toUpperCase() === dayType
  );
  if (applicableRules.length === 0) {
    applicableRules = (priceRules || []).filter(
      (r) => (r.day_type || '').toUpperCase() === 'WEEKDAY'
    );
  }

  // Nếu sân chưa cấu hình bảng giá, mặc định 200,000đ/giờ
  if (applicableRules.length === 0) {
    const hours = (endMin - startMin) / 60;
    return Math.round(hours * 200000);
  }

  let total = 0;
  // Duyệt từng bước 30 phút để tính chính xác khi vắt qua biên khung giờ (TC01)
  const step = 30;
  for (let cur = startMin; cur < endMin; cur += step) {
    const slotMid = cur + step / 2;
    const matchedRule = applicableRules.find((r) => {
      const rStart = timeToMinutes(r.start_time);
      const rEnd = timeToMinutes(r.end_time);
      return slotMid >= rStart && slotMid <= rEnd;
    });
    const hourlyRate = matchedRule ? Number(matchedRule.price) : Number(applicableRules[0].price);
    total += hourlyRate * (step / 60);
  }

  return Math.round(total);
}

/**
 * Lấy danh sách booking dựa theo vai trò của người dùng (RBAC Data Scoping).
 * @param {{ id: number, role: string }} user
 */
export async function getBookingsByUser(user) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  if (userRole === 'admin') {
    const result = await pool.request().query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address,
             u.full_name AS player_name, u.email AS player_email, u.phone AS player_phone
      FROM bookings b
      LEFT JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN users u ON b.user_id = u.user_id
      ORDER BY b.booking_date DESC, b.start_time ASC
    `);
    return result.recordset;
  }

  if (userRole === 'owner') {
    const result = await pool.request()
      .input('ownerId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               c.court_name, c.address AS court_address,
               u.full_name AS player_name, u.email AS player_email, u.phone AS player_phone
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        LEFT JOIN users u ON b.user_id = u.user_id
        WHERE c.owner_id = @ownerId
        ORDER BY b.booking_date DESC, b.start_time ASC
      `);
    return result.recordset;
  }

  if (userRole === 'staff') {
    const result = await pool.request()
      .input('staffId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               c.court_name, c.address AS court_address,
               u.full_name AS player_name, u.email AS player_email, u.phone AS player_phone
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        JOIN court_staff cs ON cs.court_id = c.court_id AND cs.staff_id = @staffId
        LEFT JOIN users u ON b.user_id = u.user_id
        ORDER BY b.booking_date DESC, b.start_time ASC
      `);
    return result.recordset;
  }

  const result = await pool.request()
    .input('userId', user.id)
    .query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      WHERE b.user_id = @userId
      ORDER BY b.booking_date DESC, b.start_time ASC
    `);
  return result.recordset;
}

/**
 * [3.1] Lấy dữ liệu Lịch sân theo Ngày / Tuần / Tháng (trống / đã đặt / bảo trì).
 * Hỗ trợ lọc theo khoảng ngày (startDate, endDate), sân (courtId), môn thể thao (sportId), trạng thái (status).
 * @param {{ id: number, role: string }} user
 * @param {{ startDate?: string, endDate?: string, courtId?: string, sportId?: string, status?: string }} query
 */
export async function getScheduleData(user, query = {}) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  const todayStr = new Date().toISOString().split('T')[0];
  const startDate = query.startDate || todayStr;
  const endDate = query.endDate || startDate;
  const courtId = query.courtId && query.courtId !== 'ALL' ? parseInt(query.courtId) : null;
  const sportId = query.sportId && query.sportId !== 'ALL' ? parseInt(query.sportId) : null;
  const statusFilter = query.status && query.status !== 'ALL' ? query.status.toUpperCase() : null;

  // 1. Lấy danh sách các môn thể thao
  const sportsResult = await pool.request().query(`
    SELECT sport_id, sport_name, description FROM sports ORDER BY sport_id ASC
  `);

  // 2. Lấy danh sách các sân thuộc quyền quản lý của Owner / Staff / Admin
  const courtReq = pool.request();
  let courtSql = `
    SELECT c.court_id, c.owner_id, c.sport_id, c.court_name, c.address, c.status, c.utilities,
           s.sport_name
    FROM courts c
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    WHERE 1=1
  `;

  if (userRole === 'owner') {
    courtReq.input('ownerId', user.id);
    courtSql += ` AND c.owner_id = @ownerId`;
  } else if (userRole === 'staff') {
    courtReq.input('staffId', user.id);
    courtSql += ` AND c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)`;
  }

  if (sportId) {
    courtReq.input('sportId', sportId);
    courtSql += ` AND c.sport_id = @sportId`;
  }

  courtSql += ` ORDER BY c.court_id ASC`;
  const courtsResult = await courtReq.query(courtSql);
  const allCourts = courtsResult.recordset;

  const filteredCourts = courtId
    ? allCourts.filter((c) => c.court_id === courtId)
    : allCourts;

  const courtIds = filteredCourts.map((c) => c.court_id);

  if (courtIds.length === 0) {
    return {
      startDate,
      endDate,
      sports: sportsResult.recordset.map((s) => ({
        sportId: s.sport_id,
        sportName: s.sport_name,
      })),
      courts: allCourts.map((c) => ({
        courtId: c.court_id,
        courtName: c.court_name,
        sportId: c.sport_id,
        sportName: c.sport_name || 'Thể thao',
        address: c.address,
        status: c.status || 'ACTIVE',
        prices: [],
      })),
      bookings: [],
      maintenances: [],
    };
  }

  // 3. Lấy bảng giá động của các sân
  const pricesResult = await pool.request().query(`
    SELECT price_id, court_id, day_type, start_time, end_time, price
    FROM court_prices
    WHERE court_id IN (${courtIds.join(',')})
    ORDER BY start_time ASC
  `);

  const priceMap = {};
  pricesResult.recordset.forEach((p) => {
    if (!priceMap[p.court_id]) priceMap[p.court_id] = [];
    priceMap[p.court_id].push({
      priceId: p.price_id,
      dayType: p.day_type,
      startTime: formatTimeStr(p.start_time),
      endTime: formatTimeStr(p.end_time),
      price: Number(p.price),
    });
  });

  // 4. Lấy danh sách bookings trong khoảng [startDate, endDate]
  const bookingReq = pool.request()
    .input('startDate', startDate)
    .input('endDate', endDate);

  let bookingSql = `
    SELECT b.booking_id, b.court_id, b.user_id, b.match_id,
           b.booking_date, b.start_time, b.end_time,
           b.total_price, b.deposit_amount, b.status, b.created_at,
           c.court_name, c.sport_id, s.sport_name,
           u.full_name AS player_name, u.phone AS player_phone, u.email AS player_email, u.reputation_score
    FROM bookings b
    JOIN courts c ON b.court_id = c.court_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    LEFT JOIN users u ON b.user_id = u.user_id
    WHERE b.court_id IN (${courtIds.join(',')})
      AND b.booking_date >= @startDate
      AND b.booking_date <= @endDate
  `;

  if (statusFilter) {
    bookingReq.input('statusFilter', statusFilter);
    bookingSql += ` AND UPPER(b.status) = @statusFilter`;
  }

  bookingSql += ` ORDER BY b.booking_date ASC, b.start_time ASC`;
  const bookingsResult = await bookingReq.query(bookingSql);

  // 5. Lấy danh sách lịch bảo trì (court_maintenances) giao với khoảng ngày
  const maintResult = await pool.request()
    .input('startDt', `${startDate}T00:00:00`)
    .input('endDt', `${endDate}T23:59:59`)
    .query(`
      SELECT m.maintenance_id, m.court_id, m.start_time, m.end_time, m.reason, c.court_name
      FROM court_maintenances m
      JOIN courts c ON m.court_id = c.court_id
      WHERE m.court_id IN (${courtIds.join(',')})
        AND m.start_time <= @endDt
        AND m.end_time >= @startDt
      ORDER BY m.start_time ASC
    `);

  return {
    startDate,
    endDate,
    sports: sportsResult.recordset.map((s) => ({
      sportId: s.sport_id,
      sportName: s.sport_name,
    })),
    courts: allCourts.map((c) => ({
      courtId: c.court_id,
      courtName: c.court_name,
      sportId: c.sport_id,
      sportName: c.sport_name || 'Thể thao',
      address: c.address,
      status: c.status || 'ACTIVE',
      prices: priceMap[c.court_id] || [],
    })),
    bookings: bookingsResult.recordset.map((b) => ({
      bookingId: b.booking_id,
      courtId: b.court_id,
      courtName: b.court_name,
      sportId: b.sport_id,
      sportName: b.sport_name || 'Thể thao',
      userId: b.user_id,
      matchId: b.match_id,
      playerName: b.player_name || 'Khách vãng lai',
      playerPhone: b.player_phone || '',
      playerEmail: b.player_email || '',
      reputationScore: b.reputation_score ?? 5.0,
      bookingDate: formatDateStr(b.booking_date),
      startTime: formatTimeStr(b.start_time),
      endTime: formatTimeStr(b.end_time),
      totalPrice: Number(b.total_price || 0),
      depositAmount: Number(b.deposit_amount || 0),
      status: (b.status || 'PENDING').toUpperCase(),
      createdAt: b.created_at,
    })),
    maintenances: maintResult.recordset.map((m) => ({
      maintenanceId: m.maintenance_id,
      courtId: m.court_id,
      courtName: m.court_name,
      date: formatDateStr(m.start_time),
      startTime: formatTimeStr(m.start_time),
      endTime: formatTimeStr(m.end_time),
      startDateTime: m.start_time,
      endDateTime: m.end_time,
      reason: m.reason || 'Bảo trì định kỳ',
    })),
  };
}

/**
 * Lấy thông tin một booking theo ID.
 * @param {number} bookingId
 */
export async function getBookingById(bookingId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', bookingId)
    .query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address, c.owner_id,
             u.full_name AS player_name, u.email AS player_email, u.phone AS player_phone
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = @id
    `);
  return result.recordset[0] || null;
}

/**
 * Tạo mới một booking (có kiểm tra trùng lịch và tính giá động).
 */
export async function createBooking(data) {
  const {
    courtId,
    userId,
    bookingDate,
    startTime,
    endTime,
    totalPrice,
    depositAmount = 0,
    status = 'PENDING',
    customerName,
    customerPhone,
    customerEmail,
  } = data;

  if (!courtId || !startTime || !endTime) {
    throw new AppError('Vui lòng chọn sân, giờ bắt đầu và giờ kết thúc.', 400);
  }

  const cleanDate = bookingDate || new Date().toISOString().split('T')[0];
  const cleanStart = formatTimeStr(startTime);
  const cleanEnd = formatTimeStr(endTime);

  if (timeToMinutes(cleanEnd) <= timeToMinutes(cleanStart)) {
    throw new AppError('Giờ kết thúc phải lớn hơn giờ bắt đầu.', 400);
  }

  const pool = await getPool();

  // 1. Kiểm tra sân có tồn tại và đang hoạt động không
  const courtRes = await pool.request()
    .input('courtId', courtId)
    .query('SELECT court_id, court_name, status FROM courts WHERE court_id = @courtId');

  const court = courtRes.recordset[0];
  if (!court) {
    throw new AppError('Không tìm thấy sân thể thao này.', 404);
  }
  if ((court.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
    throw new AppError(`Sân "${court.court_name}" hiện đang ngưng hoạt động hoặc bảo trì.`, 400);
  }

  // 2. Kiểm tra xung đột với đơn đặt sân đã có (chống đặt trùng lịch - R01)
  const conflictRes = await pool.request()
    .input('courtId', courtId)
    .input('bookingDate', cleanDate)
    .input('startTime', `${cleanStart}:00`)
    .input('endTime', `${cleanEnd}:00`)
    .query(`
      SELECT booking_id, start_time, end_time, status
      FROM bookings
      WHERE court_id = @courtId
        AND booking_date = @bookingDate
        AND status NOT IN ('CANCELLED')
        AND start_time < CAST(@endTime AS TIME)
        AND end_time > CAST(@startTime AS TIME)
    `);

  if (conflictRes.recordset.length > 0) {
    const c = conflictRes.recordset[0];
    throw new AppError(
      `Khung giờ ${cleanStart} - ${cleanEnd} ngày ${cleanDate} đã có lịch đặt (${formatTimeStr(c.start_time)} - ${formatTimeStr(c.end_time)}). Vui lòng chọn khung giờ khác.`,
      409
    );
  }

  // 3. Kiểm tra xung đột với lịch bảo trì sân
  const maintConflict = await pool.request()
    .input('courtId', courtId)
    .input('startDt', `${cleanDate}T${cleanStart}:00`)
    .input('endDt', `${cleanDate}T${cleanEnd}:00`)
    .query(`
      SELECT maintenance_id, reason
      FROM court_maintenances
      WHERE court_id = @courtId
        AND start_time < @endDt
        AND end_time > @startDt
    `);

  if (maintConflict.recordset.length > 0) {
    throw new AppError(
      `Sân đang có lịch bảo trì trong khung giờ này (${maintConflict.recordset[0].reason || 'Bảo trì'}).`,
      409
    );
  }

  // 4. Xác định user_id (Nếu chủ sân/nhân viên đặt hộ khách vãng lai qua SĐT)
  let targetUserId = userId;
  if (customerPhone && customerPhone.trim()) {
    const cleanPhone = customerPhone.trim();
    const existingCustomer = await pool.request()
      .input('phone', cleanPhone)
      .query('SELECT user_id FROM users WHERE phone = @phone');

    if (existingCustomer.recordset.length > 0) {
      targetUserId = existingCustomer.recordset[0].user_id;
    } else {
      const hashed = await bcrypt.hash('password123', 10);
      const guestEmail =
        customerEmail && customerEmail.trim()
          ? customerEmail.trim().toLowerCase()
          : `guest_${cleanPhone}_${Date.now()}@sportlink.vn`;
      const guestName = customerName && customerName.trim() ? customerName.trim() : `Khách ${cleanPhone}`;

      const newGuest = await pool.request()
        .input('fullName', guestName)
        .input('phone', cleanPhone)
        .input('email', guestEmail)
        .input('password', hashed)
        .query(`
          INSERT INTO users (full_name, phone, email, password_hash, role, status, reputation_score, created_at)
          OUTPUT INSERTED.user_id
          VALUES (@fullName, @phone, @email, @password, 'PLAYER', 'ACTIVE', 5.0, GETDATE())
        `);
      targetUserId = newGuest.recordset[0].user_id;
    }
  }

  // 5. Tính toán tổng tiền tự động nếu không truyền totalPrice
  let finalPrice = Number(totalPrice);
  if (!finalPrice || finalPrice <= 0) {
    const priceRulesRes = await pool.request()
      .input('courtId', courtId)
      .query('SELECT day_type, start_time, end_time, price FROM court_prices WHERE court_id = @courtId');
    finalPrice = calculateDynamicPrice(
      priceRulesRes.recordset,
      cleanDate,
      cleanStart,
      cleanEnd
    );
  }

  const cleanStatus = ['PENDING', 'CONFIRMED', 'CHECKED-IN', 'COMPLETED'].includes(
    (status || '').toUpperCase()
  )
    ? status.toUpperCase()
    : 'CONFIRMED';

  const finalDeposit = Number(depositAmount || 0);

  const result = await pool.request()
    .input('courtId', courtId)
    .input('userId', targetUserId)
    .input('bookingDate', cleanDate)
    .input('startTime', `${cleanStart}:00`)
    .input('endTime', `${cleanEnd}:00`)
    .input('totalPrice', finalPrice)
    .input('depositAmount', finalDeposit)
    .input('status', cleanStatus)
    .query(`
      INSERT INTO bookings (court_id, user_id, booking_date, start_time, end_time, total_price, deposit_amount, status, created_at)
      OUTPUT INSERTED.*
      VALUES (@courtId, @userId, @bookingDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @totalPrice, @depositAmount, @status, GETDATE())
    `);

  const created = result.recordset[0];

  // Ghi nhận giao dịch tiền cọc hoặc thanh toán nếu có
  if (finalDeposit > 0 || cleanStatus === 'COMPLETED') {
    const txAmount = cleanStatus === 'COMPLETED' ? finalPrice : finalDeposit;
    const txType = cleanStatus === 'COMPLETED' ? 'FULL_PAYMENT' : 'DEPOSIT';
    await pool.request()
      .input('bookingId', created.booking_id)
      .input('userId', targetUserId)
      .input('amount', txAmount)
      .input('txType', txType)
      .query(`
        INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, created_at)
        VALUES (@bookingId, @userId, @amount, @txType, 'CASH', 'SUCCESS', GETDATE())
      `);
  }

  return created;
}

/**
 * Cập nhật trạng thái booking (PENDING, CONFIRMED, CHECKED-IN, COMPLETED, CANCELLED, NO-SHOW).
 * @param {number} bookingId
 * @param {{ status: string, depositAmount?: number, paymentMethod?: string }} data
 */
export async function updateBooking(bookingId, data) {
  const cleanStatus = (data.status || '').toUpperCase();
  const validStatuses = ['PENDING', 'CONFIRMED', 'CHECKED-IN', 'COMPLETED', 'CANCELLED', 'NO-SHOW'];
  if (!validStatuses.includes(cleanStatus)) {
    throw new AppError('Trạng thái đơn đặt sân không hợp lệ.', 400);
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('id', bookingId)
    .input('status', cleanStatus)
    .query(`
      UPDATE bookings
      SET status = @status
      OUTPUT INSERTED.*
      WHERE booking_id = @id
    `);

  const updated = result.recordset[0];
  if (!updated) {
    throw new AppError('Không tìm thấy đơn đặt sân.', 404);
  }

  // Nếu chuyển sang COMPLETED, tự động ghi nhận giao dịch FULL_PAYMENT nếu chưa có
  if (cleanStatus === 'COMPLETED') {
    const existingTx = await pool.request()
      .input('bookingId', bookingId)
      .query(`SELECT transaction_id FROM transactions WHERE booking_id = @bookingId AND transaction_type = 'FULL_PAYMENT'`);

    if (existingTx.recordset.length === 0) {
      const method = ['MOMO', 'VNPAY', 'BANK_TRANSFER', 'CASH'].includes(
        (data.paymentMethod || '').toUpperCase()
      )
        ? data.paymentMethod.toUpperCase()
        : 'CASH';

      await pool.request()
        .input('bookingId', bookingId)
        .input('userId', updated.user_id)
        .input('amount', updated.total_price)
        .input('method', method)
        .query(`
          INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, created_at)
          VALUES (@bookingId, @userId, @amount, 'FULL_PAYMENT', @method, 'SUCCESS', GETDATE())
        `);
    }
  }

  return updated;
}

/**
 * Thêm lịch bảo trì cho sân (Khóa khung giờ trên lịch sân).
 */
export async function createMaintenance(user, data) {
  const { courtId, date, startTime, endTime, reason } = data;
  if (!courtId || !date || !startTime || !endTime) {
    throw new AppError('Vui lòng nhập đầy đủ sân, ngày và khung giờ bảo trì.', 400);
  }

  const cleanStart = formatTimeStr(startTime);
  const cleanEnd = formatTimeStr(endTime);
  if (timeToMinutes(cleanEnd) <= timeToMinutes(cleanStart)) {
    throw new AppError('Giờ kết thúc bảo trì phải lớn hơn giờ bắt đầu.', 400);
  }

  const pool = await getPool();
  const courtCheck = await pool.request()
    .input('courtId', courtId)
    .query('SELECT court_id, owner_id FROM courts WHERE court_id = @courtId');

  if (courtCheck.recordset.length === 0) {
    throw new AppError('Không tìm thấy sân thể thao.', 404);
  }

  if ((user.role || '').toLowerCase() === 'owner' && courtCheck.recordset[0].owner_id !== user.id) {
    throw new AppError('Bạn không có quyền đặt lịch bảo trì cho sân của chủ sân khác.', 403);
  }

  const startDt = `${date}T${cleanStart}:00`;
  const endDt = `${date}T${cleanEnd}:00`;

  const result = await pool.request()
    .input('courtId', courtId)
    .input('startDt', startDt)
    .input('endDt', endDt)
    .input('reason', reason || 'Bảo trì định kỳ')
    .query(`
      INSERT INTO court_maintenances (court_id, start_time, end_time, reason)
      OUTPUT INSERTED.*
      VALUES (@courtId, @startDt, @endDt, @reason)
    `);

  return result.recordset[0];
}

/**
 * Xóa lịch bảo trì sân.
 */
export async function deleteMaintenance(user, maintenanceId) {
  const pool = await getPool();
  const check = await pool.request()
    .input('id', maintenanceId)
    .query(`
      SELECT m.maintenance_id, c.owner_id
      FROM court_maintenances m
      JOIN courts c ON m.court_id = c.court_id
      WHERE m.maintenance_id = @id
    `);

  if (check.recordset.length === 0) {
    throw new AppError('Không tìm thấy lịch bảo trì này.', 404);
  }

  if ((user.role || '').toLowerCase() === 'owner' && check.recordset[0].owner_id !== user.id) {
    throw new AppError('Bạn không có quyền xóa lịch bảo trì của chủ sân khác.', 403);
  }

  await pool.request()
    .input('id', maintenanceId)
    .query('DELETE FROM court_maintenances WHERE maintenance_id = @id');
}

/**
 * Xóa (hủy) một booking.
 * @param {number} bookingId
 */
export async function deleteBooking(bookingId) {
  const pool = await getPool();
  await pool.request()
    .input('id', bookingId)
    .query('DELETE FROM bookings WHERE booking_id = @id');
}
