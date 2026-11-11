import { getPool } from '../../core/config/db.js';

/**
 * Lấy danh sách tất cả sân thể thao (Sân con) kèm thông tin Cơ sở sân (facility) và Môn thể thao (sport).
 * Hỗ trợ lọc theo facility_id, sport_id, owner_id để phục vụ trang Đặt sân / Lịch sân của nhóm.
 * Chỉ trả về các sân đang ACTIVE và thuộc cơ sở đang ACTIVE (hoặc sân độc lập chưa gắn cơ sở).
 * @param {{ facility_id?: number, sport_id?: number, owner_id?: number }} filters
 */
export async function getAllCourts(filters = {}) {
  const pool = await getPool();

  let query = `
    SELECT 
      c.*,
      f.name AS facility_name,
      f.address AS facility_address,
      f.phone AS facility_phone,
      s.sport_name
    FROM courts c
    LEFT JOIN facilities f ON c.facility_id = f.facility_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    WHERE c.status = 'ACTIVE'
      AND (f.status = 'ACTIVE' OR c.facility_id IS NULL)
  `;

  const request = pool.request();

  if (filters.owner_id !== undefined && filters.owner_id !== '') {
    request.input('ownerId', parseInt(filters.owner_id));
    query += ' AND c.owner_id = @ownerId';
  }
  if (filters.facility_id !== undefined && filters.facility_id !== '') {
    request.input('facilityId', parseInt(filters.facility_id));
    query += ' AND c.facility_id = @facilityId';
  }
  if (filters.sport_id !== undefined && filters.sport_id !== '') {
    request.input('sportId', parseInt(filters.sport_id));
    query += ' AND c.sport_id = @sportId';
  }

  query += ' ORDER BY c.facility_id ASC, c.court_id ASC';
  const result = await request.query(query);
  return result.recordset;
}

/**
 * Lấy thông tin một sân con theo ID kèm tên cơ sở và môn thể thao.
 * @param {number} courtId
 */
export async function getCourtById(courtId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', courtId)
    .query(`
      SELECT 
        c.*,
        f.name AS facility_name,
        f.address AS facility_address,
        f.phone AS facility_phone,
        s.sport_name
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      LEFT JOIN sports s ON c.sport_id = s.sport_id
      WHERE c.court_id = @id
    `);
  return result.recordset[0] || null;
}

/**
 * Tạo mới một sân thể thao.
 * @param {{ ownerId: number, facilityId?: number, courtName: string, address?: string, sportId?: number, capacity?: number }} data
 */
export async function createCourt(data) {
  const { ownerId, facilityId = null, courtName, address = '', sportId = 1, capacity = 10, description = '', utilities = '' } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('facilityId', facilityId)
    .input('courtName', courtName)
    .input('address', address)
    .input('sportId', sportId)
    .input('capacity', capacity)
    .input('description', description)
    .input('utilities', utilities)
    .query(`
      INSERT INTO courts (facility_id, owner_id, sport_id, court_name, address, capacity, description, utilities, status, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (@facilityId, @ownerId, @sportId, @courtName, @address, @capacity, @description, @utilities, 'ACTIVE', GETDATE(), GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Cập nhật thông tin sân.
 * @param {number} courtId
 * @param {{ courtName?, address?, description?, utilities?, facilityId?, sportId?, capacity? }} data
 */
export async function updateCourt(courtId, data) {
  const { courtName, address, description, utilities, facilityId, sportId, capacity } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('id', courtId)
    .input('courtName', courtName ?? null)
    .input('address', address ?? null)
    .input('description', description ?? null)
    .input('utilities', utilities ?? null)
    .input('facilityId', facilityId ?? null)
    .input('sportId', sportId ?? null)
    .input('capacity', capacity ?? null)
    .query(`
      UPDATE courts 
      SET court_name = COALESCE(@courtName, court_name),
          address = COALESCE(@address, address),
          description = COALESCE(@description, description),
          utilities = COALESCE(@utilities, utilities),
          facility_id = COALESCE(@facilityId, facility_id),
          sport_id = COALESCE(@sportId, sport_id),
          capacity = COALESCE(@capacity, capacity),
          updated_at = GETDATE()
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

/**
 * Lấy danh sách quy tắc giá của sân con (WBS 3.2 - S2-07).
 * @param {number} courtId
 */
export async function getCourtPrices(courtId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('courtId', courtId)
    .query(`
      SELECT price_id, court_id, day_type, 
             CONVERT(VARCHAR(5), start_time, 108) AS start_time, 
             CONVERT(VARCHAR(5), end_time, 108) AS end_time, 
             price
      FROM court_prices
      WHERE court_id = @courtId
      ORDER BY 
        CASE day_type 
          WHEN 'NORMAL' THEN 1 
          WHEN 'WEEKDAY' THEN 1 
          WHEN 'WEEKEND' THEN 2 
          WHEN 'HOLIDAY' THEN 3 
          ELSE 4 
        END,
        start_time ASC
    `);
  return result.recordset;
}

/**
 * Cập nhật danh sách quy tắc giá của sân con (WBS 3.2 - S2-07).
 * Ghi đè đồng bộ theo danh sách truyền vào trong Transaction an toàn.
 * @param {number} courtId
 * @param {Array<{ day_type: string, start_time: string, end_time: string, price: number }>} rules
 */
export async function updateCourtPrices(courtId, rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    const err = new Error('Danh sách quy tắc giá không hợp lệ hoặc rỗng.');
    err.statusCode = 400;
    throw err;
  }

  // Validate từng quy tắc
  for (const r of rules) {
    const dayType = (r.day_type || r.dayType || '').toUpperCase();
    if (!['NORMAL', 'WEEKDAY', 'WEEKEND', 'HOLIDAY'].includes(dayType)) {
      const err = new Error(`Loại ngày '${dayType}' không hợp lệ. Phải là NORMAL, WEEKDAY, WEEKEND hoặc HOLIDAY.`);
      err.statusCode = 400;
      throw err;
    }
    const startTime = (r.start_time || r.startTime || '').trim();
    const endTime = (r.end_time || r.endTime || '').trim();
    if (!startTime || !endTime) {
      const err = new Error('Giờ bắt đầu và giờ kết thúc không được để trống.');
      err.statusCode = 400;
      throw err;
    }
    const price = Number(r.price);
    if (isNaN(price) || price < 0) {
      const err = new Error('Đơn giá phải là số không âm.');
      err.statusCode = 400;
      throw err;
    }
  }

  const pool = await getPool();
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const delReq = transaction.request();
    delReq.input('courtId', courtId);
    await delReq.query('DELETE FROM court_prices WHERE court_id = @courtId');

    for (const r of rules) {
      const dayType = (r.day_type || r.dayType || '').toUpperCase();
      const startTime = (r.start_time || r.startTime || '').trim();
      const endTime = (r.end_time || r.endTime || '').trim();
      const price = Number(r.price);

      const insReq = transaction.request();
      insReq.input('courtId', courtId);
      insReq.input('dayType', dayType);
      insReq.input('startTime', startTime.length === 5 ? `${startTime}:00` : startTime);
      insReq.input('endTime', endTime.length === 5 ? `${endTime}:00` : endTime);
      insReq.input('price', price);

      await insReq.query(`
        INSERT INTO court_prices (court_id, day_type, start_time, end_time, price)
        VALUES (@courtId, @dayType, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @price)
      `);
    }

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return getCourtPrices(courtId);
}
