import crypto from 'crypto';
import sql, { getPool } from '../../core/config/db.js';
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
 * Secret dùng để ký và xác thực chữ ký số HMAC-SHA512 cho cổng thanh toán Sandbox & Webhook (R07).
 */
function getPaymentSecret() {
  return (
    process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.JWT_SECRET ||
    'sportlink_payment_hmac_secret_2026'
  );
}

/**
 * Tạo chữ ký số HMAC-SHA512 chuẩn cổng thanh toán.
 */
export function generatePaymentSignature({
  orderCode,
  bookingId,
  amount,
  paymentMethod,
  resultCode = '00',
}) {
  const canonical = `orderCode=${orderCode}&bookingId=${bookingId}&amount=${Math.round(
    Number(amount || 0)
  )}&paymentMethod=${String(paymentMethod || '').toUpperCase()}&resultCode=${String(
    resultCode
  )}`;
  return crypto.createHmac('sha512', getPaymentSecret()).update(canonical).digest('hex');
}

/**
 * Xác thực chữ ký số HMAC-SHA512 của Webhook (Chống giả mạo kết quả thanh toán - R07).
 */
export function verifyPaymentSignature({
  orderCode,
  bookingId,
  amount,
  paymentMethod,
  resultCode,
  signature,
}) {
  if (!signature || typeof signature !== 'string') return false;
  const expected = generatePaymentSignature({
    orderCode,
    bookingId,
    amount,
    paymentMethod,
    resultCode,
  });
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature.trim(), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Ghi nhận thông báo hệ thống (in-app notification) an toàn, không làm gián đoạn luồng chính.
 */
async function createNotificationSafe(pool, { userId, title, content }) {
  if (!userId) return;
  try {
    await pool
      .request()
      .input('userId', userId)
      .input('title', String(title || 'Thông báo hệ thống').slice(0, 200))
      .input('content', String(content || '').slice(0, 500))
      .query(`
        INSERT INTO notifications (user_id, title, content, is_read, created_at)
        VALUES (@userId, @title, @content, 0, GETDATE())
      `);
  } catch {
    // Bỏ qua nếu bảng notifications chưa đồng bộ
  }
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
 * Hàng đợi khóa đồng bộ theo từng sân (Per-Court Concurrency Mutex Queue)
 * kết hợp cùng SQL Server Transaction (WITH UPDLOCK, HOLDLOCK) để đảm bảo
 * an toàn tuyệt đối 2 lớp (Application-level + Database-level Lock) khi có hàng chục
 * request đặt trùng khung giờ cùng 1 mili-giây (TC02).
 */
const courtMutexMap = new Map();

async function withCourtLock(courtId, fn) {
  const key = String(courtId);
  const prev = courtMutexMap.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  courtMutexMap.set(
    key,
    prev.then(() => next)
  );
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (courtMutexMap.get(key) === next) {
      courtMutexMap.delete(key);
    }
  }
}

/**
 * [4.3] Lấy thông tin tình trạng trống/đã đặt của 1 sân theo ngày và bảng giá động.
 */
export async function getCourtAvailability(query = {}) {
  const rawCourtId = query.courtId;
  const courtId = Number(rawCourtId);
  if (rawCourtId === undefined || rawCourtId === null || rawCourtId === '' || isNaN(courtId)) {
    throw new AppError('Vui lòng cung cấp courtId hợp lệ.', 400);
  }
  const date = query.date || query.bookingDate || getLocalDateStr();

  const pool = await getPool();
  const courtRes = await pool
    .request()
    .input('courtId', courtId)
    .query(`
      SELECT c.court_id, c.court_name, c.status, c.capacity,
             c.facility_id, f.name AS facility_name, f.address AS facility_address,
             c.sport_id, s.sport_name
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      LEFT JOIN sports s ON c.sport_id = s.sport_id
      WHERE c.court_id = @courtId
    `);

  const court = courtRes.recordset[0];
  if (!court) {
    throw new AppError('Không tìm thấy sân thể thao.', 404);
  }

  const pricesRes = await pool
    .request()
    .input('courtId', courtId)
    .query(`
      SELECT price_id, court_id, day_type, start_time, end_time, price
      FROM court_prices
      WHERE court_id = @courtId
      ORDER BY start_time ASC
    `);

  const bookingsRes = await pool
    .request()
    .input('courtId', courtId)
    .input('bookingDate', date)
    .query(`
      SELECT booking_id, start_time, end_time, status
      FROM bookings
      WHERE court_id = @courtId
        AND booking_date = @bookingDate
        AND status NOT IN ('CANCELLED', 'NO-SHOW')
      ORDER BY start_time ASC
    `);

  const maintRes = await pool
    .request()
    .input('courtId', courtId)
    .input('startDt', `${date}T00:00:00`)
    .input('endDt', `${date}T23:59:59`)
    .query(`
      SELECT maintenance_id, start_time, end_time, reason
      FROM court_maintenances
      WHERE court_id = @courtId
        AND start_time <= @endDt
        AND end_time >= @startDt
      ORDER BY start_time ASC
    `);

  const defaultBasePrice =
    pricesRes.recordset.length > 0 ? Number(pricesRes.recordset[0].price) : 200000;

  return {
    courtId: court.court_id,
    courtName: court.court_name,
    facilityId: court.facility_id,
    facilityName: court.facility_name || 'Cơ sở SportLink',
    facilityAddress: court.facility_address || '',
    sportId: court.sport_id,
    sportName: court.sport_name || 'Thể thao',
    status: court.status || 'ACTIVE',
    basePricePerHour: defaultBasePrice,
    date,
    prices: pricesRes.recordset.map((p) => ({
      priceId: p.price_id,
      dayType: p.day_type,
      startTime: formatTimeStr(p.start_time),
      endTime: formatTimeStr(p.end_time),
      price: Number(p.price),
    })),
    bookedSlots: bookingsRes.recordset.map((b) => ({
      bookingId: b.booking_id,
      startTime: formatTimeStr(b.start_time),
      endTime: formatTimeStr(b.end_time),
      status: b.status,
    })),
    maintenanceSlots: maintRes.recordset.map((m) => ({
      maintenanceId: m.maintenance_id,
      startTime: formatTimeStr(m.start_time),
      endTime: formatTimeStr(m.end_time),
      reason: m.reason || 'Bảo trì định kỳ',
    })),
  };
}

/**
 * [4.3] Báo giá tự động theo khung giờ & kiểm tra nhanh xung đột trước khi đặt.
 */
export async function calculateBookingQuote(data = {}) {
  const rawCourtId = data.courtId;
  const courtId = Number(rawCourtId);
  const bookingDate = data.bookingDate || data.date || getLocalDateStr();
  const startTime = formatTimeStr(data.startTime || '17:00');
  const endTime = formatTimeStr(data.endTime || '18:30');
  const isHoliday = Boolean(data.isHoliday) || isVietnameseHoliday(bookingDate);

  if (rawCourtId === undefined || rawCourtId === null || rawCourtId === '' || isNaN(courtId)) {
    throw new AppError('Vui lòng chọn sân thể thao hợp lệ.', 400);
  }

  const availability = await getCourtAvailability({ courtId, date: bookingDate });

  let rules = availability.prices.map((p) => ({
    day_type: p.dayType,
    start_time: p.startTime,
    end_time: p.endTime,
    price: p.price,
  }));

  if (rules.length === 0 && availability.basePricePerHour > 0) {
    rules = [
      {
        day_type: 'WEEKDAY',
        start_time: '06:00',
        end_time: '23:00',
        price: availability.basePricePerHour,
      },
    ];
  }

  const totalPrice = calculateDynamicPrice(
    rules,
    bookingDate,
    startTime,
    endTime,
    isHoliday
  );

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const durationMinutes = endMin - startMin;
  const durationHours = Number((durationMinutes / 60).toFixed(2));
  const depositSuggested = Math.round(totalPrice * 0.3);

  // Kiểm tra có trùng với bookedSlots hoặc maintenanceSlots không
  const conflictBooking = availability.bookedSlots.find(
    (b) => timeToMinutes(b.startTime) < endMin && timeToMinutes(b.endTime) > startMin
  );
  const conflictMaint = availability.maintenanceSlots.find(
    (m) => timeToMinutes(m.startTime) < endMin && timeToMinutes(m.endTime) > startMin
  );

  const dateObj = new Date(`${bookingDate}T00:00:00`);
  const dayOfWeek = dateObj.getDay();
  const dayType = isHoliday
    ? 'HOLIDAY'
    : dayOfWeek === 0 || dayOfWeek === 6
      ? 'WEEKEND'
      : 'WEEKDAY';

  // Bóc tách chi tiết từng bước 30 phút (S3-06: Price Breakdown)
  const slotBreakdown = [];
  const applicableRules = rules.filter((r) => {
    const dt = (r.day_type || '').toUpperCase();
    if (dayType === 'WEEKDAY') return dt === 'NORMAL' || dt === 'WEEKDAY';
    return dt === dayType;
  });
  const finalRules =
    applicableRules.length > 0
      ? applicableRules
      : rules.filter((r) => ['NORMAL', 'WEEKDAY'].includes((r.day_type || '').toUpperCase()));

  for (let cur = startMin; cur < endMin; cur += 30) {
    const mid = cur + 15;
    const matched = finalRules.find((r) => {
      const rStart = timeToMinutes(r.start_time);
      const rEnd = timeToMinutes(r.end_time);
      return mid >= rStart && mid <= rEnd;
    });
    const hourlyRate = matched
      ? Number(matched.price)
      : finalRules.length > 0
        ? Number(finalRules[finalRules.length - 1].price)
        : 200000;
    const sH = String(Math.floor(cur / 60)).padStart(2, '0');
    const sM = String(cur % 60).padStart(2, '0');
    const eH = String(Math.floor((cur + 30) / 60)).padStart(2, '0');
    const eM = String((cur + 30) % 60).padStart(2, '0');
    slotBreakdown.push({
      slot: `${sH}:${sM} - ${eH}:${eM}`,
      hourlyRate,
      slotPrice: Math.round(hourlyRate * 0.5),
      isPeak: cur >= 16 * 60 && cur < 21 * 60,
    });
  }

  const courtStatusUpper = (availability.status || 'ACTIVE').toUpperCase();

  return {
    courtId,
    courtName: availability.courtName,
    facilityId: availability.facilityId,
    facilityName: availability.facilityName,
    sportName: availability.sportName,
    bookingDate,
    startTime,
    endTime,
    durationMinutes,
    durationHours,
    dayType,
    isHoliday,
    totalPrice,
    depositSuggested,
    slotBreakdown,
    courtStatus: courtStatusUpper,
    isAvailable: !conflictBooking && !conflictMaint && courtStatusUpper === 'ACTIVE',
    conflictReason:
      courtStatusUpper === 'MAINTENANCE'
        ? `Sân "${availability.courtName}" hiện đang trong trạng thái Bảo trì (chặn đặt sân)`
        : courtStatusUpper !== 'ACTIVE'
          ? `Sân "${availability.courtName}" hiện đang tạm ngưng hoạt động`
          : conflictBooking
            ? `Trùng lịch đã đặt (${conflictBooking.startTime} - ${conflictBooking.endTime})`
            : conflictMaint
              ? `Sân đang có lịch bảo trì (${conflictMaint.startTime} - ${conflictMaint.endTime}: ${conflictMaint.reason})`
              : null,
  };
}

/**
 * [4.3 - S3-06] Báo giá tự động cho toàn bộ Giỏ đặt sân (Multi-Slot Booking Cart).
 * Hỗ trợ chọn nhiều khung giờ hoặc nhiều sân khác nhau, kiểm tra trùng với DB và trùng chéo ngay trong giỏ.
 */
export async function calculateCartQuote(data = {}) {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length === 0) {
    throw new AppError('Giỏ đặt sân đang trống. Vui lòng chọn ít nhất một khung giờ.', 400);
  }
  if (rawItems.length > 15) {
    throw new AppError('Giỏ đặt sân hỗ trợ tối đa 15 khung giờ trong một lần thanh toán.', 400);
  }

  const quotedItems = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const quote = await calculateBookingQuote(item);

    // Kiểm tra xem có trùng khung giờ với một mục khác đứng trước trong cùng giỏ đặt sân không
    const intraCartConflict = quotedItems.find(
      (prev) =>
        Number(prev.courtId) === Number(quote.courtId) &&
        prev.bookingDate === quote.bookingDate &&
        timeToMinutes(prev.startTime) < timeToMinutes(quote.endTime) &&
        timeToMinutes(prev.endTime) > timeToMinutes(quote.startTime)
    );

    if (intraCartConflict && quote.isAvailable) {
      quote.isAvailable = false;
      quote.conflictReason = `Trùng khung giờ với mục #${intraCartConflict.cartIndex + 1} (${intraCartConflict.startTime} - ${intraCartConflict.endTime}) trong giỏ đặt sân`;
    }

    quotedItems.push({
      cartIndex: i,
      cartItemId: item.cartItemId || `${quote.courtId}-${quote.bookingDate}-${quote.startTime}-${quote.endTime}`,
      ...quote,
    });
  }

  const availableItems = quotedItems.filter((it) => it.isAvailable);
  const conflictItems = quotedItems.filter((it) => !it.isAvailable);
  const totalCartPrice = quotedItems.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0);
  const totalAvailablePrice = availableItems.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0);
  const totalDurationHours = Number(
    quotedItems.reduce((sum, it) => sum + Number(it.durationHours || 0), 0).toFixed(2)
  );
  const totalDepositSuggested = Math.round(totalCartPrice * 0.3);

  return {
    totalItems: quotedItems.length,
    availableCount: availableItems.length,
    conflictCount: conflictItems.length,
    allAvailable: conflictItems.length === 0,
    totalDurationHours,
    totalCartPrice,
    totalAvailablePrice,
    totalDepositSuggested,
    items: quotedItems,
  };
}

/**
 * [4.3 - S3-06] Đặt sân hàng loạt cho toàn bộ các khung giờ trong Giỏ đặt sân (Multi-Slot Cart Checkout).
 * Áp dụng Transaction Lock chống đặt trùng (TC02) cho từng khung giờ.
 */
export async function checkoutBookingCart(data = {}, actorUser = null) {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length === 0) {
    throw new AppError('Giỏ đặt sân đang trống. Vui lòng thêm khung giờ trước khi đặt.', 400);
  }

  // Bước 1: Kiểm tra báo giá & tính khả dụng toàn giỏ trước khi tạo đơn
  const cartQuote = await calculateCartQuote({ items: rawItems });
  if (!cartQuote.allAvailable) {
    const firstConflict = cartQuote.items.find((it) => !it.isAvailable);
    throw new AppError(
      `Không thể hoàn tất giỏ đặt sân: ${firstConflict?.courtName} (${firstConflict?.bookingDate} ${firstConflict?.startTime}-${firstConflict?.endTime}) — ${firstConflict?.conflictReason}`,
      409
    );
  }

  const createdBookings = [];
  for (const item of cartQuote.items) {
    const created = await createBooking(
      {
        courtId: item.courtId,
        userId: actorUser?.id,
        bookingDate: item.bookingDate,
        startTime: item.startTime,
        endTime: item.endTime,
        customerName: data.customerName || actorUser?.fullName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || actorUser?.email,
        paymentMethod: data.paymentMethod || null,
      },
      actorUser
    );
    createdBookings.push({
      ...created,
      court_name: item.courtName,
      facility_name: item.facilityName,
      sport_name: item.sportName,
      booking_date: item.bookingDate,
      start_time: item.startTime,
      end_time: item.endTime,
    });
  }

  const totalPrice = createdBookings.reduce((s, b) => s + Number(b.total_price || 0), 0);

  return {
    totalBookings: createdBookings.length,
    totalPrice,
    firstBookingId: createdBookings[0]?.booking_id || null,
    bookings: createdBookings,
  };
}

/**
 * Lấy danh sách booking dựa theo vai trò của người dùng (Strict RBAC Data Scoping)
 * kèm chi tiết lịch sử giao dịch (transactions), trạng thái thanh toán và hoàn tiền (S3-10).
 * @param {{ id: number, role: string }} user
 */
export async function getBookingsByUser(user, filters = {}) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  let bookingsRecordset = [];

  if (userRole === 'owner') {
    const result = await pool
      .request()
      .input('ownerId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               b.payment_status, b.payment_method, b.cancel_reason, b.cancelled_at, b.refund_amount,
               c.court_name, c.address AS court_address, c.facility_id, c.images AS court_images,
               c.sport_id, s.sport_name,
               f.name AS facility_name, f.address AS facility_address, f.phone AS facility_phone,
               COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
               COALESCE(cust.email, u.email, '') AS player_email,
               COALESCE(cust.phone, u.phone, '') AS player_phone,
               COALESCE(cust.reputation_score, u.reputation_score, 5.0) AS reputation_score
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        LEFT JOIN sports s ON c.sport_id = s.sport_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        LEFT JOIN customers cust ON b.customer_id = cust.customer_id
        LEFT JOIN users u ON b.user_id = u.user_id
        WHERE c.owner_id = @ownerId
        ORDER BY b.booking_date DESC, b.start_time ASC
      `);
    bookingsRecordset = result.recordset;
  } else if (userRole === 'staff') {
    const result = await pool
      .request()
      .input('staffId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               b.payment_status, b.payment_method, b.cancel_reason, b.cancelled_at, b.refund_amount,
               c.court_name, c.address AS court_address, c.facility_id, c.images AS court_images,
               c.sport_id, s.sport_name,
               f.name AS facility_name, f.address AS facility_address, f.phone AS facility_phone,
               COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
               COALESCE(cust.email, u.email, '') AS player_email,
               COALESCE(cust.phone, u.phone, '') AS player_phone,
               COALESCE(cust.reputation_score, u.reputation_score, 5.0) AS reputation_score
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        LEFT JOIN sports s ON c.sport_id = s.sport_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        LEFT JOIN customers cust ON b.customer_id = cust.customer_id
        LEFT JOIN users u ON b.user_id = u.user_id
        WHERE c.court_id IN (SELECT court_id FROM court_staff WHERE staff_id = @staffId)
        ORDER BY b.booking_date DESC, b.start_time ASC
      `);
    bookingsRecordset = result.recordset;
  } else {
    const result = await pool
      .request()
      .input('userId', user.id)
      .query(`
        SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
               b.total_price, b.deposit_amount, b.status, b.created_at,
               b.payment_status, b.payment_method, b.cancel_reason, b.cancelled_at, b.refund_amount,
               c.court_name, COALESCE(c.address, f.address) AS court_address, c.facility_id, c.images AS court_images,
               c.sport_id, s.sport_name,
               f.name AS facility_name, f.address AS facility_address, f.phone AS facility_phone
        FROM bookings b
        JOIN courts c ON b.court_id = c.court_id
        LEFT JOIN sports s ON c.sport_id = s.sport_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        WHERE b.user_id = @userId
        ORDER BY b.booking_date DESC, b.start_time DESC, b.booking_id DESC
      `);
    bookingsRecordset = result.recordset;
  }

  if (bookingsRecordset.length === 0) {
    return [];
  }

  // Đính kèm danh sách giao dịch (transactions) cho từng đơn đặt sân
  const bookingIds = bookingsRecordset.map((b) => b.booking_id);
  const txMap = {};

  if (bookingIds.length > 0) {
    const txRes = await pool.request().query(`
      SELECT transaction_id, booking_id, user_id, amount, transaction_type, payment_method,
             status, order_code, gateway_trans_id, note, created_at
      FROM transactions
      WHERE booking_id IN (${bookingIds.join(',')})
      ORDER BY created_at DESC, transaction_id DESC
    `);

    txRes.recordset.forEach((tx) => {
      if (!txMap[tx.booking_id]) txMap[tx.booking_id] = [];
      txMap[tx.booking_id].push({
        transaction_id: tx.transaction_id,
        booking_id: tx.booking_id,
        amount: Number(tx.amount || 0),
        transaction_type: tx.transaction_type,
        payment_method: tx.payment_method,
        status: tx.status,
        order_code: tx.order_code || `TX-${tx.transaction_id}`,
        gateway_trans_id: tx.gateway_trans_id || null,
        note: tx.note || null,
        created_at: tx.created_at,
      });
    });
  }

  const mappedList = bookingsRecordset.map((b) => {
    const txs = txMap[b.booking_id] || [];
    const totalPaidTx = txs
      .filter((t) => t.status === 'SUCCESS' && t.transaction_type !== 'REFUND')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalRefundTx = txs
      .filter((t) => t.status === 'SUCCESS' && t.transaction_type === 'REFUND')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalPrice = Number(b.total_price || 0);
    const depositAmount = Number(b.deposit_amount || 0);
    const paidAmount = Math.max(totalPaidTx, depositAmount);
    const refundedAmount = Math.max(totalRefundTx, Number(b.refund_amount || 0));
    const netPaidAmount = Math.max(0, paidAmount - refundedAmount);
    const remainingAmount =
      (b.status || '').toUpperCase() === 'CANCELLED'
        ? 0
        : Math.max(0, totalPrice - netPaidAmount);

    let derivedPaymentStatus = b.payment_status || 'UNPAID';
    if (refundedAmount > 0) {
      derivedPaymentStatus = 'REFUNDED';
    } else if (paidAmount >= totalPrice && totalPrice > 0) {
      derivedPaymentStatus = 'PAID';
    } else if (paidAmount > 0) {
      derivedPaymentStatus = 'DEPOSIT_PAID';
    }

    return {
      ...b,
      booking_date: formatDateStr(b.booking_date),
      start_time: formatTimeStr(b.start_time),
      end_time: formatTimeStr(b.end_time),
      total_price: totalPrice,
      deposit_amount: depositAmount,
      paid_amount: paidAmount,
      refunded_amount: refundedAmount,
      remaining_amount: remainingAmount,
      payment_status: derivedPaymentStatus,
      payment_method: b.payment_method || txs.find((t) => t.status === 'SUCCESS')?.payment_method || null,
      transactions: txs,
    };
  });

  // [3.1 - S3-14] Bộ lọc danh sách đơn đặt sân online cho Owner / Staff / Player
  let filteredList = mappedList;
  if (filters.status && filters.status !== 'ALL') {
    const targetSt = String(filters.status).toUpperCase();
    filteredList = filteredList.filter((b) => (b.status || '').toUpperCase() === targetSt);
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    const targetPay = String(filters.paymentStatus).toUpperCase();
    filteredList = filteredList.filter((b) => (b.payment_status || '').toUpperCase() === targetPay);
  }
  if (filters.facilityId && filters.facilityId !== 'ALL') {
    filteredList = filteredList.filter((b) => String(b.facility_id) === String(filters.facilityId));
  }
  if (filters.courtId && filters.courtId !== 'ALL') {
    filteredList = filteredList.filter((b) => String(b.court_id) === String(filters.courtId));
  }
  if (filters.sportId && filters.sportId !== 'ALL') {
    filteredList = filteredList.filter((b) => String(b.sport_id) === String(filters.sportId));
  }
  if (filters.startDate) {
    filteredList = filteredList.filter((b) => b.booking_date >= filters.startDate);
  }
  if (filters.endDate) {
    filteredList = filteredList.filter((b) => b.booking_date <= filters.endDate);
  }
  if (filters.keyword && String(filters.keyword).trim() !== '') {
    const kw = String(filters.keyword).trim().toLowerCase();
    filteredList = filteredList.filter(
      (b) =>
        String(b.booking_id).includes(kw) ||
        `#spl-${b.booking_id}`.includes(kw) ||
        (b.player_name || '').toLowerCase().includes(kw) ||
        (b.player_phone || '').toLowerCase().includes(kw) ||
        (b.player_email || '').toLowerCase().includes(kw) ||
        (b.court_name || '').toLowerCase().includes(kw) ||
        (b.facility_name || '').toLowerCase().includes(kw)
    );
  }

  return filteredList;
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

  // 2. Lấy danh sách các sân thuộc quyền quản lý của Owner / Staff (Strict Scoping)
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
 * Lấy thông tin một booking theo ID kèm lịch sử giao dịch.
 */
export async function getBookingById(bookingId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', bookingId)
    .query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.customer_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             b.payment_status, b.payment_method, b.cancel_reason, b.cancelled_at, b.refund_amount,
             c.court_name, COALESCE(c.address, f.address) AS court_address, c.owner_id, c.facility_id,
             c.sport_id, s.sport_name, f.name AS facility_name, f.phone AS facility_phone,
             COALESCE(cust.full_name, u.full_name, N'Khách vãng lai') AS player_name,
             COALESCE(cust.email, u.email, '') AS player_email,
             COALESCE(cust.phone, u.phone, '') AS player_phone
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN sports s ON c.sport_id = s.sport_id
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      LEFT JOIN customers cust ON b.customer_id = cust.customer_id
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = @id
    `);

  const booking = result.recordset[0];
  if (!booking) return null;

  const txRes = await pool
    .request()
    .input('bookingId', booking.booking_id)
    .query(`
      SELECT transaction_id, booking_id, user_id, amount, transaction_type, payment_method,
             status, order_code, gateway_trans_id, note, created_at
      FROM transactions
      WHERE booking_id = @bookingId
      ORDER BY created_at DESC, transaction_id DESC
    `);

  return {
    ...booking,
    booking_date: formatDateStr(booking.booking_date),
    start_time: formatTimeStr(booking.start_time),
    end_time: formatTimeStr(booking.end_time),
    total_price: Number(booking.total_price || 0),
    deposit_amount: Number(booking.deposit_amount || 0),
    refund_amount: Number(booking.refund_amount || 0),
    transactions: txRes.recordset.map((tx) => ({
      ...tx,
      amount: Number(tx.amount || 0),
    })),
  };
}

/**
 * [S3-07] Tạo mới một booking với cơ chế SQL Transaction Lock (WITH UPDLOCK, HOLDLOCK)
 * chống đặt trùng sân khi có nhiều request đồng thời cùng 1 giây (Race Condition - TC02, Rủi ro R01).
 * Trả HTTP 409 Conflict cho mọi request đến sau hoặc xung đột khung giờ.
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
    paymentMethod = null,
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
  const actorRole = (actorUser?.role || '').toLowerCase();

  // 1. Tra cứu / Lưu thông tin khách hàng trong bảng [customers] và kiểm tra trạng thái khóa (LOCKED)
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
      targetUserId = custRow.user_id || (actorRole === 'player' ? actorUser?.id : null);

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
          `SELECT user_id, email, status FROM users WHERE phone = @phone AND UPPER(role) = 'PLAYER'`
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

      const linkedUserId =
        linkedPlayer.recordset[0]?.user_id ||
        (actorRole === 'player' ? actorUser?.id : null);
      const finalEmail = cleanEmail || linkedPlayer.recordset[0]?.email || null;

      try {
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
      } catch {
        // Trường hợp 2 request đồng thời cùng chèn 1 SĐT mới vào bảng customers (UQ_customers_phone)
        const retryCust = await pool
          .request()
          .input('phone', cleanPhone)
          .query('SELECT customer_id, user_id FROM customers WHERE phone = @phone');
        targetCustomerId = retryCust.recordset[0]?.customer_id || null;
        targetUserId = retryCust.recordset[0]?.user_id || linkedUserId;
      }
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
          try {
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
          } catch {
            const retryCust = await pool
              .request()
              .input('phone', appUser.phone)
              .query('SELECT customer_id FROM customers WHERE phone = @phone');
            targetCustomerId = retryCust.recordset[0]?.customer_id || null;
          }
        }
      }
    }
  } else {
    throw new AppError('Vui lòng nhập Số điện thoại khách hàng khi tạo đơn đặt sân tại quầy.', 400);
  }

  // ============================================================================
  // 2. BẮT ĐẦU TRANSACTION LOCK CHỐNG ĐẶT TRÙNG SÂN CÙNG 1 GIÂY (S3-07 / TC02)
  // ============================================================================
  let created = null;
  let courtOwnerId = null;
  let courtNameForNotif = '';

  await withCourtLock(courtId, async () => {
    const transaction = new sql.Transaction(pool);
    let txBegun = false;

    try {
      await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      txBegun = true;

      // Bước 2.1: Khóa dòng sân (Row-level Update Lock trên bảng courts theo court_id)
      const courtRes = await new sql.Request(transaction)
        .input('courtId', Number(courtId))
        .query(`
          SELECT c.court_id, c.court_name, c.status, c.owner_id, c.facility_id,
                 f.status AS facility_status
          FROM courts c WITH (UPDLOCK, HOLDLOCK)
          LEFT JOIN facilities f ON c.facility_id = f.facility_id
          WHERE c.court_id = @courtId
        `);

      const court = courtRes.recordset[0];
      if (!court) {
        throw new AppError('Không tìm thấy sân thể thao này.', 404);
      }

      courtOwnerId = court.owner_id;
      courtNameForNotif = court.court_name;

      if (actorRole === 'owner' && Number(court.owner_id) !== Number(actorUser.id)) {
        throw new AppError('Bạn không có quyền tạo lịch đặt trên sân của chủ sân khác.', 403);
      }
      if (actorRole === 'staff') {
        const staffAssign = await new sql.Request(transaction)
          .input('staffId', actorUser.id)
          .input('courtId', Number(courtId))
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

      // Bước 2.2: Kiểm tra xung đột lịch đặt với khóa UPDLOCK, HOLDLOCK trên bảng bookings
      const conflictRes = await new sql.Request(transaction)
        .input('courtId', Number(courtId))
        .input('bookingDate', cleanDate)
        .input('startTime', `${cleanStart}:00`)
        .input('endTime', `${cleanEnd}:00`)
        .query(`
          SELECT booking_id, start_time, end_time, status
          FROM bookings WITH (UPDLOCK, HOLDLOCK)
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

      // Bước 2.3: Kiểm tra xung đột với lịch bảo trì sân
      const maintConflict = await new sql.Request(transaction)
        .input('courtId', Number(courtId))
        .input('startDt', `${cleanDate}T${cleanStart}:00`)
        .input('endDt', `${cleanDate}T${cleanEnd}:00`)
        .query(`
          SELECT maintenance_id, reason
          FROM court_maintenances WITH (HOLDLOCK)
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

      // Bước 2.4: Tính tổng tiền tự động phía Server từ bảng giá động court_prices (TC01)
      const priceRulesRes = await new sql.Request(transaction)
        .input('courtId', Number(courtId))
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
      if (actorRole === 'owner' || actorRole === 'staff') {
        const requestedStatus = (status || 'CONFIRMED').toUpperCase();
        cleanStatus = ['PENDING', 'CONFIRMED', 'CHECKED-IN'].includes(requestedStatus)
          ? requestedStatus
          : 'CONFIRMED';
      }

      const finalDeposit =
        actorRole === 'owner' || actorRole === 'staff'
          ? Math.max(0, Math.min(finalPrice, Number(depositAmount || 0)))
          : 0;

      const initialPaymentStatus =
        finalDeposit >= finalPrice && finalPrice > 0
          ? 'PAID'
          : finalDeposit > 0
            ? 'DEPOSIT_PAID'
            : 'UNPAID';

      const cleanPaymentMethod = paymentMethod
        ? String(paymentMethod).toUpperCase()
        : finalDeposit > 0
          ? 'CASH'
          : null;

      // Bước 2.5: Ghi bản ghi booking trong cùng Transaction đang giữ khóa
      const insertResult = await new sql.Request(transaction)
        .input('courtId', Number(courtId))
        .input('userId', targetUserId)
        .input('customerId', targetCustomerId)
        .input('bookingDate', cleanDate)
        .input('startTime', `${cleanStart}:00`)
        .input('endTime', `${cleanEnd}:00`)
        .input('totalPrice', finalPrice)
        .input('depositAmount', finalDeposit)
        .input('status', cleanStatus)
        .input('paymentStatus', initialPaymentStatus)
        .input('paymentMethod', cleanPaymentMethod)
        .query(`
          INSERT INTO bookings (
            court_id, user_id, customer_id, booking_date, start_time, end_time,
            total_price, deposit_amount, status, payment_status, payment_method, created_at, updated_at
          )
          OUTPUT INSERTED.*
          VALUES (
            @courtId, @userId, @customerId, @bookingDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME),
            @totalPrice, @depositAmount, @status, @paymentStatus, @paymentMethod, GETDATE(), GETDATE()
          )
        `);

      created = insertResult.recordset[0];

      // Ghi nhận giao dịch tiền cọc tại quầy nếu có
      if (finalDeposit > 0) {
        await new sql.Request(transaction)
          .input('bookingId', created.booking_id)
          .input('userId', targetUserId)
          .input('amount', finalDeposit)
          .input('orderCode', `WALKIN-SPL${created.booking_id}-${Date.now()}`)
          .input('method', cleanPaymentMethod || 'CASH')
          .query(`
            INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, order_code, note, created_at)
            VALUES (@bookingId, @userId, @amount, 'DEPOSIT', @method, 'SUCCESS', @orderCode, N'Thu tiền cọc trực tiếp tại quầy', GETDATE())
          `);
      }

      await transaction.commit();
      txBegun = false;
    } catch (err) {
      if (txBegun) {
        try {
          await transaction.rollback();
        } catch {
          // ignore rollback error
        }
      }

      if (newlyCreatedCustomerId) {
        try {
          await pool
            .request()
            .input('cid', newlyCreatedCustomerId)
            .query(
              'DELETE FROM customers WHERE customer_id = @cid AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = @cid)'
            );
        } catch {
          // ignore cleanup error
        }
      }

      // Nếu SQL Server ném lỗi Deadlock (1205) hoặc Lock Timeout khi tranh chấp đồng thời, chuyển thành HTTP 409 Conflict chuẩn TC02
      if (err && (err.number === 1205 || err.number === 1222 || err.number === 2601 || err.number === 2627)) {
        throw new AppError(
          `Khung giờ ${cleanStart} - ${cleanEnd} ngày ${cleanDate} vừa được người chơi khác đặt trước một tích tắc. Vui lòng chọn khung giờ khác.`,
          409
        );
      }

      throw err;
    }
  });

  // Ghi nhận thông báo hệ thống sau khi commit thành công
  if (created) {
    if (targetUserId) {
      await createNotificationSafe(pool, {
        userId: targetUserId,
        title: `Đặt sân #SPL-${created.booking_id} thành công`,
        content: `Đơn đặt sân "${courtNameForNotif}" ngày ${cleanDate} (${cleanStart} - ${cleanEnd}) đã được tạo. Tổng tiền: ${Number(created.total_price).toLocaleString('vi-VN')}đ.`,
      });
    }
    if (courtOwnerId && courtOwnerId !== targetUserId) {
      await createNotificationSafe(pool, {
        userId: courtOwnerId,
        title: `Có đơn đặt sân mới #SPL-${created.booking_id}`,
        content: `Sân "${courtNameForNotif}" có lịch đặt mới vào ${cleanStart} - ${cleanEnd} ngày ${cleanDate}.`,
      });
    }
  }

  return created;
}

/**
 * ============================================================================
 * [S3-08 & S3-09] CỔNG THANH TOÁN SANDBOX (VNPAY / MOMO), WEBHOOK HMAC & VIETQR
 * ============================================================================
 */

/**
 * Sinh thông tin thanh toán dự phòng VietQR chuẩn Napas 247 (S3-09 - Rủi ro R2/R07).
 */
export function buildVietQrFallbackPayload({
  bookingId,
  amount,
  orderCode,
  playerPhone = '',
  courtName = '',
}) {
  const bankId = 'MB';
  const bankName = 'MBBank (Ngân hàng TMCP Quân Đội)';
  const accountNo = '0901234567888';
  const accountName = 'CONG TY THE THAO SPORTLINK';
  const cleanAmount = Math.max(0, Math.round(Number(amount || 0)));
  const cleanPhone = String(playerPhone || '').replace(/\D/g, '').slice(-6);
  const transferContent = `SPL ${bookingId}${cleanPhone ? ' ' + cleanPhone : ''}`;

  const qrImageUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${cleanAmount}&addInfo=${encodeURIComponent(
    transferContent
  )}&accountName=${encodeURIComponent(accountName)}`;

  return {
    provider: 'VIETQR_NAPAS247',
    bankId,
    bankBin: '970422',
    bankName,
    accountNo,
    accountName,
    amount: cleanAmount,
    transferContent,
    orderCode: orderCode || `VIETQR-SPL${bookingId}`,
    courtName,
    qrImageUrl,
    expiresInSeconds: 900, // Giữ chỗ thanh toán 15 phút
    instructions: [
      'Mở ứng dụng Ngân hàng bất kỳ (Vietcombank, MBBank, Techcombank, BIDV, MoMo, ZaloPay...)',
      'Chọn tính năng Quét mã QR (VietQR Napas 247)',
      `Kiểm tra đúng số tiền ${cleanAmount.toLocaleString('vi-VN')}đ và nội dung "${transferContent}"`,
      'Sau khi chuyển khoản thành công, bấm nút "Xác nhận đã chuyển khoản" bên dưới để hệ thống đối soát tức thì.',
    ],
  };
}

/**
 * [S3-08] Khởi tạo giao dịch thanh toán qua cổng Sandbox (VNPay / MoMo) hoặc VietQR dự phòng.
 */
export async function initiateBookingPayment(bookingId, data = {}, actorUser = null) {
  const cleanBookingId = Number(bookingId);
  if (!cleanBookingId || isNaN(cleanBookingId)) {
    throw new AppError('Mã đơn đặt sân không hợp lệ.', 400);
  }

  const booking = await getBookingById(cleanBookingId);
  if (!booking) {
    throw new AppError('Không tìm thấy đơn đặt sân.', 404);
  }

  const currentStatus = (booking.status || 'PENDING').toUpperCase();
  if (currentStatus === 'CANCELLED' || currentStatus === 'NO-SHOW') {
    throw new AppError(
      `Không thể thanh toán cho đơn đặt sân đã ở trạng thái ${currentStatus}.`,
      400
    );
  }

  const rawMethod = (data.paymentMethod || 'VNPAY').toUpperCase();
  const allowedMethods = ['VNPAY', 'MOMO', 'VIETQR', 'BANK_TRANSFER', 'CASH'];
  const paymentMethod = allowedMethods.includes(rawMethod) ? rawMethod : 'VNPAY';

  const paymentType =
    (data.paymentType || 'FULL_PAYMENT').toUpperCase() === 'DEPOSIT'
      ? 'DEPOSIT'
      : 'FULL_PAYMENT';

  const pool = await getPool();
  const paidRes = await pool
    .request()
    .input('bookingId', cleanBookingId)
    .query(`
      SELECT ISNULL(SUM(
        CASE WHEN transaction_type = 'REFUND' THEN -amount ELSE amount END
      ), 0) AS net_paid
      FROM transactions
      WHERE booking_id = @bookingId AND status = 'SUCCESS'
    `);

  const alreadyPaid = Math.max(
    Number(paidRes.recordset[0]?.net_paid || 0),
    Number(booking.deposit_amount || 0)
  );
  const totalPrice = Number(booking.total_price || 0);
  const remainingAmount = Math.max(0, totalPrice - alreadyPaid);

  if (remainingAmount <= 0) {
    throw new AppError('Đơn đặt sân này đã được thanh toán đầy đủ.', 400);
  }

  let amountToPay = remainingAmount;
  if (paymentType === 'DEPOSIT' && alreadyPaid === 0) {
    amountToPay = Math.max(10000, Math.round(totalPrice * 0.3));
  }
  if (data.amount && Number(data.amount) > 0) {
    amountToPay = Math.min(remainingAmount, Math.round(Number(data.amount)));
  }

  const orderCode = `SPL${cleanBookingId}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const successSignature = generatePaymentSignature({
    orderCode,
    bookingId: cleanBookingId,
    amount: amountToPay,
    paymentMethod,
    resultCode: '00',
  });
  const failedSignature = generatePaymentSignature({
    orderCode,
    bookingId: cleanBookingId,
    amount: amountToPay,
    paymentMethod,
    resultCode: '24',
  });

  // Lưu giao dịch ở trạng thái PENDING để đối soát khi Webhook gọi về
  const txInsert = await pool
    .request()
    .input('bookingId', cleanBookingId)
    .input('userId', booking.user_id || actorUser?.id || null)
    .input('amount', amountToPay)
    .input('txType', paymentType)
    .input('method', paymentMethod)
    .input('orderCode', orderCode)
    .input('signature', successSignature)
    .input(
      'note',
      `Khởi tạo thanh toán ${paymentType === 'DEPOSIT' ? 'đặt cọc 30%' : 'toàn bộ 100%'} qua ${paymentMethod}`
    )
    .query(`
      INSERT INTO transactions (
        booking_id, user_id, amount, transaction_type, payment_method,
        status, order_code, signature, note, created_at, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @bookingId, @userId, @amount, @txType, @method,
        'PENDING', @orderCode, @signature, @note, GETDATE(), GETDATE()
      )
    `);

  const pendingTx = txInsert.recordset[0];
  const vietQrData = buildVietQrFallbackPayload({
    bookingId: cleanBookingId,
    amount: amountToPay,
    orderCode,
    playerPhone: booking.player_phone,
    courtName: booking.court_name,
  });

  const sandboxGatewayUrl =
    paymentMethod === 'MOMO'
      ? `https://test-payment.momo.vn/v2/gateway/pay?partnerCode=MOMOSPORTLINK&orderId=${orderCode}&amount=${amountToPay}&signature=${successSignature.slice(0, 32)}`
      : `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TmnCode=SPORTLNK&vnp_TxnRef=${orderCode}&vnp_Amount=${amountToPay * 100}&vnp_SecureHash=${successSignature.slice(0, 32)}`;

  return {
    transactionId: pendingTx.transaction_id,
    orderCode,
    bookingId: cleanBookingId,
    courtName: booking.court_name,
    facilityName: booking.facility_name,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    totalPrice,
    alreadyPaid,
    amount: amountToPay,
    remainingAfterPay: Math.max(0, remainingAmount - amountToPay),
    paymentType,
    paymentMethod,
    status: 'PENDING',
    sandboxGateway: {
      provider:
        paymentMethod === 'MOMO'
          ? 'MOMO_SANDBOX'
          : paymentMethod === 'VIETQR' || paymentMethod === 'BANK_TRANSFER'
            ? 'VIETQR_NAPAS247'
            : 'VNPAY_SANDBOX',
      terminalCode: paymentMethod === 'MOMO' ? 'MOMOSPORTLINK2026' : 'VNPAY_SPORTLINK_SANDBOX',
      checkoutUrl: sandboxGatewayUrl,
      webhookEndpoint: '/api/bookings/payment/webhook',
      // Các gói tin mẫu có chữ ký số HMAC-SHA512 phục vụ giả lập Callback từ Cổng Sandbox
      webhookPayloads: {
        success: {
          orderCode,
          bookingId: cleanBookingId,
          amount: amountToPay,
          paymentMethod,
          resultCode: '00',
          gatewayTransId: `${paymentMethod}-SBX-${Date.now()}`,
          message: 'Giao dịch thanh toán Sandbox thành công (Mã 00)',
          signature: successSignature,
        },
        failed: {
          orderCode,
          bookingId: cleanBookingId,
          amount: amountToPay,
          paymentMethod,
          resultCode: '24',
          gatewayTransId: `${paymentMethod}-ERR-${Date.now()}`,
          message: 'Khách hàng hủy giao dịch hoặc cổng thanh toán Sandbox bảo trì (Mã 24)',
          signature: failedSignature,
        },
      },
    },
    vietQrFallback: vietQrData,
  };
}

/**
 * [S3-08] Xử lý Webhook / IPN từ cổng thanh toán Sandbox (VNPay / MoMo / VietQR).
 * Bắt buộc xác thực chữ ký số HMAC-SHA512 (Rủi ro R07) và đảm bảo tính Idempotent.
 */
export async function processPaymentWebhook(payload = {}) {
  const {
    orderCode,
    bookingId,
    amount,
    paymentMethod = 'VNPAY',
    resultCode = '00',
    gatewayTransId,
    message,
    signature,
  } = payload;

  if (!orderCode || !bookingId || amount === undefined || amount === null) {
    throw new AppError(
      'Dữ liệu Webhook thiếu thông tin bắt buộc (orderCode, bookingId, amount).',
      400
    );
  }

  const isSignatureValid = verifyPaymentSignature({
    orderCode,
    bookingId: Number(bookingId),
    amount: Number(amount),
    paymentMethod,
    resultCode: String(resultCode),
    signature,
  });

  if (!isSignatureValid) {
    throw new AppError(
      'Chữ ký số bảo mật Webhook (HMAC-SHA512) không hợp lệ! Hệ thống từ chối cập nhật giao dịch (R07).',
      400
    );
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);

  try {
    // Khóa giao dịch theo order_code để chống xử lý trùng lặp (Idempotency)
    const txRes = await new sql.Request(transaction)
      .input('orderCode', String(orderCode))
      .query(`
        SELECT *
        FROM transactions WITH (UPDLOCK, HOLDLOCK)
        WHERE order_code = @orderCode
      `);

    const existingTx = txRes.recordset[0];
    if (!existingTx) {
      await transaction.rollback();
      throw new AppError(`Không tìm thấy giao dịch với mã đơn ${orderCode}.`, 404);
    }

    // Nếu giao dịch đã SUCCESS trước đó -> trả về Idempotent (không cộng dồn tiền lần 2)
    if ((existingTx.status || '').toUpperCase() === 'SUCCESS') {
      await transaction.commit();
      const updatedBooking = await getBookingById(Number(bookingId));
      return {
        idempotent: true,
        status: 'SUCCESS',
        message: 'Giao dịch này đã được đối soát thành công trước đó (Idempotent).',
        orderCode,
        bookingId: Number(bookingId),
        booking: updatedBooking,
      };
    }

    const isSuccess = String(resultCode) === '00';
    const cleanGatewayId =
      gatewayTransId || `${String(paymentMethod).toUpperCase()}-${Date.now()}`;
    const rawJson = JSON.stringify(payload);

    if (isSuccess) {
      // 1. Cập nhật trạng thái transaction -> SUCCESS
      await new sql.Request(transaction)
        .input('txId', existingTx.transaction_id)
        .input('gatewayId', cleanGatewayId)
        .input('rawPayload', rawJson)
        .input('note', message || `Thanh toán thành công qua ${paymentMethod}`)
        .query(`
          UPDATE transactions
          SET status = 'SUCCESS',
              gateway_trans_id = @gatewayId,
              raw_payload = @rawPayload,
              note = @note,
              updated_at = GETDATE()
          WHERE transaction_id = @txId
        `);

      // 2. Tính tổng số tiền thực nhận của đơn đặt sân
      const sumRes = await new sql.Request(transaction)
        .input('bookingId', Number(bookingId))
        .query(`
          SELECT ISNULL(SUM(
            CASE WHEN transaction_type = 'REFUND' THEN -amount ELSE amount END
          ), 0) AS net_paid
          FROM transactions
          WHERE booking_id = @bookingId AND status = 'SUCCESS'
        `);

      const netPaid = Math.max(0, Number(sumRes.recordset[0]?.net_paid || 0));

      // 3. Cập nhật trạng thái đơn đặt sân (PENDING -> CONFIRMED) và trạng thái thanh toán
      const bkRes = await new sql.Request(transaction)
        .input('bookingId', Number(bookingId))
        .query(`
          SELECT booking_id, total_price, status, user_id, court_id
          FROM bookings WITH (UPDLOCK, HOLDLOCK)
          WHERE booking_id = @bookingId
        `);

      const bk = bkRes.recordset[0];
      if (bk) {
        const totalPrice = Number(bk.total_price || 0);
        const newPayStatus = netPaid >= totalPrice && totalPrice > 0 ? 'PAID' : 'DEPOSIT_PAID';
        const currentBkStatus = (bk.status || 'PENDING').toUpperCase();
        const nextBkStatus = currentBkStatus === 'PENDING' ? 'CONFIRMED' : currentBkStatus;

        await new sql.Request(transaction)
          .input('bookingId', Number(bookingId))
          .input('depositAmount', Math.min(totalPrice, netPaid))
          .input('status', nextBkStatus)
          .input('paymentStatus', newPayStatus)
          .input('paymentMethod', String(paymentMethod).toUpperCase())
          .query(`
            UPDATE bookings
            SET deposit_amount = @depositAmount,
                status = @status,
                payment_status = @paymentStatus,
                payment_method = @paymentMethod,
                updated_at = GETDATE()
            WHERE booking_id = @bookingId
          `);
      }

      await transaction.commit();

      const updatedBooking = await getBookingById(Number(bookingId));
      if (updatedBooking?.user_id) {
        await createNotificationSafe(pool, {
          userId: updatedBooking.user_id,
          title: `Thanh toán thành công đơn #SPL-${bookingId}`,
          content: `Hệ thống đã nhận ${Number(amount).toLocaleString('vi-VN')}đ qua ${paymentMethod} (Mã GD: ${cleanGatewayId}). Lịch đặt sân "${updatedBooking.court_name}" đã được xác nhận!`,
        });
      }
      if (updatedBooking?.owner_id) {
        await createNotificationSafe(pool, {
          userId: updatedBooking.owner_id,
          title: `Khách đã thanh toán đơn #SPL-${bookingId}`,
          content: `Đơn đặt sân "${updatedBooking.court_name}" đã thanh toán ${Number(amount).toLocaleString('vi-VN')}đ qua ${paymentMethod}.`,
        });
      }

      return {
        idempotent: false,
        status: 'SUCCESS',
        message: 'Đối soát Webhook thanh toán thành công! Đơn đặt sân đã được xác nhận.',
        orderCode,
        gatewayTransId: cleanGatewayId,
        bookingId: Number(bookingId),
        booking: updatedBooking,
      };
    } else {
      // Giao dịch thất bại hoặc người dùng hủy trên cổng Sandbox -> Gợi ý chuyển sang VietQR dự phòng (S3-09)
      await new sql.Request(transaction)
        .input('txId', existingTx.transaction_id)
        .input('gatewayId', cleanGatewayId)
        .input('rawPayload', rawJson)
        .input('note', message || `Giao dịch thất bại tại cổng ${paymentMethod} (Mã lỗi: ${resultCode})`)
        .query(`
          UPDATE transactions
          SET status = 'FAILED',
              gateway_trans_id = @gatewayId,
              raw_payload = @rawPayload,
              note = @note,
              updated_at = GETDATE()
          WHERE transaction_id = @txId
        `);

      await transaction.commit();
      const updatedBooking = await getBookingById(Number(bookingId));

      return {
        idempotent: false,
        status: 'FAILED',
        resultCode: String(resultCode),
        message:
          message ||
          'Giao dịch thanh toán trực tuyến không thành công. Bạn có thể thử lại hoặc chuyển sang quét mã VietQR dự phòng.',
        orderCode,
        bookingId: Number(bookingId),
        fallbackRecommended: true,
        vietQrFallback: buildVietQrFallbackPayload({
          bookingId: Number(bookingId),
          amount: Number(amount),
          orderCode: `VIETQR-${orderCode}`,
          playerPhone: updatedBooking?.player_phone,
          courtName: updatedBooking?.court_name,
        }),
        booking: updatedBooking,
      };
    }
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      // ignore
    }
    throw err;
  }
}

/**
 * [S3-09] Lấy thông tin mã QR chuyển khoản dự phòng VietQR cho đơn đặt sân.
 */
export async function getVietQrFallbackForBooking(bookingId, query = {}) {
  const booking = await getBookingById(Number(bookingId));
  if (!booking) {
    throw new AppError('Không tìm thấy đơn đặt sân.', 404);
  }

  const paidAmount = booking.transactions
    .filter((t) => t.status === 'SUCCESS' && t.transaction_type !== 'REFUND')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const refundedAmount = booking.transactions
    .filter((t) => t.status === 'SUCCESS' && t.transaction_type === 'REFUND')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const netPaid = Math.max(paidAmount - refundedAmount, Number(booking.deposit_amount || 0));
  const remaining = Math.max(0, Number(booking.total_price || 0) - netPaid);
  const amount =
    query.paymentType === 'DEPOSIT' && netPaid === 0
      ? Math.round(Number(booking.total_price || 0) * 0.3)
      : remaining || Number(booking.total_price || 0);

  return buildVietQrFallbackPayload({
    bookingId: booking.booking_id,
    amount,
    orderCode: `VIETQR-SPL${booking.booking_id}-${Date.now()}`,
    playerPhone: booking.player_phone,
    courtName: booking.court_name,
  });
}

/**
 * [S3-09] Xác nhận thanh toán qua phương án dự phòng VietQR (Đối soát chuyển khoản ngân hàng).
 */
export async function confirmVietQrPayment(bookingId, data = {}, actorUser = null) {
  const session = await initiateBookingPayment(
    bookingId,
    {
      paymentMethod: 'VIETQR',
      paymentType: data.paymentType || 'FULL_PAYMENT',
      amount: data.amount,
    },
    actorUser
  );

  const bankRef = data.bankRefCode || `NAPAS247-${Date.now()}`;
  return processPaymentWebhook({
    ...session.sandboxGateway.webhookPayloads.success,
    gatewayTransId: bankRef,
    message: `Đối soát chuyển khoản VietQR Napas 247 thành công (Mã tham chiếu: ${bankRef})`,
  });
}

/**
 * ============================================================================
 * [S3-10] HỦY ĐẶT SÂN, GIẢI PHÓNG LỊCH SÂN (R04) VÀ HOÀN TIỀN TỰ ĐỘNG (REFUND)
 * ============================================================================
 */
export async function cancelBookingWithRefund(bookingId, data = {}, actorUser = null) {
  const cleanId = Number(bookingId);
  if (!cleanId || isNaN(cleanId)) {
    throw new AppError('Mã đơn đặt sân không hợp lệ.', 400);
  }

  const pool = await getPool();
  const currentBooking = await getBookingById(cleanId);
  if (!currentBooking) {
    throw new AppError('Không tìm thấy đơn đặt sân.', 404);
  }

  const currentStatus = (currentBooking.status || 'PENDING').toUpperCase();
  const actorRole = (actorUser?.role || '').toLowerCase();

  if (currentStatus === 'CANCELLED') {
    throw new AppError('Đơn đặt sân này đã được hủy trước đó.', 400);
  }
  if (currentStatus === 'COMPLETED' || currentStatus === 'NO-SHOW') {
    throw new AppError(
      `Không thể hủy đơn đặt sân đã ở trạng thái "${currentStatus}".`,
      400
    );
  }
  if (actorRole === 'player' && !['PENDING', 'CONFIRMED'].includes(currentStatus)) {
    throw new AppError(
      'Bạn chỉ có thể hủy đơn đặt sân khi đơn đang ở trạng thái Chờ xác nhận (PENDING) hoặc Đã xác nhận (CONFIRMED) trước giờ thi đấu.',
      403
    );
  }

  // Kiểm tra khoảng thời gian từ hiện tại đến giờ bắt đầu trận đấu
  const slotStartDt = new Date(`${currentBooking.booking_date}T${currentBooking.start_time}:00`);
  const now = new Date();
  const hoursUntilStart = (slotStartDt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (actorRole === 'player' && hoursUntilStart <= 0) {
    throw new AppError(
      'Không thể hủy đơn đặt sân vì khung giờ thi đấu đã bắt đầu hoặc đã qua.',
      400
    );
  }

  // Tính tổng số tiền khách đã thanh toán thành công cho đơn này
  const paidTxSum = (currentBooking.transactions || [])
    .filter((t) => t.status === 'SUCCESS' && t.transaction_type !== 'REFUND')
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const existingRefundSum = (currentBooking.transactions || [])
    .filter((t) => t.status === 'SUCCESS' && t.transaction_type === 'REFUND')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const netPaid = Math.max(
    0,
    Math.max(paidTxSum, Number(currentBooking.deposit_amount || 0)) - existingRefundSum
  );

  // Chính sách hoàn tiền (S3-10):
  // - Chủ sân/Staff hủy hoặc đơn đang PENDING hoặc người chơi hủy trước giờ bắt đầu >= 2 tiếng: Hoàn tiền 100%
  // - Người chơi hủy sát giờ (< 2 tiếng trước giờ bắt đầu): Hoàn tiền 70% (phí hủy sát giờ 30%)
  let refundRate = 1.0;
  let policyNote = 'Hoàn tiền 100% theo chính sách hủy trước giờ thi đấu >= 2 giờ';

  if (actorRole === 'player' && currentStatus === 'CONFIRMED' && hoursUntilStart < 2) {
    refundRate = 0.7;
    policyNote = 'Hoàn tiền 70% (trừ 30% phí hủy sát giờ < 2 giờ trước trận)';
  }

  const refundAmount = netPaid > 0 ? Math.round(netPaid * refundRate) : 0;
  const cancelReason =
    (data.cancelReason || data.reason || '').trim() ||
    (actorRole === 'player' ? 'Người chơi chủ động hủy lịch đặt sân' : 'Hủy bởi quản lý sân');

  const refundMethod =
    currentBooking.payment_method ||
    currentBooking.transactions?.find((t) => t.status === 'SUCCESS')?.payment_method ||
    'VNPAY';

  let refundTransaction = null;

  if (refundAmount > 0) {
    const refundOrderCode = `RFD-SPL${cleanId}-${Date.now()}`;
    const rfdRes = await pool
      .request()
      .input('bookingId', cleanId)
      .input('userId', currentBooking.user_id || actorUser?.id || null)
      .input('amount', refundAmount)
      .input('method', refundMethod)
      .input('orderCode', refundOrderCode)
      .input('note', `${policyNote}. Lý do: ${cancelReason}`)
      .query(`
        INSERT INTO transactions (
          booking_id, user_id, amount, transaction_type, payment_method,
          status, order_code, gateway_trans_id, note, created_at, updated_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @bookingId, @userId, @amount, 'REFUND', @method,
          'SUCCESS', @orderCode, @orderCode, @note, GETDATE(), GETDATE()
        )
      `);
    refundTransaction = rfdRes.recordset[0];
  }

  const nextPaymentStatus =
    refundAmount > 0 ? 'REFUNDED' : netPaid > 0 ? 'PARTIAL_REFUND' : 'UNPAID';

  await pool
    .request()
    .input('id', cleanId)
    .input('paymentStatus', nextPaymentStatus)
    .input('cancelReason', cancelReason)
    .input('refundAmount', refundAmount)
    .query(`
      UPDATE bookings
      SET status = 'CANCELLED',
          payment_status = @paymentStatus,
          cancel_reason = @cancelReason,
          cancelled_at = GETDATE(),
          refund_amount = ISNULL(refund_amount, 0) + @refundAmount,
          updated_at = GETDATE()
      WHERE booking_id = @id
    `);

  const updatedBooking = await getBookingById(cleanId);

  // Thông báo cho người chơi & chủ sân (kèm lý do hủy / từ chối rõ ràng - S3-14)
  if (currentBooking.user_id) {
    const isRejectedByOwner = cancelReason.startsWith('[Từ chối đơn]');
    const cleanReasonText = cancelReason.replace(/^\[Từ chối đơn\]\s*/i, '');
    await createNotificationSafe(pool, {
      userId: currentBooking.user_id,
      title: isRejectedByOwner
        ? `❌ Đơn đặt sân #SPL-${cleanId} đã bị từ chối`
        : `Đã hủy đơn đặt sân #SPL-${cleanId}`,
      content:
        refundAmount > 0
          ? `${isRejectedByOwner ? `Đơn đặt sân "${currentBooking.court_name}" đã bị từ chối. Lý do: ${cleanReasonText}.` : `Đơn đặt sân "${currentBooking.court_name}" đã được hủy (Lý do: ${cleanReasonText}).`} Hệ thống đã hoàn trả ${refundAmount.toLocaleString('vi-VN')}đ (${Math.round(refundRate * 100)}%) về phương thức ${refundMethod}.`
          : `${isRejectedByOwner ? `Đơn đặt sân "${currentBooking.court_name}" (${currentBooking.booking_date} ${currentBooking.start_time}-${currentBooking.end_time}) đã bị từ chối. Lý do: ${cleanReasonText}.` : `Đơn đặt sân "${currentBooking.court_name}" (${currentBooking.booking_date} ${currentBooking.start_time}-${currentBooking.end_time}) đã được hủy. Lý do: ${cleanReasonText}.`}`,
    });
  }

  return {
    booking: updatedBooking,
    refund: {
      hadPayment: netPaid > 0,
      paidAmount: netPaid,
      refundRate,
      refundAmount,
      policyNote,
      refundTransaction,
    },
  };
}

/**
 * [3.1 - S3-14] Chủ sân hoặc Nhân viên từ chối đơn đặt sân online của Người chơi (bắt buộc kèm lý do).
 * Tự động giải phóng sân, hoàn tiền 100% nếu khách đã thanh toán/cọc và gửi thông báo kèm lý do cho Người chơi.
 */
export async function rejectOnlineBooking(bookingId, data = {}, actorUser = null) {
  const actorRole = (actorUser?.role || '').toLowerCase();
  if (!['owner', 'staff', 'admin'].includes(actorRole)) {
    throw new AppError('Chỉ Chủ sân hoặc Nhân viên mới có quyền từ chối đơn đặt sân.', 403);
  }

  const reason = (data.reason || data.rejectReason || data.cancelReason || '').trim();
  if (!reason) {
    throw new AppError('Vui lòng nhập lý do từ chối đơn đặt sân để thông báo cho Người chơi.', 400);
  }

  return cancelBookingWithRefund(
    bookingId,
    {
      ...data,
      cancelReason: `[Từ chối đơn] ${reason}`,
    },
    actorUser
  );
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

  // Nếu là thao tác Hủy đơn (CANCELLED) -> Gọi luồng hủy & hoàn tiền tự động (S3-10)
  if (cleanStatus === 'CANCELLED') {
    const cancelRes = await cancelBookingWithRefund(bookingId, data, actorUser);
    return cancelRes.booking;
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

  // Người chơi (player) chỉ được phép hủy đơn
  if (actorRole === 'player') {
    throw new AppError(
      'Người chơi chỉ có quyền hủy đơn đặt sân của mình.',
      403
    );
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
      SET status = @status,
          updated_at = GETDATE()
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

    const method = ['MOMO', 'VNPAY', 'VIETQR', 'BANK_TRANSFER', 'CASH'].includes(
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
        .input('orderCode', `COMP-SPL${bookingId}-${Date.now()}`)
        .query(`
          INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, order_code, created_at)
          VALUES (@bookingId, @userId, @amount, 'FULL_PAYMENT', @method, 'SUCCESS', @orderCode, GETDATE())
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
          .input('orderCode', `COMP-SPL${bookingId}-${Date.now()}`)
          .query(`
            INSERT INTO transactions (booking_id, user_id, amount, transaction_type, payment_method, status, order_code, created_at)
            VALUES (@bookingId, @userId, @amount, 'FULL_PAYMENT', @method, 'SUCCESS', @orderCode, GETDATE())
          `);
      }
    }

    await pool
      .request()
      .input('bookingId', bookingId)
      .input('method', method)
      .query(`
        UPDATE bookings
        SET payment_status = 'PAID',
            payment_method = COALESCE(payment_method, @method),
            updated_at = GETDATE()
        WHERE booking_id = @bookingId
      `);
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

  // [3.1 - S3-14] Gửi thông báo tự động cho Người chơi khi Chủ sân / Staff xác nhận hoặc cập nhật đơn
  if (updated.user_id && cleanStatus !== currentStatus) {
    const detailed = await getBookingById(bookingId);
    const courtLabel = detailed?.court_name || `Sân #${updated.court_id}`;
    const dateLabel = formatDateStr(updated.booking_date);
    const timeLabel = `${formatTimeStr(updated.start_time)} - ${formatTimeStr(updated.end_time)}`;

    if (cleanStatus === 'CONFIRMED') {
      await createNotificationSafe(pool, {
        userId: updated.user_id,
        title: `✅ Đơn đặt sân #SPL-${bookingId} đã được xác nhận`,
        content: `Chủ sân đã xác nhận lịch đặt sân "${courtLabel}" ngày ${dateLabel} (${timeLabel}). Chúc bạn có trận đấu vui vẻ!`,
      });
    } else if (cleanStatus === 'CHECKED-IN') {
      await createNotificationSafe(pool, {
        userId: updated.user_id,
        title: `🏃 Đã check-in nhận sân đơn #SPL-${bookingId}`,
        content: `Bạn đã check-in nhận sân "${courtLabel}" (${dateLabel} ${timeLabel}).`,
      });
    } else if (cleanStatus === 'COMPLETED') {
      await createNotificationSafe(pool, {
        userId: updated.user_id,
        title: `🏆 Hoàn thành trận đấu #SPL-${bookingId}`,
        content: `Đơn đặt sân "${courtLabel}" ngày ${dateLabel} đã hoàn tất và tất toán đầy đủ. Cảm ơn bạn đã sử dụng SportLink!`,
      });
    } else if (cleanStatus === 'NO-SHOW') {
      await createNotificationSafe(pool, {
        userId: updated.user_id,
        title: `⚠️ Ghi nhận vắng mặt (No-show) đơn #SPL-${bookingId}`,
        content: `Đơn đặt sân "${courtLabel}" ngày ${dateLabel} (${timeLabel}) được ghi nhận không đến nhận sân (trừ 0.5★ điểm uy tín).`,
      });
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
 * Hủy một booking (Soft-cancel sang trạng thái CANCELLED kèm hoàn tiền nếu có).
 * @param {number} bookingId
 */
export async function deleteBooking(bookingId, data = {}, actorUser = null) {
  return cancelBookingWithRefund(bookingId, data, actorUser);
}
