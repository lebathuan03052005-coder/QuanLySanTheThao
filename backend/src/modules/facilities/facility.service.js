import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * ============================================================================
 * SPORTLINK - FACILITY & SUB-COURT SERVICE
 * Đáp ứng đặc tả chức năng WBS 3.1 (S2-02): Quản lý cơ sở sân & danh sách sân con
 * - Mỗi tài khoản Chủ sân (OWNER) quản lý riêng các Cơ sở sân và Sân con của mình.
 * - Hoàn toàn không chạy DDL hay DML seed ngầm trong quá trình vận hành runtime
 *   (đã tách riêng ra `npm run db:migrate` và `npm run db:seed`).
 * ============================================================================
 */

/**
 * Lấy danh sách cơ sở thuộc quyền quản lý của OWNER hiện tại kèm danh sách tóm tắt các sân con bên trong.
 * @param {number} ownerId - ID chủ sân trích xuất từ JWT token
 * @param {{ search?: string, status?: string }} filters
 */
export async function getOwnerFacilities(ownerId, filters = {}) {
  const pool = await getPool();
  const { search = '', status = 'ALL' } = filters;

  let query = `
    SELECT 
      f.facility_id,
      f.owner_id,
      f.name,
      f.address,
      f.phone,
      f.description,
      f.status,
      f.created_at,
      f.updated_at,
      COUNT(c.court_id) AS total_courts,
      SUM(CASE WHEN c.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_courts
    FROM facilities f
    LEFT JOIN courts c ON f.facility_id = c.facility_id
    WHERE f.owner_id = @ownerId
  `;

  if (status && status !== 'ALL') {
    query += ` AND f.status = @status`;
  }

  if (search && search.trim()) {
    query += ` AND (f.name LIKE @search OR f.address LIKE @search OR f.phone LIKE @search)`;
  }

  query += `
    GROUP BY 
      f.facility_id, f.owner_id, f.name, f.address, f.phone, 
      f.description, f.status, f.created_at, f.updated_at
    ORDER BY f.facility_id ASC
  `;

  const request = pool.request().input('ownerId', ownerId);

  if (status && status !== 'ALL') {
    request.input('status', status);
  }

  if (search && search.trim()) {
    request.input('search', `%${search.trim()}%`);
  }

  const result = await request.query(query);
  const facilities = result.recordset;

  // Lấy danh sách tóm tắt sân con của các cơ sở này để hiển thị trực quan trên thẻ Cơ sở
  const facIds = facilities.map((f) => f.facility_id);
  let courtsByFacMap = {};

  if (facIds.length > 0) {
    const courtsRes = await pool.request()
      .input('ownerId', ownerId)
      .query(`
        SELECT 
          c.court_id,
          c.facility_id,
          c.court_name,
          c.sport_id,
          COALESCE(os.custom_name, s.sport_name, N'Thể thao') AS sport_name,
          ISNULL(c.capacity, 10) AS capacity,
          ISNULL(c.status, 'ACTIVE') AS status
        FROM courts c
        LEFT JOIN sports s ON c.sport_id = s.sport_id
        LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
        WHERE c.facility_id IN (${facIds.join(',')})
        ORDER BY c.court_id ASC
      `);

    for (const c of courtsRes.recordset) {
      if (!courtsByFacMap[c.facility_id]) {
        courtsByFacMap[c.facility_id] = [];
      }
      courtsByFacMap[c.facility_id].push(c);
    }
  }

  return facilities.map((f) => ({
    ...f,
    total_courts: Number(f.total_courts || 0),
    active_courts: Number(f.active_courts || 0),
    courts_preview: courtsByFacMap[f.facility_id] || [],
  }));
}

/**
 * Lấy chi tiết một cơ sở và xác thực quyền sở hữu của OWNER.
 * @param {number} facilityId
 * @param {number} ownerId
 */
export async function getFacilityById(facilityId, ownerId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .query(`
      SELECT 
        f.facility_id,
        f.owner_id,
        f.name,
        f.address,
        f.phone,
        f.description,
        f.status,
        f.created_at,
        f.updated_at,
        COUNT(c.court_id) AS total_courts,
        SUM(CASE WHEN c.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_courts
      FROM facilities f
      LEFT JOIN courts c ON f.facility_id = c.facility_id
      WHERE f.facility_id = @facilityId AND f.owner_id = @ownerId
      GROUP BY 
        f.facility_id, f.owner_id, f.name, f.address, f.phone, 
        f.description, f.status, f.created_at, f.updated_at
    `);

  const facility = result.recordset[0];
  if (!facility) {
    throw new AppError('Cơ sở không tồn tại hoặc bạn không có quyền truy cập.', 404);
  }
  return facility;
}

/**
 * Thêm cơ sở sân mới gắn với OWNER.
 * @param {number} ownerId
 * @param {{ name: string, address: string, phone?: string, description?: string }} data
 */
export async function createFacility(ownerId, data) {
  const { name, address, phone = '', description = '' } = data;

  if (!name || !name.trim()) {
    throw new AppError('Tên cơ sở không được để trống.', 400);
  }
  if (!address || !address.trim()) {
    throw new AppError('Địa chỉ cơ sở không được để trống.', 400);
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('name', name.trim())
    .input('address', address.trim())
    .input('phone', phone.trim())
    .input('description', description.trim())
    .query(`
      INSERT INTO facilities (owner_id, name, address, phone, description, status, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (@ownerId, @name, @address, @phone, @description, 'ACTIVE', GETDATE(), GETDATE())
    `);

  return {
    ...result.recordset[0],
    total_courts: 0,
    active_courts: 0,
    courts_preview: [],
  };
}

/**
 * Cập nhật thông tin cơ sở sân.
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {{ name?: string, address?: string, phone?: string, description?: string }} data
 */
export async function updateFacility(facilityId, ownerId, data) {
  const { name, address, phone, description } = data;

  await getFacilityById(facilityId, ownerId);

  if (name !== undefined && !name.trim()) {
    throw new AppError('Tên cơ sở không được để trống.', 400);
  }
  if (address !== undefined && !address.trim()) {
    throw new AppError('Địa chỉ cơ sở không được để trống.', 400);
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .input('name', name ? name.trim() : null)
    .input('address', address ? address.trim() : null)
    .input('phone', phone !== undefined ? phone.trim() : null)
    .input('description', description !== undefined ? description.trim() : null)
    .query(`
      UPDATE facilities
      SET 
        name = COALESCE(@name, name),
        address = COALESCE(@address, address),
        phone = COALESCE(@phone, phone),
        description = COALESCE(@description, description),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE facility_id = @facilityId AND owner_id = @ownerId
    `);

  // Đồng bộ địa chỉ mới của cơ sở xuống các sân con trực thuộc
  if (address && address.trim()) {
    await pool.request()
      .input('facilityId', facilityId)
      .input('address', address.trim())
      .query('UPDATE courts SET address = @address WHERE facility_id = @facilityId');
  }

  return result.recordset[0];
}

/**
 * Ngừng hoạt động hoặc kích hoạt lại cơ sở (Soft status change).
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {'ACTIVE' | 'INACTIVE'} status
 */
export async function updateFacilityStatus(facilityId, ownerId, status) {
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  await getFacilityById(facilityId, ownerId);

  const pool = await getPool();
  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE facilities
      SET status = @status, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE facility_id = @facilityId AND owner_id = @ownerId
    `);

  return result.recordset[0];
}

/**
 * ============================================================================
 * QUẢN LÝ SÂN CON (COURTS TRỰC THUỘC CƠ SỞ)
 * ============================================================================
 */

/**
 * Lấy danh sách sân con thuộc một cơ sở.
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {{ status?: string, sportId?: number }} filters
 */
export async function getCourtsByFacility(facilityId, ownerId, filters = {}) {
  await getFacilityById(facilityId, ownerId);

  const pool = await getPool();
  const { status = 'ALL', sportId } = filters;

  let query = `
    SELECT 
      c.court_id,
      c.facility_id,
      f.name AS facility_name,
      c.owner_id,
      c.sport_id,
      COALESCE(os.custom_name, s.sport_name) AS sport_name,
      c.court_name,
      c.address,
      ISNULL(c.capacity, 10) AS capacity,
      c.description,
      c.utilities,
      c.status,
      c.images,
      c.created_at,
      c.updated_at
    FROM courts c
    LEFT JOIN facilities f ON c.facility_id = f.facility_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
    WHERE c.facility_id = @facilityId AND c.owner_id = @ownerId
  `;

  if (status && status !== 'ALL') {
    query += ` AND c.status = @status`;
  }

  if (sportId) {
    query += ` AND c.sport_id = @sportId`;
  }

  query += ` ORDER BY c.court_id ASC`;

  const request = pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId);

  if (status && status !== 'ALL') {
    request.input('status', status);
  }
  if (sportId) {
    request.input('sportId', parseInt(sportId));
  }

  const result = await request.query(query);
  return result.recordset;
}

/**
 * Thêm sân con vào cơ sở hợp lệ.
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {{ courtName: string, sportId: number, capacity?: number, description?: string, utilities?: string, images?: string }} data
 */
export async function createCourtInFacility(facilityId, ownerId, data) {
  const facility = await getFacilityById(facilityId, ownerId);

  const { courtName, sportId, capacity = 10, description = '', utilities = '', images = '[]' } = data;

  if (!courtName || !courtName.trim()) {
    throw new AppError('Tên sân con không được để trống.', 400);
  }
  if (sportId === undefined || isNaN(Number(sportId))) {
    throw new AppError('Vui lòng chọn loại môn thể thao hợp lệ cho sân.', 400);
  }

  const pool = await getPool();

  const sportRes = await pool.request()
    .input('sportId', parseInt(sportId))
    .input('ownerId', ownerId)
    .query(`
      SELECT 
        s.sport_id,
        s.owner_id,
        COALESCE(os.status, s.status, 'ACTIVE') AS effective_status
      FROM sports s
      LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
      WHERE s.sport_id = @sportId
        AND (s.owner_id IS NULL OR s.owner_id = @ownerId)
    `);

  if (sportRes.recordset.length === 0) {
    throw new AppError('Môn thể thao được chọn không tồn tại trong hệ thống.', 404);
  }
  const sport = sportRes.recordset[0];
  if (sport.effective_status && sport.effective_status.toUpperCase() === 'INACTIVE') {
    throw new AppError('Không thể tạo sân cho môn thể thao đã ngừng hoạt động.', 400);
  }

  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .input('sportId', parseInt(sportId))
    .input('courtName', courtName.trim())
    .input('address', facility.address)
    .input('capacity', capacity ? parseInt(capacity) : 10)
    .input('description', description.trim())
    .input('utilities', typeof utilities === 'string' ? utilities : JSON.stringify(utilities))
    .input('images', typeof images === 'string' ? images : JSON.stringify(images))
    .query(`
      INSERT INTO courts (
        facility_id, owner_id, sport_id, court_name, address, 
        capacity, description, utilities, status, images, created_at, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @facilityId, @ownerId, @sportId, @courtName, @address, 
        @capacity, @description, @utilities, 'ACTIVE', @images, GETDATE(), GETDATE()
      )
    `);

  const createdCourt = result.recordset[0];

  // Tạo khung giá mặc định nếu bảng court_prices tồn tại
  if (createdCourt?.court_id) {
    try {
      await pool.request()
        .input('courtId', createdCourt.court_id)
        .query(`
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'court_prices')
          AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @courtId)
          BEGIN
            INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
              (@courtId, 'WEEKDAY', '06:00:00', '16:00:00', 150000),
              (@courtId, 'WEEKDAY', '16:00:00', '22:00:00', 250000),
              (@courtId, 'WEEKEND', '06:00:00', '22:00:00', 300000);
          END
        `);
    } catch {
      // Bỏ qua nếu bảng court_prices chưa được tạo
    }
  }

  return createdCourt;
}

/**
 * Cập nhật thông tin sân con trực thuộc cơ sở.
 * @param {number} courtId
 * @param {number} ownerId
 * @param {{ courtName?: string, sportId?: number, capacity?: number, description?: string, utilities?: string, images?: string }} data
 */
export async function updateCourtInFacility(courtId, ownerId, data) {
  const pool = await getPool();

  const checkCourt = await pool.request()
    .input('courtId', courtId)
    .query(`
      SELECT c.*, f.owner_id AS facility_owner_id 
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      WHERE c.court_id = @courtId
    `);

  const court = checkCourt.recordset[0];
  if (!court) {
    throw new AppError('Sân không tồn tại trong hệ thống.', 404);
  }

  if (court.owner_id !== ownerId && court.facility_owner_id !== ownerId) {
    throw new AppError('Bạn không có quyền chỉnh sửa sân bóng này.', 403);
  }

  const { courtName, sportId, facilityId, capacity, description, utilities, images } = data;

  if (courtName !== undefined && !courtName.trim()) {
    throw new AppError('Tên sân không được để trống.', 400);
  }

  if (sportId !== undefined) {
    const sportRes = await pool.request()
      .input('sportId', parseInt(sportId))
      .input('ownerId', ownerId)
      .query(`
        SELECT
          s.sport_id,
          COALESCE(os.status, s.status, 'ACTIVE') AS effective_status
        FROM sports s
        LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
        WHERE s.sport_id = @sportId AND (s.owner_id IS NULL OR s.owner_id = @ownerId)
      `);
    if (sportRes.recordset.length === 0) {
      throw new AppError('Môn thể thao không tồn tại.', 404);
    }
    const sp = sportRes.recordset[0];
    if (
      Number(sportId) !== Number(court.sport_id) &&
      sp.effective_status &&
      sp.effective_status.toUpperCase() === 'INACTIVE'
    ) {
      throw new AppError('Không thể chuyển sân sang môn thể thao đã ngừng hoạt động.', 400);
    }
  }

  let validFacilityId = null;
  let targetFacilityAddress = null;
  if (facilityId !== undefined && facilityId !== null) {
    const targetFac = await getFacilityById(parseInt(facilityId), ownerId);
    validFacilityId = targetFac.facility_id;
    targetFacilityAddress = targetFac.address;
  }

  const result = await pool.request()
    .input('courtId', courtId)
    .input('courtName', courtName ? courtName.trim() : null)
    .input('sportId', sportId !== undefined ? parseInt(sportId) : null)
    .input('facilityId', validFacilityId)
    .input('address', targetFacilityAddress)
    .input('capacity', capacity !== undefined ? parseInt(capacity) : null)
    .input('description', description !== undefined ? description.trim() : null)
    .input('utilities', utilities !== undefined ? (typeof utilities === 'string' ? utilities : JSON.stringify(utilities)) : null)
    .input('images', images !== undefined ? (typeof images === 'string' ? images : JSON.stringify(images)) : null)
    .query(`
      UPDATE courts
      SET 
        court_name = COALESCE(@courtName, court_name),
        sport_id = COALESCE(@sportId, sport_id),
        facility_id = COALESCE(@facilityId, facility_id),
        address = COALESCE(@address, address),
        capacity = COALESCE(@capacity, capacity),
        description = COALESCE(@description, description),
        utilities = COALESCE(@utilities, utilities),
        images = COALESCE(@images, images),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE court_id = @courtId
    `);

  return result.recordset[0];
}

/**
 * Ngừng hoạt động / kích hoạt lại sân con. Không xóa cứng lịch sử đặt sân.
 * @param {number} courtId
 * @param {number} ownerId
 * @param {'ACTIVE' | 'INACTIVE'} status
 */
export async function updateCourtStatus(courtId, ownerId, status) {
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  const pool = await getPool();
  const checkCourt = await pool.request()
    .input('courtId', courtId)
    .query(`
      SELECT c.*, f.owner_id AS facility_owner_id 
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      WHERE c.court_id = @courtId
    `);

  const court = checkCourt.recordset[0];
  if (!court) {
    throw new AppError('Sân không tồn tại.', 404);
  }

  if (court.owner_id !== ownerId && court.facility_owner_id !== ownerId) {
    throw new AppError('Bạn không có quyền quản lý sân bóng này.', 403);
  }

  const result = await pool.request()
    .input('courtId', courtId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE courts
      SET status = @status, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE court_id = @courtId
    `);

  return result.recordset[0];
}
