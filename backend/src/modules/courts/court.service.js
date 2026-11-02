import { getPool } from '../../core/config/db.js';

/**
 * Lấy danh sách tất cả sân thể thao theo schema bảng courts trong mục dulieu.
 * @param {{ sport_id?, owner_id? }} filters
 */
export async function getAllCourts(filters = {}) {
  const pool = await getPool();
  let query = 'SELECT * FROM courts WHERE status = \'ACTIVE\'';
  if (filters.owner_id) {
    query += ` AND owner_id = ${parseInt(filters.owner_id)}`;
  }
  query += ' ORDER BY court_id DESC';
  const result = await pool.request().query(query);
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
    .query('SELECT * FROM courts WHERE court_id = @id');
  return result.recordset[0] || null;
}

/**
 * Tạo mới một sân thể thao.
 * @param {{ ownerId: number, courtName: string, address?: string, sportId?: number }} data
 */
export async function createCourt(data) {
  const { ownerId, courtName, address, sportId = 1, description = '', utilities = '' } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('courtName', courtName)
    .input('address', address)
    .input('sportId', sportId)
    .input('description', description)
    .input('utilities', utilities)
    .query(`
      INSERT INTO courts (owner_id, sport_id, court_name, address, description, utilities, status)
      OUTPUT INSERTED.*
      VALUES (@ownerId, @sportId, @courtName, @address, @description, @utilities, 'ACTIVE')
    `);
  return result.recordset[0];
}

/**
 * Cập nhật thông tin sân.
 * @param {number} courtId
 * @param {{ courtName?, address?, description?, utilities? }} data
 */
export async function updateCourt(courtId, data) {
  const { courtName, address, description, utilities } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('id', courtId)
    .input('courtName', courtName)
    .input('address', address)
    .input('description', description)
    .input('utilities', utilities)
    .query(`
      UPDATE courts 
      SET court_name = COALESCE(@courtName, court_name),
          address = COALESCE(@address, address),
          description = COALESCE(@description, description),
          utilities = COALESCE(@utilities, utilities)
      OUTPUT INSERTED.*
      WHERE court_id = @id
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
    .query('DELETE FROM courts WHERE court_id = @id');
}
