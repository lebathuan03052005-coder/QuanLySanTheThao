import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE MANAGEMENT SERVICE
 * Đáp ứng đặc tả chức năng WBS 3.1: Quản lý loại môn thể thao
 * ============================================================================
 */

/**
 * Lấy danh sách loại môn thể thao kèm số lượng sân đang sử dụng.
 * @param {{ search?: string, status?: string }} filters
 */
export async function getAllSports(filters = {}) {
  const pool = await getPool();
  const { search = '', status = 'ALL' } = filters;

  let query = `
    SELECT 
      s.sport_id,
      s.sport_name,
      s.description,
      COALESCE(s.status, 'ACTIVE') AS status,
      s.created_at,
      s.updated_at,
      COUNT(c.court_id) AS court_count
    FROM sports s
    LEFT JOIN courts c ON s.sport_id = c.sport_id
    WHERE 1=1
  `;

  if (status && status !== 'ALL') {
    query += ` AND COALESCE(s.status, 'ACTIVE') = @status`;
  }

  if (search && search.trim()) {
    query += ` AND (s.sport_name LIKE @search OR s.description LIKE @search)`;
  }

  query += `
    GROUP BY s.sport_id, s.sport_name, s.description, s.status, s.created_at, s.updated_at
    ORDER BY s.sport_id ASC
  `;

  const request = pool.request();
  if (status && status !== 'ALL') {
    request.input('status', status.toUpperCase());
  }
  if (search && search.trim()) {
    request.input('search', `%${search.trim()}%`);
  }

  const result = await request.query(query);
  return result.recordset;
}

/**
 * Lấy chi tiết một môn thể thao theo ID.
 * @param {number} sportId
 */
export async function getSportById(sportId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sportId)
    .query(`
      SELECT 
        s.sport_id,
        s.sport_name,
        s.description,
        COALESCE(s.status, 'ACTIVE') AS status,
        s.created_at,
        s.updated_at,
        COUNT(c.court_id) AS court_count
      FROM sports s
      LEFT JOIN courts c ON s.sport_id = c.sport_id
      WHERE s.sport_id = @id
      GROUP BY s.sport_id, s.sport_name, s.description, s.status, s.created_at, s.updated_at
    `);

  const sport = result.recordset[0];
  if (!sport) {
    throw new AppError('Không tìm thấy môn thể thao này.', 404);
  }
  return sport;
}

/**
 * Thêm mới một loại môn thể thao.
 * Kiểm tra tên bắt buộc và chống trùng lặp không phân biệt hoa thường.
 * @param {{ sportName: string, description?: string }} data
 */
export async function createSport(data) {
  const { sportName, description = '' } = data;

  if (!sportName || !sportName.trim()) {
    throw new AppError('Tên môn thể thao không được để trống.', 400);
  }

  const cleanName = sportName.trim();
  const pool = await getPool();

  // Kiểm tra trùng tên (case-insensitive & chuẩn hóa khoảng trắng)
  const existing = await pool.request()
    .input('sportName', cleanName)
    .query('SELECT sport_id FROM sports WHERE LOWER(LTRIM(RTRIM(sport_name))) = LOWER(@sportName)');

  if (existing.recordset.length > 0) {
    throw new AppError(`Môn thể thao "${cleanName}" đã tồn tại trong hệ thống.`, 409);
  }

  const result = await pool.request()
    .input('sportName', cleanName)
    .input('description', description.trim())
    .query(`
      INSERT INTO sports (sport_name, description, status, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (@sportName, @description, 'ACTIVE', GETDATE(), GETDATE())
    `);

  return result.recordset[0];
}

/**
 * Cập nhật thông tin môn thể thao.
 * @param {number} sportId
 * @param {{ sportName?: string, description?: string }} data
 */
export async function updateSport(sportId, data) {
  const { sportName, description } = data;
  const pool = await getPool();

  await getSportById(sportId);

  if (sportName !== undefined) {
    if (!sportName.trim()) {
      throw new AppError('Tên môn thể thao không được để trống.', 400);
    }

    const cleanName = sportName.trim();
    // Kiểm tra trùng tên với môn thể thao khác
    const duplicate = await pool.request()
      .input('id', sportId)
      .input('sportName', cleanName)
      .query(`
        SELECT sport_id FROM sports 
        WHERE LOWER(LTRIM(RTRIM(sport_name))) = LOWER(@sportName) AND sport_id <> @id
      `);

    if (duplicate.recordset.length > 0) {
      throw new AppError(`Tên môn "${cleanName}" đã được sử dụng bởi môn khác.`, 409);
    }
  }

  const result = await pool.request()
    .input('id', sportId)
    .input('sportName', sportName ? sportName.trim() : null)
    .input('description', description !== undefined ? description.trim() : null)
    .query(`
      UPDATE sports
      SET 
        sport_name = COALESCE(@sportName, sport_name),
        description = COALESCE(@description, description),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE sport_id = @id
    `);

  return result.recordset[0];
}

/**
 * Ngừng hoạt động hoặc kích hoạt lại môn thể thao (Soft toggle).
 * @param {number} sportId
 * @param {'ACTIVE' | 'INACTIVE'} status
 */
export async function updateSportStatus(sportId, status) {
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  await getSportById(sportId);

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sportId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE sports
      SET status = @status, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE sport_id = @id
    `);

  return result.recordset[0];
}
