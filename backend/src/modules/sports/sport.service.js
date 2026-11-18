import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE MANAGEMENT SERVICE
 * Đáp ứng đặc tả chức năng WBS 3.1 (S2-03): Quản lý loại môn thể thao (thiết kế mở rộng)
 * - GET /api/sports: trả danh mục môn thể thao công khai (không trả danh sách sân nội bộ của các owner).
 * - GET /api/sports/owner: trả danh mục môn thể thao kèm chi tiết các sân con thuộc đúng owner_id đang đăng nhập.
 * - POST / PUT / PATCH /api/sports: giữ đầy đủ quyền Thêm / Sửa / Khóa / Mở lại cho OWNER,
 *   nhưng cô lập phạm vi theo từng Owner (qua owner_id và bảng owner_sports) để không ảnh hưởng chéo.
 * ============================================================================
 */

/**
 * Lấy danh mục loại môn thể thao công khai (phục vụ dropdown chọn môn & trang Player).
 * Không trả danh sách sân nội bộ hoặc email của các chủ sân.
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
      s.owner_id,
      s.created_at,
      s.updated_at
    FROM sports s
    WHERE s.owner_id IS NULL
  `;

  if (status && status !== 'ALL') {
    query += ` AND COALESCE(s.status, 'ACTIVE') = @status`;
  }

  if (search && search.trim()) {
    query += ` AND (s.sport_name LIKE @search OR s.description LIKE @search)`;
  }

  query += ` ORDER BY s.sport_id ASC`;

  const request = pool.request();
  if (status && status !== 'ALL') {
    request.input('status', status.toUpperCase());
  }
  if (search && search.trim()) {
    request.input('search', `%${search.trim()}%`);
  }

  const sportsResult = await request.query(query);
  return sportsResult.recordset;
}

/**
 * Lấy danh sách loại môn thể thao dành riêng cho Chủ sân đang đăng nhập (`/api/sports/owner`).
 * - Chỉ tính toán và trả về các sân con có `c.owner_id = @ownerId` (không lộ sân hay email của chủ sân khác).
 * - Kết hợp cấu hình riêng của chủ sân trong `owner_sports` để việc Sửa/Khóa môn của Owner A không ảnh hưởng Owner B.
 * @param {number} ownerId
 * @param {{ search?: string, status?: string }} filters
 */
export async function getOwnerSports(ownerId, filters = {}) {
  const pool = await getPool();
  const { search = '', status = 'ALL' } = filters;

  let query = `
    SELECT 
      s.sport_id,
      COALESCE(os.custom_name, s.sport_name) AS sport_name,
      COALESCE(os.custom_description, s.description) AS description,
      COALESCE(os.status, s.status, 'ACTIVE') AS status,
      s.owner_id,
      s.created_at,
      COALESCE(os.updated_at, s.updated_at) AS updated_at
    FROM sports s
    LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
    WHERE (s.owner_id IS NULL OR s.owner_id = @ownerId)
  `;

  if (status && status !== 'ALL') {
    query += ` AND COALESCE(os.status, s.status, 'ACTIVE') = @status`;
  }

  if (search && search.trim()) {
    query += ` AND (COALESCE(os.custom_name, s.sport_name) LIKE @search OR COALESCE(os.custom_description, s.description) LIKE @search)`;
  }

  query += ` ORDER BY s.sport_id ASC`;

  const request = pool.request().input('ownerId', ownerId);
  if (status && status !== 'ALL') {
    request.input('status', status.toUpperCase());
  }
  if (search && search.trim()) {
    request.input('search', `%${search.trim()}%`);
  }

  const sportsResult = await request.query(query);
  const sportsList = sportsResult.recordset;

  // Chỉ lấy danh sách sân con thuộc quyền sở hữu của chính Owner đang đăng nhập (c.owner_id = @ownerId)
  const courtsRes = await pool.request()
    .input('ownerId', ownerId)
    .query(`
      SELECT 
        c.court_id,
        c.sport_id,
        c.court_name,
        c.facility_id,
        ISNULL(f.name, N'Cơ sở độc lập') AS facility_name,
        ISNULL(f.address, c.address) AS address,
        ISNULL(f.status, 'ACTIVE') AS facility_status,
        c.owner_id,
        ISNULL(u.full_name, N'Chủ sân SportLink') AS owner_name,
        ISNULL(c.capacity, 10) AS capacity,
        c.utilities,
        c.description,
        ISNULL(c.status, 'ACTIVE') AS status
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      LEFT JOIN users u ON c.owner_id = u.user_id
      WHERE c.owner_id = @ownerId
      ORDER BY c.facility_id ASC, c.court_id ASC
    `);

  const courtsList = courtsRes.recordset;

  return sportsList.map((sp) => {
    const appliedCourts = courtsList.filter((c) => c.sport_id === sp.sport_id);
    const activeCourts = appliedCourts.filter((c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    const inactiveCourts = appliedCourts.filter((c) => (c.status || 'ACTIVE').toUpperCase() !== 'ACTIVE');
    const uniqueFacilities = new Set(
      appliedCourts.map((c) => c.facility_id || c.facility_name).filter(Boolean)
    );

    return {
      ...sp,
      court_count: appliedCourts.length,
      active_court_count: activeCourts.length,
      inactive_court_count: inactiveCourts.length,
      facility_count: uniqueFacilities.size,
      courts: appliedCourts,
    };
  });
}

/**
 * Lấy chi tiết một môn thể thao theo ID (hỗ trợ truyền kèm ownerId nếu cần lấy góc nhìn của Owner).
 * @param {number} sportId
 * @param {number | null} [ownerId]
 */
export async function getSportById(sportId, ownerId = null) {
  if (ownerId !== null && ownerId !== undefined) {
    const ownerSports = await getOwnerSports(ownerId);
    const found = ownerSports.find((s) => s.sport_id === sportId);
    if (!found) {
      throw new AppError('Không tìm thấy môn thể thao này.', 404);
    }
    return found;
  }

  const pool = await getPool();
  const res = await pool.request()
    .input('sportId', sportId)
    .query(`
      SELECT sport_id, sport_name, description, COALESCE(status, 'ACTIVE') AS status, owner_id, created_at, updated_at
      FROM sports
      WHERE sport_id = @sportId
    `);

  if (res.recordset.length === 0) {
    throw new AppError('Không tìm thấy môn thể thao này.', 404);
  }
  return res.recordset[0];
}

/**
 * Thêm mới một loại môn thể thao.
 * - Khi Owner tạo môn mới, gắn `owner_id = user.id` để chỉ Owner đó quản lý, không làm nhiễu danh mục của Owner khác.
 * @param {{ sportName: string, description?: string }} data
 * @param {{ id?: number, role?: string }} [user]
 */
export async function createSport(data, user = null) {
  const { sportName, description = '' } = data;

  if (!sportName || !sportName.trim()) {
    throw new AppError('Tên môn thể thao không được để trống.', 400);
  }

  const cleanName = sportName.trim();
  const ownerId = user?.id !== undefined && user?.id !== null ? Number(user.id) : null;
  const pool = await getPool();

  // Kiểm tra trùng tên trong phạm vi môn chung hoặc môn của chính Owner đó
  const existing = await pool.request()
    .input('sportName', cleanName)
    .input('ownerId', ownerId)
    .query(`
      SELECT s.sport_id
      FROM sports s
      LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
      WHERE (s.owner_id IS NULL OR s.owner_id = @ownerId)
        AND LOWER(LTRIM(RTRIM(COALESCE(os.custom_name, s.sport_name)))) = LOWER(@sportName)
    `);

  if (existing.recordset.length > 0) {
    throw new AppError(`Môn thể thao "${cleanName}" đã tồn tại trong danh mục của bạn.`, 409);
  }

  const result = await pool.request()
    .input('sportName', cleanName)
    .input('description', description.trim())
    .input('ownerId', ownerId)
    .query(`
      INSERT INTO sports (sport_name, description, status, owner_id, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (@sportName, @description, 'ACTIVE', @ownerId, GETDATE(), GETDATE())
    `);

  const inserted = result.recordset[0];
  return {
    ...inserted,
    court_count: 0,
    active_court_count: 0,
    inactive_court_count: 0,
    facility_count: 0,
    courts: [],
  };
}

/**
 * Cập nhật thông tin môn thể thao (cô lập theo từng Owner).
 * - Nếu môn là môn hệ thống chung (`owner_id IS NULL`) và người sửa là Owner: lưu bản ghi tùy chỉnh vào `owner_sports`
 *   của riêng Owner đó để không làm đổi tên/mô tả môn của các Owner khác.
 * - Nếu môn là môn riêng của một Owner (`owner_id IS NOT NULL`): kiểm tra đúng `owner_id` rồi cập nhật trực tiếp.
 * @param {number} sportId
 * @param {{ sportName?: string, description?: string }} data
 * @param {{ id?: number, role?: string }} [user]
 */
export async function updateSport(sportId, data, user = null) {
  const { sportName, description } = data;
  const ownerId = user?.id !== undefined && user?.id !== null ? Number(user.id) : null;
  const pool = await getPool();

  const rawSport = await getSportById(sportId);

  if (rawSport.owner_id !== null && rawSport.owner_id !== undefined) {
    if (ownerId !== null && Number(rawSport.owner_id) !== ownerId) {
      throw new AppError('Bạn không có quyền chỉnh sửa môn thể thao của chủ sân khác.', 403);
    }
  }

  if (sportName !== undefined) {
    if (!sportName.trim()) {
      throw new AppError('Tên môn thể thao không được để trống.', 400);
    }

    const cleanName = sportName.trim();
    const duplicate = await pool.request()
      .input('id', sportId)
      .input('sportName', cleanName)
      .input('ownerId', ownerId)
      .query(`
        SELECT s.sport_id
        FROM sports s
        LEFT JOIN owner_sports os ON os.sport_id = s.sport_id AND os.owner_id = @ownerId
        WHERE s.sport_id <> @id
          AND (s.owner_id IS NULL OR s.owner_id = @ownerId)
          AND LOWER(LTRIM(RTRIM(COALESCE(os.custom_name, s.sport_name)))) = LOWER(@sportName)
      `);

    if (duplicate.recordset.length > 0) {
      throw new AppError(`Tên môn "${cleanName}" đã được sử dụng bởi môn khác.`, 409);
    }
  }

  // Nếu là môn chung (owner_id IS NULL) và có thông tin Owner đang đăng nhập -> Lưu riêng vào bảng owner_sports
  if ((rawSport.owner_id === null || rawSport.owner_id === undefined) && ownerId !== null) {
    await pool.request()
      .input('ownerId', ownerId)
      .input('sportId', sportId)
      .input('customName', sportName ? sportName.trim() : null)
      .input('customDesc', description !== undefined ? description.trim() : null)
      .query(`
        IF EXISTS (SELECT 1 FROM owner_sports WHERE owner_id = @ownerId AND sport_id = @sportId)
        BEGIN
          UPDATE owner_sports
          SET custom_name = COALESCE(@customName, custom_name),
              custom_description = COALESCE(@customDesc, custom_description),
              updated_at = GETDATE()
          WHERE owner_id = @ownerId AND sport_id = @sportId;
        END
        ELSE
        BEGIN
          INSERT INTO owner_sports (owner_id, sport_id, custom_name, custom_description, status, updated_at)
          VALUES (@ownerId, @sportId, @customName, @customDesc, 'ACTIVE', GETDATE());
        END
      `);

    return await getSportById(sportId, ownerId);
  }

  // Trường hợp môn riêng của Owner hoặc gọi từ Unit test không truyền user
  await pool.request()
    .input('id', sportId)
    .input('sportName', sportName ? sportName.trim() : null)
    .input('description', description !== undefined ? description.trim() : null)
    .query(`
      UPDATE sports
      SET 
        sport_name = COALESCE(@sportName, sport_name),
        description = COALESCE(@description, description),
        updated_at = GETDATE()
      WHERE sport_id = @id
    `);

  return await getSportById(sportId, ownerId);
}

/**
 * Ngừng hoạt động hoặc kích hoạt lại môn thể thao (cô lập theo từng Owner).
 * - Khi Owner A khóa một môn chung (ví dụ "Bóng đá"), chỉ khóa trong phạm vi của Owner A (qua `owner_sports`),
 *   không làm khóa môn "Bóng đá" của Owner B.
 * @param {number} sportId
 * @param {'ACTIVE' | 'INACTIVE'} status
 * @param {{ id?: number, role?: string }} [user]
 */
export async function updateSportStatus(sportId, status, user = null) {
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  const ownerId = user?.id !== undefined && user?.id !== null ? Number(user.id) : null;
  const rawSport = await getSportById(sportId);

  if (rawSport.owner_id !== null && rawSport.owner_id !== undefined) {
    if (ownerId !== null && Number(rawSport.owner_id) !== ownerId) {
      throw new AppError('Bạn không có quyền thay đổi trạng thái môn thể thao của chủ sân khác.', 403);
    }
  }

  const pool = await getPool();

  if ((rawSport.owner_id === null || rawSport.owner_id === undefined) && ownerId !== null) {
    await pool.request()
      .input('ownerId', ownerId)
      .input('sportId', sportId)
      .input('status', normalizedStatus)
      .query(`
        IF EXISTS (SELECT 1 FROM owner_sports WHERE owner_id = @ownerId AND sport_id = @sportId)
        BEGIN
          UPDATE owner_sports
          SET status = @status, updated_at = GETDATE()
          WHERE owner_id = @ownerId AND sport_id = @sportId;
        END
        ELSE
        BEGIN
          INSERT INTO owner_sports (owner_id, sport_id, status, updated_at)
          VALUES (@ownerId, @sportId, @status, GETDATE());
        END
      `);

    return await getSportById(sportId, ownerId);
  }

  await pool.request()
    .input('id', sportId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE sports
      SET status = @status, updated_at = GETDATE()
      WHERE sport_id = @id
    `);

  return await getSportById(sportId, ownerId);
}
