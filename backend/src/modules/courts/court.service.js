import { getPool } from '../../core/config/db.js';

/**
 * Lấy danh sách tất cả sân thể thao.
 * @param {{ sport?, area? }} filters
 */
export async function getAllCourts(filters = {}) {
  const pool = await getPool();
  const result = await pool.request()
    .query('SELECT * FROM Courts ORDER BY CreatedAt DESC');
  return result.recordset;
}

/**
 * Lấy thông tin một sân theo ID.
 * @param {number} courtId
 */
export async function getCourtById(courtId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', courtId)
    .query('SELECT * FROM Courts WHERE Id = @id');
  return result.recordset[0] || null;
}

/**
 * Tạo mới một sân thể thao.
 * @param {{ ownerId, name, address, sport, pricePerHour }} data
 */
export async function createCourt(data) {
  const { ownerId, name, address, sport, pricePerHour } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('name', name)
    .input('address', address)
    .input('sport', sport)
    .input('pricePerHour', pricePerHour)
    .query(`
      INSERT INTO Courts (OwnerId, Name, Address, Sport, PricePerHour, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@ownerId, @name, @address, @sport, @pricePerHour, GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Cập nhật thông tin sân.
 * @param {number} courtId
 * @param {{ name?, address?, pricePerHour? }} data
 */
export async function updateCourt(courtId, data) {
  const { name, address, pricePerHour } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('id', courtId)
    .input('name', name)
    .input('address', address)
    .input('pricePerHour', pricePerHour)
    .query(`
      UPDATE Courts SET Name = @name, Address = @address, PricePerHour = @pricePerHour
      OUTPUT INSERTED.*
      WHERE Id = @id
    `);
  return result.recordset[0];
}

/**
 * Xóa một sân.
 * @param {number} courtId
 */
export async function deleteCourt(courtId) {
  const pool = await getPool();
  await pool.request()
    .input('id', courtId)
    .query('DELETE FROM Courts WHERE Id = @id');
}
