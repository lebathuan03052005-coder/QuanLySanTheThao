import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * Lấy chuỗi ngày hiện tại theo giờ địa phương "YYYY-MM-DD".
 */
export function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Chuẩn hóa kiểu TIME của SQL Server hoặc chuỗi giờ về dạng "HH:mm".
 */
export function formatTimeStr(val) {
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
export function formatDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

/**
 * Chuyển chuỗi "HH:mm" thành số phút tính từ 00:00.
 */
export function timeToMinutes(t) {
  const [h, m] = formatTimeStr(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Kiểm tra một ngày "YYYY-MM-DD" có phải ngày lễ cố định tại Việt Nam không.
 */
export function isVietnameseHoliday(bookingDate) {
  if (!bookingDate) return false;
  const mmdd = String(bookingDate).slice(5, 10);
  const fixedHolidays = ['01-01', '04-30', '05-01', '09-02'];
  return fixedHolidays.includes(mmdd);
}

/**
 * Tính giá động dựa trên bảng court_prices (hỗ trợ tách biên khung giờ - TC01).
 * Giờ mở cửa tiêu chuẩn của hệ thống: 06:00 – 23:00.
 * @param {Array<{ day_type: string, start_time: any, end_time: any, price: number }>} priceRules
 * @param {string} bookingDate - YYYY-MM-DD
 * @param {string} startTime - HH:mm
 * @param {string} endTime - HH:mm
 * @param {boolean} isHoliday
 */
export function calculateDynamicPrice(
  priceRules,
  bookingDate,
  startTime,
  endTime,
  isHoliday = false
) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (endMin <= startMin) {
    throw new AppError('Giờ kết thúc phải lớn hơn giờ bắt đầu.', 400);
  }

  // Kiểm tra khung giờ nằm trong giờ mở cửa (06:00 - 23:00)
  const OPEN_MIN = 6 * 60; // 06:00
  const CLOSE_MIN = 23 * 60; // 23:00
  if (startMin < OPEN_MIN || endMin > CLOSE_MIN) {
    throw new AppError(
      'Khung giờ đặt sân nằm ngoài giờ mở cửa (Hệ thống hoạt động từ 06:00 đến 23:00).',
      400
    );
  }

  const dateObj = new Date(`${bookingDate}T00:00:00`);
  const dayOfWeek = dateObj.getDay(); // 0: CN, 6: Thứ 7
  const holidayFlag = Boolean(isHoliday) || isVietnameseHoliday(bookingDate);
  const targetDayType = holidayFlag
    ? 'HOLIDAY'
    : dayOfWeek === 0 || dayOfWeek === 6
      ? 'WEEKEND'
      : 'NORMAL';

  // Lọc các quy tắc giá theo targetDayType (hỗ trợ cả NORMAL và WEEKDAY)
  let applicableRules = (priceRules || []).filter((r) => {
    const rDt = (r.day_type || r.dayType || '').toUpperCase();
    if (targetDayType === 'NORMAL') {
      return rDt === 'NORMAL' || rDt === 'WEEKDAY';
    }
    return rDt === targetDayType;
  });

  if (applicableRules.length === 0) {
    applicableRules = (priceRules || []).filter((r) => {
      const rDt = (r.day_type || r.dayType || '').toUpperCase();
      return rDt === 'NORMAL' || rDt === 'WEEKDAY';
    });
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
      const rStart = timeToMinutes(r.start_time ?? r.startTime);
      const rEnd = timeToMinutes(r.end_time ?? r.endTime);
      return slotMid >= rStart && slotMid <= rEnd;
    });
    const hourlyRate = matchedRule
      ? Number(matchedRule.price)
      : Number(applicableRules[applicableRules.length - 1].price);
    total += hourlyRate * (step / 60);
  }

  return Math.round(total);
}

/**
 * Lấy danh sách booking dựa theo vai trò của người dùng (Strict RBAC Data Scoping).
 * @param {{ id: number, role: string }} user
 */
export async function getBookingsByUser(user) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  if (userRole === 'admin') {
    const result = await pool.request().query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address, c.facility_id, f.name AS facility_name,
             COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
             COALESCE(cust.email, u.email, '') AS player_email,
             COALESCE(cust.phone, u.phone, '') AS player_phone
      FROM bookings b
      LEFT JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      LEFT JOIN customers cust ON b.customer_id = cust.customer_id
      LEFT JOIN users u ON b.user_id = u.user_id
      ORDER BY b.booking_date DESC, b.start_time ASC
    `);
    return result.recordset;
  }

  if (userRole === 'owner') {
    const result = await pool
      .request()
      .input('ownerId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               c.court_name, c.address AS court_address, c.facility_id, f.name AS facility_name,
               COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
               COALESCE(cust.email, u.email, '') AS player_email,
               COALESCE(cust.phone, u.phone, '') AS player_phone
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        LEFT JOIN customers cust ON b.customer_id = cust.customer_id
        LEFT JOIN users u ON b.user_id = u.user_id
        WHERE c.owner_id = @ownerId
        ORDER BY b.booking_date DESC, b.start_time ASC
      `);
    return result.recordset;
  }

  if (userRole === 'staff') {
    const result = await pool
      .request()
      .input('staffId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               c.court_name, c.address AS court_address, c.facility_id, f.name AS facility_name,
               COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
               COALESCE(cust.email, u.email, '') AS player_email,
               COALESCE(cust.phone, u.phone, '') AS player_phone
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        LEFT JOIN customers cust ON b.customer_id = cust.customer_id
        LEFT JOIN users u ON b.user_id = u.user_id
        WHERE c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)
        ORDER BY b.booking_date DESC, b.start_time ASC
      `);
    return result.recordset;
  }

  const result = await pool
    .request()
    .input('userId', user.id)
    .query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address, c.facility_id, f.name AS facility_name
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      WHERE b.user_id = @userId
      ORDER BY b.booking_date DESC, b.start_time ASC
    `);
  return result.recordset;
}

/**
 * [3.1] Lấy dữ liệu Lịch sân theo Ngày / Tuần / Tháng (trống / đã đặt / bảo trì).
 * Hỗ trợ lọc theo khoảng ngày (startDate, endDate), cơ sở (facilityId), sân con (courtId), môn thể thao (sportId), trạng thái (status).
 * Cô lập dữ liệu nghiêm ngặt theo owner_id (OWNER) và court_staff (STAFF).
 */
export async function getScheduleData(user, query = {}) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  const todayStr = getLocalDateStr();
  const startDate = query.startDate || todayStr;
  const endDate = query.endDate || startDate;
  const facilityId =
    query.facilityId && query.facilityId !== 'ALL' ? parseInt(query.facilityId) : null;
  const courtId = query.courtId && query.courtId !== 'ALL' ? parseInt(query.courtId) : null;
  const sportId = query.sportId && query.sportId !== 'ALL' ? parseInt(query.sportId) : null;
  const statusFilter =
    query.status && query.status !== 'ALL' ? query.status.toUpperCase() : null;

  // 1. Lấy danh sách các môn thể thao
  const sportsResult = await pool.request().query(`
    SELECT sport_id, sport_name, description
    FROM sports
    WHERE status = 'ACTIVE' AND owner_id IS NULL
    ORDER BY sport_id ASC
  `);

  // 2. Lấy danh sách các sân thuộc quyền quản lý của Owner / Staff / Admin (Strict Scoping)
  const courtReq = pool.request();
  let courtSql = `
    SELECT c.court_id, c.facility_id, c.owner_id, c.sport_id, c.court_name, c.address, c.status, c.utilities,
           s.sport_name,
           f.name AS facility_name
    FROM courts c
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    LEFT JOIN facilities f ON c.facility_id = f.facility_id
    WHERE 1=1
  `;

  if (userRole === 'owner') {
    courtReq.input('ownerId', user.id);
    courtSql += ` AND c.owner_id = @ownerId`;
  } else if (userRole === 'staff') {
    courtReq.input('staffId', user.id);
    courtSql += ` AND c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)`;
  }

  if (facilityId) {
    courtReq.input('facilityId', facilityId);
    courtSql += ` AND c.facility_id = @facilityId`;
  }

  if (sportId) {
    courtReq.input('sportId', sportId);
    courtSql += ` AND c.sport_id = @sportId`;
  }

  courtSql += ` ORDER BY c.facility_id ASC, c.court_id ASC`;
  const courtsResult = await courtReq.query(courtSql);
  const allCourts = courtsResult.recordset;

  // Tạo danh sách cơ sở từ các sân thuộc phạm vi quản lý
  const facilityMap = new Map();
  if (userRole === 'owner') {
    const facRes = await pool
      .request()
      .input('ownerId', user.id)
      .query(
        'SELECT facility_id, name, address, status FROM facilities WHERE owner_id = @ownerId ORDER BY facility_id ASC'
      );
    facRes.recordset.forEach((f) => {
      facilityMap.set(f.facility_id, {
        facilityId: f.facility_id,
        facilityName: f.name,
        address: f.address,
        status: f.status,
      });
    });
  } else {
    allCourts.forEach((c) => {
      if (c.facility_id && !facilityMap.has(c.facility_id)) {
        facilityMap.set(c.facility_id, {
          facilityId: c.facility_id,
          facilityName: c.facility_name || `Cơ sở #${c.facility_id}`,
          address: c.address,
          status: 'ACTIVE',
        });
      }
    });
  }

  const filteredCourts = courtId
    ? allCourts.filter((c) => c.court_id === courtId)
    : allCourts;

  const courtIds = filteredCourts.map((c) => c.court_id);

  if (courtIds.length === 0) {
    return {
      startDate,
      endDate,
      facilities: Array.from(facilityMap.values()),
      sports: sportsResult.recordset.map((s) => ({
        sportId: s.sport_id,
        sportName: s.sport_name,
      })),
      courts: allCourts.map((c) => ({
        courtId: c.court_id,
        facilityId: c.facility_id,
        facilityName: c.facility_name || 'Cơ sở chính',
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
  const bookingReq = pool
    .request()
    .input('startDate', startDate)
    .input('endDate', endDate);

  let bookingSql = `
    SELECT b.booking_id, b.court_id, b.user_id, b.customer_id,
           b.booking_date, b.start_time, b.end_time,
           b.total_price, b.deposit_amount, b.status, b.created_at,
           c.court_name, c.facility_id, f.name AS facility_name, c.sport_id, s.sport_name,
           COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
           COALESCE(cust.phone, u.phone, '') AS player_phone,
           COALESCE(cust.email, u.email, '') AS player_email,
           COALESCE(cust.reputation_score, u.reputation_score, 5.0) AS reputation_score
    FROM bookings b
    JOIN courts c ON b.court_id = c.court_id
    LEFT JOIN facilities f ON c.facility_id = f.facility_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    LEFT JOIN customers cust ON b.customer_id = cust.customer_id
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
  const maintResult = await pool
    .request()
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
    facilities: Array.from(facilityMap.values()),
    sports: sportsResult.recordset.map((s) => ({
      sportId: s.sport_id,
      sportName: s.sport_name,
    })),
    courts: allCourts.map((c) => ({
      courtId: c.court_id,
      facilityId: c.facility_id,
      facilityName: c.facility_name || 'Cơ sở chính',
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
      facilityId: b.facility_id,
      facilityName: b.facility_name || 'Cơ sở chính',
      courtName: b.court_name,
      sportId: b.sport_id,
      sportName: b.sport_name || 'Thể thao',
      userId: b.user_id,
      customerId: b.customer_id,
      matchId: b.match_id ?? null,
      playerName: b.player_name || 'Khách vãng lai',
      playerPhone: b.player_phone || '',
      playerEmail: b.player_email || '',
      reputationScore: Number(b.reputation_score ?? 5.0),
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
 */
export async function getBookingById(bookingId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', bookingId)
    .query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address, c.owner_id, c.facility_id,
             COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
             COALESCE(cust.email, u.email, '') AS player_email,
             COALESCE(cust.phone, u.phone, '') AS player_phone
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN customers cust ON b.customer_id = cust.customer_id
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = @id
    `);
  return result.recordset[0] || null;
}

/**
 * Tạo mới một booking (có kiểm tra giờ mở cửa, không cho đặt giờ quá khứ, chống trùng lịch,
 * tự động tính giá động phía Server và kiểm tra trạng thái LOCKED của khách hàng).
 */
export async function createBooking(data, actorUser = null) {
  const {
    courtId,
    userId,
    bookingDate,
    startTime,
    endTime,
    depositAmount = 0,
    status = 'CONFIRMED',
    customerName,
    customerPhone,
    customerEmail,
    isHoliday = false,
  } = data;

  if (courtId === undefined || courtId === null || courtId === '' || !startTime || !endTime) {
    throw new AppError('Vui lòng chọn sân, giờ bắt đầu và giờ kết thúc.', 400);
  }

  const now = new Date();
  const todayStr = getLocalDateStr(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cleanDate = bookingDate || todayStr;
  const cleanStart = formatTimeStr(startTime);
  const cleanEnd = formatTimeStr(endTime);

  const startMin = timeToMinutes(cleanStart);
  const endMin = timeToMinutes(cleanEnd);

  if (endMin <= startMin) {
    throw new AppError('Giờ kết thúc phải lớn hơn giờ bắt đầu.', 400);
  }

  if (startMin < 6 * 60 || endMin > 23 * 60) {
    throw new AppError(
      'Khung giờ đặt sân nằm ngoài giờ mở cửa (06:00 – 23:00).',
      400
    );
  }

  // Chặn đặt sân vào ngày hoặc khung giờ trong quá khứ
  if (cleanDate < todayStr) {
    throw new AppError(
      `Không thể đặt sân cho ngày trong quá khứ (${cleanDate}). Vui lòng chọn ngày hôm nay (${todayStr}) hoặc ngày trong tương lai.`,
      400
    );
  }

  if (cleanDate === todayStr && startMin < currentMinutes) {
    throw new AppError(
      `Khung giờ ${cleanStart} - ${cleanEnd} ngày hôm nay (${cleanDate}) đã qua (hiện tại là ${currentTimeStr}). Vui lòng chọn khung giờ trong tương lai.`,
      400
    );
  }

  const pool = await getPool();

  // 1. Kiểm tra sân có tồn tại, đang hoạt động và thuộc phạm vi quyền hạn không
  const courtRes = await pool
    .request()
    .input('courtId', courtId)
    .query(`
      SELECT c.court_id, c.court_name, c.status, c.owner_id, c.facility_id,
             f.status AS facility_status
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      WHERE c.court_id = @courtId
    `);

  const court = courtRes.recordset[0];
  if (!court) {
    throw new AppError('Không tìm thấy sân thể thao này.', 404);
  }

  const actorRole = (actorUser?.role || '').toLowerCase();
  if (actorRole === 'owner' && Number(court.owner_id) !== Number(actorUser.id)) {
    throw new AppError('Bạn không có quyền tạo lịch đặt trên sân của chủ sân khác.', 403);
  }
  if (actorRole === 'staff') {
    const staffAssign = await pool
      .request()
      .input('staffId', actorUser.id)
      .input('courtId', courtId)
      .query('SELECT assignment_id FROM court_staff WHERE staff_id = @staffId AND court_id = @courtId');
    if (staffAssign.recordset.length === 0) {
      throw new AppError('Bạn không được phân công quản lý sân này.', 403);
    }
  }

  if ((court.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
    throw new AppError(`Sân "${court.court_name}" hiện đang ngưng hoạt động hoặc bảo trì.`, 400);
  }
  if (court.facility_status && court.facility_status.toUpperCase() !== 'ACTIVE') {
    throw new AppError(`Cơ sở chứa sân "${court.court_name}" hiện đang tạm ngưng hoạt động.`, 400);
  }

  // 2. Kiểm tra xung đột với đơn đặt sân đang hiệu lực (PENDING, CONFIRMED, CHECKED-IN, COMPLETED)
  // Lưu ý: Đơn CANCELLED và NO-SHOW đã giải phóng sân nên cho phép đặt lại
  const conflictRes = await pool
    .request()
    .input('courtId', courtId)
    .input('bookingDate', cleanDate)
    .input('startTime', `${cleanStart}:00`)
    .input('endTime', `${cleanEnd}:00`)
    .query(`
      SELECT booking_id, start_time, end_time, status
      FROM bookings
      WHERE court_id = @courtId
        AND booking_date = @bookingDate
        AND status NOT IN ('CANCELLED', 'NO-SHOW')
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
  const maintConflict = await pool
    .request()
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

  // 4. Luôn tính toán tổng tiền tự động phía Server từ bảng giá động court_prices (TC01)
  const priceRulesRes = await pool
    .request()
    .input('courtId', courtId)
    .query('SELECT day_type, start_time, end_time, price FROM court_prices WHERE court_id = @courtId');

  const finalPrice = calculateDynamicPrice(
    priceRulesRes.recordset,
    cleanDate,
    cleanStart,
    cleanEnd,
    isHoliday
  );

  // Người chơi đặt online mặc định là PENDING; Owner/Staff đặt tại quầy có thể chọn CONFIRMED / CHECKED-IN
  let cleanStatus = 'PENDING';
  if (actorRole === 'owner' || actorRole === 'staff' || actorRole === 'admin') {
    const requestedStatus = (status || 'CONFIRMED').toUpperCase();
    cleanStatus = ['PENDING', 'CONFIRMED', 'CHECKED-IN'].includes(requestedStatus)
      ? requestedStatus
      : 'CONFIRMED';
  }

  const finalDeposit = Math.max(0, Math.min(finalPrice, Number(depositAmount || 0)));

  // 5. Tra cứu / Lưu thông tin khách hàng trong bảng [customers] và kiểm tra trạng thái khóa (LOCKED)
  let targetCustomerId = null;
  let targetUserId = null;
  let newlyCreatedCustomerId = null;

  if (customerPhone && customerPhone.trim()) {
    const cleanPhone = customerPhone.trim().replace(/\s+/g, '');
    const cleanName =
      customerName && customerName.trim() ? customerName.trim() : `Khách ${cleanPhone}`;
    const cleanEmail =
      customerEmail && customerEmail.trim() && !customerEmail.trim().startsWith('guest_')
        ? customerEmail.trim().toLowerCase()
        : null;

    const existingCust = await pool
      .request()
      .input('phone', cleanPhone)
      .query(
        'SELECT customer_id, user_id, full_name, email, status FROM customers WHERE phone = @phone'
      );

    if (existingCust.recordset.length > 0) {
      const custRow = existingCust.recordset[0];
      if ((custRow.status || 'ACTIVE').toUpperCase() === 'LOCKED') {
        throw new AppError(
          `Khách hàng "${custRow.full_name}" (${cleanPhone}) đang bị khóa tạm thời do vi phạm quy định đặt sân.`,
          403
        );
      }

      targetCustomerId = custRow.customer_id;
      targetUserId = custRow.user_id || null;

      await pool
        .request()
        .input('cid', targetCustomerId)
        .input('fullName', cleanName)
        .input('email', cleanEmail || custRow.email || null)
        .query(`
          UPDATE customers
          SET full_name = @fullName,
              email = COALESCE(@email, email),
              updated_at = GETDATE()
          WHERE customer_id = @cid
        `);
    } else {
      const linkedPlayer = await pool
        .request()
        .input('phone', cleanPhone)
        .query(
          `SELECT user_id, email, status FROM users WHERE phone = @phone AND role = 'PLAYER'`
        );

      if (
        linkedPlayer.recordset[0] &&
        (linkedPlayer.recordset[0].status || 'ACTIVE').toUpperCase() === 'LOCKED'
      ) {
        throw new AppError(
          `Tài khoản khách hàng có SĐT ${cleanPhone} hiện đang bị khóa tạm thời.`,
          403
        );
      }

      const linkedUserId = linkedPlayer.recordset[0]?.user_id || null;
      const finalEmail = cleanEmail || linkedPlayer.recordset[0]?.email || null;

      const newCust = await pool
        .request()
        .input('userId', linkedUserId)
        .input('fullName', cleanName)
        .input('phone', cleanPhone)
        .input('email', finalEmail)
        .query(`
          INSERT INTO customers (user_id, full_name, phone, email, reputation_score, status, created_at, updated_at)
          OUTPUT INSERTED.customer_id
          VALUES (@userId, @fullName, @phone, @email, 5.0, 'ACTIVE', GETDATE(), GETDATE())
        `);

      targetCustomerId = newCust.recordset[0].customer_id;
      targetUserId = linkedUserId;
      newlyCreatedCustomerId = targetCustomerId;
    }
  } else if (actorRole === 'player' || (!actorRole && userId)) {
    const effectiveUid = actorUser?.id || userId;
    targetUserId = effectiveUid;
    const userRes = await pool
      .request()
      .input('uid', effectiveUid)
      .query(
        'SELECT user_id, full_name, phone, email, status, reputation_score FROM users WHERE user_id = @uid'
      );

    const appUser = userRes.recordset[0];
    if (appUser) {
      if ((appUser.status || 'ACTIVE').toUpperCase() === 'LOCKED') {
        throw new AppError('Tài khoản của bạn đang bị khóa tạm thời.', 403);
      }

      if (appUser.phone) {
        const existingCust = await pool
          .request()
          .input('phone', appUser.phone)
          .query('SELECT customer_id, status FROM customers WHERE phone = @phone');

        if (existingCust.recordset.length > 0) {
          if ((existingCust.recordset[0].status || 'ACTIVE').toUpperCase() === 'LOCKED') {
            throw new AppError('Hồ sơ khách hàng của bạn đang bị khóa tạm thời.', 403);
          }
          targetCustomerId = existingCust.recordset[0].customer_id;
        } else {
          const newCust = await pool
            .request()
            .input('userId', appUser.user_id)
            .input('fullName', appUser.full_name)
            .input('phone', appUser.phone)
            .input('email', appUser.email)
            .input('rep', appUser.reputation_score ?? 5.0)
            .query(`
              INSERT INTO customers (user_id, full_name, phone, email, reputation_score, status, created_at, updated_at)
              OUTPUT INSERTED.customer_id
              VALUES (@userId, @fullName, @phone, @email, @rep, 'ACTIVE', GETDATE(), GETDATE())
            `);
          targetCustomerId = newCust.recordset[0].customer_id;
          newlyCreatedCustomerId = targetCustomerId;
        }
      }
    }
  } else {
    throw new AppError('Vui lòng nhập Số điện thoại khách hàng khi tạo đơn đặt sân tại quầy.', 400);
  }

  let created;
  try {
    const result = await pool
      .request()
      .input('courtId', courtId)
      .input('userId', targetUserId)
      .input('customerId', targetCustomerId)
      .input('bookingDate', cleanDate)
      .input('startTime', `${cleanStart}:00`)
      .input('endTime', `${cleanEnd}:00`)
      .input('totalPrice', finalPrice)
      .input('depositAmount', finalDeposit)
      .input('status', cleanStatus)
      .query(`
        INSERT INTO bookings (court_id, user_id, customer_id, booking_date, start_time, end_time, total_price, deposit_amount, status, created_at)
        OUTPUT INSERTED.*
        VALUES (@courtId, @userId, @customerId, @bookingDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @totalPrice, @depositAmount, @status, GETDATE())
      `);

    created = result.recordset[0];
  } catch (err) {
    if (newlyCreatedCustomerId) {
      await pool
        .request()
        .input('cid', newlyCreatedCustomerId)
        .query(
          'DELETE FROM customers WHERE customer_id = @cid AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = @cid)'
        );
    }
    throw err;
  }

  // Ghi nhận giao dịch tiền cọc nếu có
  if (finalDeposit > 0) {
    await pool
      .request()
      .input('bookingId', created.booking_id)
      .input('userId', targetUserId)
      .input('amount', finalDeposit)
      .query(`
        INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, created_at)
        VALUES (@bookingId, @userId, @amount, 'DEPOSIT', 'CASH', 'SUCCESS', GETDATE())
      `);
  }

  return created;
}

/**
 * Cập nhật trạng thái booking (PENDING, CONFIRMED, CHECKED-IN, COMPLETED, CANCELLED, NO-SHOW).
 * Có kiểm tra luồng trạng thái hợp lệ (State Machine) và chỉ thu phần tiền còn thiếu (tránh nhân đôi tiền cọc).
 */
export async function updateBooking(bookingId, data, actorUser = null) {
  const cleanStatus = (data.status || '').toUpperCase();
  const validStatuses = [
    'PENDING',
    'CONFIRMED',
    'CHECKED-IN',
    'COMPLETED',
    'CANCELLED',
    'NO-SHOW',
  ];
  if (!validStatuses.includes(cleanStatus)) {
    throw new AppError('Trạng thái đơn đặt sân không hợp lệ.', 400);
  }

  const pool = await getPool();
  const currentRes = await pool
    .request()
    .input('id', bookingId)
    .query('SELECT * FROM bookings WHERE booking_id = @id');

  const currentBooking = currentRes.recordset[0];
  if (!currentBooking) {
    throw new AppError('Không tìm thấy đơn đặt sân.', 404);
  }

  const currentStatus = (currentBooking.status || 'PENDING').toUpperCase();
  const actorRole = (actorUser?.role || '').toLowerCase();

  // Người chơi (player) chỉ được phép hủy đơn đang chờ (PENDING -> CANCELLED)
  if (actorRole === 'player') {
    if (cleanStatus !== 'CANCELLED' || currentStatus !== 'PENDING') {
      throw new AppError(
        'Người chơi chỉ có thể hủy đơn đặt sân khi đơn đang ở trạng thái Chờ xác nhận (PENDING).',
        403
      );
    }
  }

  // Kiểm tra luồng chuyển trạng thái hợp lệ (State Machine)
  const allowedTransitions = {
    PENDING: ['CONFIRMED', 'CHECKED-IN', 'COMPLETED', 'CANCELLED', 'NO-SHOW'],
    CONFIRMED: ['CHECKED-IN', 'COMPLETED', 'CANCELLED', 'NO-SHOW'],
    'CHECKED-IN': ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['COMPLETED'], // Đơn đã hoàn thành không chuyển ngược lại
    CANCELLED: ['CANCELLED'], // Đơn đã hủy không chuyển sang hoàn thành
    'NO-SHOW': ['NO-SHOW', 'CONFIRMED', 'CHECKED-IN'],
  };

  if (
    allowedTransitions[currentStatus] &&
    !allowedTransitions[currentStatus].includes(cleanStatus)
  ) {
    throw new AppError(
      `Không thể chuyển trạng thái đơn từ "${currentStatus}" sang "${cleanStatus}".`,
      400
    );
  }

  const result = await pool
    .request()
    .input('id', bookingId)
    .input('status', cleanStatus)
    .query(`
      UPDATE bookings
      SET status = @status
      OUTPUT INSERTED.*
      WHERE booking_id = @id
    `);

  const updated = result.recordset[0];

  // Nếu chuyển sang COMPLETED: chỉ ghi nhận phần tiền còn thiếu (total_price - already_paid)
  if (cleanStatus === 'COMPLETED') {
    const paidRes = await pool
      .request()
      .input('bookingId', bookingId)
      .query(`
        SELECT ISNULL(SUM(
          CASE WHEN transaction_type = 'REFUND' THEN -amount ELSE amount END
        ), 0) AS total_paid
        FROM transactions
        WHERE booking_id = @bookingId AND status = 'SUCCESS'
      `);

    const alreadyPaid = Math.max(
      Number(paidRes.recordset[0]?.total_paid || 0),
      Number(updated.deposit_amount || 0)
    );
    const totalPrice = Number(updated.total_price || 0);
    const remainingAmount = Math.max(0, totalPrice - alreadyPaid);

    const method = ['MOMO', 'VNPAY', 'BANK_TRANSFER', 'CASH'].includes(
      (data.paymentMethod || '').toUpperCase()
    )
      ? data.paymentMethod.toUpperCase()
      : 'CASH';

    if (remainingAmount > 0) {
      await pool
        .request()
        .input('bookingId', bookingId)
        .input('userId', updated.user_id || null)
        .input('amount', remainingAmount)
        .input('method', method)
        .query(`
          INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, created_at)
          VALUES (@bookingId, @userId, @amount, 'FULL_PAYMENT', @method, 'SUCCESS', GETDATE())
        `);
    } else {
      // Nếu khách đã cọc 100% nhưng chưa có bản ghi transaction nào trong bảng transactions
      const anyTx = await pool
        .request()
        .input('bookingId', bookingId)
        .query('SELECT TOP 1 transaction_id FROM transactions WHERE booking_id = @bookingId');
      if (anyTx.recordset.length === 0 && totalPrice > 0) {
        await pool
          .request()
          .input('bookingId', bookingId)
          .input('userId', updated.user_id || null)
          .input('amount', totalPrice)
          .input('method', method)
          .query(`
            INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, created_at)
            VALUES (@bookingId, @userId, @amount, 'FULL_PAYMENT', @method, 'SUCCESS', GETDATE())
          `);
      }
    }
  }

  // Nếu chuyển sang NO-SHOW lần đầu: tự động trừ 0.5 điểm uy tín của khách hàng
  if (cleanStatus === 'NO-SHOW' && currentStatus !== 'NO-SHOW') {
    if (updated.customer_id) {
      await pool
        .request()
        .input('cid', updated.customer_id)
        .query(`
          UPDATE customers
          SET reputation_score = CASE WHEN reputation_score - 0.5 < 1.0 THEN 1.0 ELSE reputation_score - 0.5 END,
              updated_at = GETDATE()
          WHERE customer_id = @cid
        `);
    }
    if (updated.user_id) {
      await pool
        .request()
        .input('uid', updated.user_id)
        .query(`
          UPDATE users
          SET reputation_score = CASE WHEN ISNULL(reputation_score, 5.0) - 0.5 < 1.0 THEN 1.0 ELSE ISNULL(reputation_score, 5.0) - 0.5 END
          WHERE user_id = @uid
        `);
    }
  }

  return updated;
}

/**
 * Thêm lịch bảo trì cho sân (Khóa khung giờ trên lịch sân).
 * Kiểm tra quyền sở hữu sân và kiểm tra không trùng với đơn đặt đang hiệu lực.
 */
export async function createMaintenance(user, data) {
  const { courtId, date, startTime, endTime, reason } = data;
  if (courtId === undefined || courtId === null || courtId === '' || !date || !startTime || !endTime) {
    throw new AppError('Vui lòng nhập đầy đủ sân, ngày và khung giờ bảo trì.', 400);
  }

  const cleanStart = formatTimeStr(startTime);
  const cleanEnd = formatTimeStr(endTime);
  if (timeToMinutes(cleanEnd) <= timeToMinutes(cleanStart)) {
    throw new AppError('Giờ kết thúc bảo trì phải lớn hơn giờ bắt đầu.', 400);
  }

  const pool = await getPool();
  const courtCheck = await pool
    .request()
    .input('courtId', courtId)
    .query('SELECT court_id, owner_id, court_name FROM courts WHERE court_id = @courtId');

  if (courtCheck.recordset.length === 0) {
    throw new AppError('Không tìm thấy sân thể thao.', 404);
  }

  const userRole = (user.role || '').toLowerCase();
  if (userRole === 'owner' && Number(courtCheck.recordset[0].owner_id) !== Number(user.id)) {
    throw new AppError('Bạn không có quyền đặt lịch bảo trì cho sân của chủ sân khác.', 403);
  }

  // Kiểm tra xem khung giờ này có đơn đặt sân đang hiệu lực không
  const activeBookingConflict = await pool
    .request()
    .input('courtId', courtId)
    .input('bookingDate', date)
    .input('startTime', `${cleanStart}:00`)
    .input('endTime', `${cleanEnd}:00`)
    .query(`
      SELECT booking_id, start_time, end_time, status
      FROM bookings
      WHERE court_id = @courtId
        AND booking_date = @bookingDate
        AND status IN ('PENDING', 'CONFIRMED', 'CHECKED-IN')
        AND start_time < CAST(@endTime AS TIME)
        AND end_time > CAST(@startTime AS TIME)
    `);

  if (activeBookingConflict.recordset.length > 0) {
    const b = activeBookingConflict.recordset[0];
    throw new AppError(
      `Không thể khóa bảo trì vì đang có đơn đặt sân (${formatTimeStr(b.start_time)} - ${formatTimeStr(b.end_time)}) ở trạng thái ${b.status}. Vui lòng xử lý đơn trước.`,
      409
    );
  }

  const startDt = `${date}T${cleanStart}:00`;
  const endDt = `${date}T${cleanEnd}:00`;

  const result = await pool
    .request()
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
  const check = await pool
    .request()
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

  const userRole = (user.role || '').toLowerCase();
  if (userRole === 'owner' && Number(check.recordset[0].owner_id) !== Number(user.id)) {
    throw new AppError('Bạn không có quyền xóa lịch bảo trì của chủ sân khác.', 403);
  }

  await pool
    .request()
    .input('id', maintenanceId)
    .query('DELETE FROM court_maintenances WHERE maintenance_id = @id');
}

/**
 * Hủy một booking (Soft-cancel sang trạng thái CANCELLED để bảo toàn lịch sử).
 * @param {number} bookingId
 */
export async function deleteBooking(bookingId) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', bookingId)
    .query("UPDATE bookings SET status = 'CANCELLED' WHERE booking_id = @id");
}
