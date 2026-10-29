import { getPool } from '../../core/config/db.js';

/**
 * Lấy danh sách tất cả booking của một user.
 * @param {number} userId
 */
export async function getAllBookings(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', userId)
    .query('SELECT * FROM Bookings WHERE UserId = @userId ORDER BY CreatedAt DESC');
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
    .query('SELECT * FROM Bookings WHERE Id = @id');
  return result.recordset[0] || null;
}

/**
 * Tạo mới một booking.
 * @param {{ courtId, userId, startTime, endTime }} data
 */
export async function createBooking(data) {
  const { courtId, userId, startTime, endTime } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('courtId', courtId)
    .input('userId', userId)
    .input('startTime', startTime)
    .input('endTime', endTime)
    .query(`
      INSERT INTO Bookings (CourtId, UserId, StartTime, EndTime, Status, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@courtId, @userId, @startTime, @endTime, 'pending', GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Cập nhật trạng thái booking.
 * @param {number} bookingId
 * @param {{ status }} data
 */
export async function updateBooking(bookingId, data) {
  const { status } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('id', bookingId)
    .input('status', status)
    .query(`
      UPDATE Bookings SET Status = @status
      OUTPUT INSERTED.*
      WHERE Id = @id
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
    .query('DELETE FROM Bookings WHERE Id = @id');
}
