import { getPool } from '../../core/config/db.js';

/**
 * Lấy danh sách booking dựa theo vai trò của người dùng (RBAC Data Scoping) theo schema mục dulieu.
 * @param {{ id: number, role: string }} user
 */
export async function getBookingsByUser(user) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();

  // Quản trị viên (admin): Xem toàn bộ lịch đặt trong hệ thống
  if (userRole === 'admin') {
    const result = await pool.request().query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address,
             u.full_name AS player_name, u.email AS player_email, u.phone AS player_phone
      FROM bookings b
      LEFT JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN users u ON b.user_id = u.user_id
      ORDER BY b.created_at DESC
    `);
    return result.recordset;
  }

  // Chủ sân (owner): Xem các lượt đặt trên các sân do mình sở hữu
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
        ORDER BY b.created_at DESC
      `);
    return result.recordset;
  }

  // Người chơi (player): Chỉ xem lịch đặt do chính mình thực hiện
  const result = await pool.request()
    .input('userId', user.id)
    .query(`
      SELECT b.booking_id, b.court_id, b.user_id, b.booking_date, b.start_time, b.end_time,
             b.total_price, b.deposit_amount, b.status, b.created_at,
             c.court_name, c.address AS court_address
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      WHERE b.user_id = @userId
      ORDER BY b.created_at DESC
    `);
  return result.recordset;
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
             u.full_name AS player_name, u.email AS player_email
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.booking_id = @id
    `);
  return result.recordset[0] || null;
}

/**
 * Tạo mới một booking.
 * @param {{ courtId: number, userId: number, bookingDate: string, startTime: string, endTime: string, totalPrice?: number }} data
 */
export async function createBooking(data) {
  const { courtId, userId, bookingDate, startTime, endTime, totalPrice = 0 } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('courtId', courtId)
    .input('userId', userId)
    .input('bookingDate', bookingDate || new Date().toISOString().split('T')[0])
    .input('startTime', startTime)
    .input('endTime', endTime)
    .input('totalPrice', totalPrice)
    .query(`
      INSERT INTO bookings (court_id, user_id, booking_date, start_time, end_time, total_price, status, created_at)
      OUTPUT INSERTED.*
      VALUES (@courtId, @userId, @bookingDate, @startTime, @endTime, @totalPrice, 'PENDING', GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Cập nhật trạng thái booking.
 * @param {number} bookingId
 * @param {{ status: string }} data
 */
export async function updateBooking(bookingId, data) {
  const { status } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('id', bookingId)
    .input('status', (status || '').toUpperCase())
    .query(`
      UPDATE bookings SET status = @status
      OUTPUT INSERTED.*
      WHERE booking_id = @id
    `);
  return result.recordset[0];
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
