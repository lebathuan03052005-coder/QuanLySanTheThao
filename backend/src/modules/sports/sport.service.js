import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE MANAGEMENT SERVICE
 * Đáp ứng đặc tả chức năng WBS 3.1 (S2-03): Quản lý loại môn thể thao (thiết kế mở rộng)
 * Trả về chi tiết từng môn thể thao kèm danh sách đầy đủ các sân con, cơ sở sân,
 * chủ sân quản lý và trạng thái hoạt động chi tiết của từng sân.
 * ============================================================================
 */

let sportSchemaReady = false;

/**
 * Đảm bảo bảng [sports] có đầy đủ các cột mở rộng (status, created_at, updated_at)
 * và dữ liệu môn thể thao mặc định.
 */
export async function ensureSportSchema() {
  if (sportSchemaReady) return;
  const pool = await getPool();

  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sports')
      BEGIN
        CREATE TABLE [dbo].[sports] (
          [sport_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          [sport_name] NVARCHAR(100) NOT NULL,
          [description] NVARCHAR(500) NULL,
          [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          [created_at] DATETIME DEFAULT GETDATE(),
          [updated_at] DATETIME DEFAULT GETDATE()
        );
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'status')
      BEGIN
        ALTER TABLE [dbo].[sports] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'created_at')
      BEGIN
        ALTER TABLE [dbo].[sports] ADD [created_at] DATETIME DEFAULT GETDATE();
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'updated_at')
      BEGIN
        ALTER TABLE [dbo].[sports] ADD [updated_at] DATETIME DEFAULT GETDATE();
      END
    `);

    // Xóa dữ liệu test bị lỗi font chữ '?' nếu có và chuẩn hóa status NULL -> 'ACTIVE'
    await pool.request().query(`
      UPDATE [dbo].[sports]
      SET [status] = 'ACTIVE',
          [created_at] = ISNULL([created_at], GETDATE()),
          [updated_at] = ISNULL([updated_at], GETDATE())
      WHERE [status] IS NULL OR [created_at] IS NULL;

      DELETE FROM [dbo].[sports]
      WHERE ([sport_name] LIKE '%?%' OR [description] LIKE '%?%')
        AND [sport_id] NOT IN (SELECT DISTINCT [sport_id] FROM [dbo].[courts] WHERE [sport_id] IS NOT NULL);
    `);

    // Đảm bảo có đủ 6 môn thể thao tiêu chuẩn trong hệ thống
    const defaultSports = [
      { name: 'Bóng đá', desc: 'Sân bóng đá cỏ nhân tạo 5 người, 7 người và 11 người tiêu chuẩn thi đấu' },
      { name: 'Cầu lông', desc: 'Sân cầu lông thảm PVC tiêu chuẩn thi đấu trong nhà, ánh sáng chống lóa' },
      { name: 'Pickleball', desc: 'Sân Pickleball mặt sơn Acrylic chống trượt có mái che và ngoài trời' },
      { name: 'Tennis', desc: 'Sân quần vợt mặt cứng tiêu chuẩn có hệ thống đèn chiếu sáng ban đêm' },
      { name: 'Bóng rổ', desc: 'Sân bóng rổ 3x3 và 5x5 mặt sàn gỗ và sơn chuyên dụng tiêu chuẩn FIBA' },
      { name: 'Bóng chuyền', desc: 'Sân bóng chuyền hơi và bóng chuyền da tiêu chuẩn thi đấu trong nhà' },
    ];

    for (const sp of defaultSports) {
      await pool.request()
        .input('name', sp.name)
        .input('desc', sp.desc)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE LOWER(LTRIM(RTRIM([sport_name]))) = LOWER(@name))
          BEGIN
            INSERT INTO [dbo].[sports] ([sport_name], [description], [status], [created_at], [updated_at])
            VALUES (@name, @desc, 'ACTIVE', GETDATE(), GETDATE());
          END
        `);
    }

    sportSchemaReady = true;
  } catch (err) {
    console.error('Cảnh báo đồng bộ schema bảng sports:', err.message);
  }
}

/**
 * Lấy danh sách loại môn thể thao kèm chi tiết tất cả các sân con (thuộc cơ sở nào, chủ sân nào, trạng thái hoạt động ra sao).
 * @param {{ search?: string, status?: string }} filters
 */
export async function getAllSports(filters = {}) {
  await ensureSportSchema();
  const pool = await getPool();
  const { search = '', status = 'ALL' } = filters;

  let query = `
    SELECT 
      s.sport_id,
      s.sport_name,
      s.description,
      COALESCE(s.status, 'ACTIVE') AS status,
      s.created_at,
      s.updated_at
    FROM sports s
    WHERE 1=1
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
  const sportsList = sportsResult.recordset;

  // Lấy toàn bộ danh sách sân con kèm thông tin cơ sở và chủ sân để gắn chi tiết vào từng môn thể thao
  let courtsList = [];
  try {
    const courtsRes = await pool.request().query(`
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
        ISNULL(u.email, '') AS owner_email,
        ISNULL(c.capacity, 10) AS capacity,
        c.utilities,
        c.description,
        ISNULL(c.status, 'ACTIVE') AS status
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      LEFT JOIN users u ON c.owner_id = u.user_id
      ORDER BY c.facility_id ASC, c.court_id ASC
    `);
    courtsList = courtsRes.recordset;
  } catch {
    // Fallback nếu bảng facilities chưa được khởi tạo
    const fallbackRes = await pool.request().query(`
      SELECT 
        c.court_id,
        c.sport_id,
        c.court_name,
        NULL AS facility_id,
        N'Cơ sở độc lập' AS facility_name,
        c.address,
        'ACTIVE' AS facility_status,
        c.owner_id,
        N'Chủ sân SportLink' AS owner_name,
        '' AS owner_email,
        10 AS capacity,
        c.utilities,
        c.description,
        ISNULL(c.status, 'ACTIVE') AS status
      FROM courts c
      ORDER BY c.court_id ASC
    `);
    courtsList = fallbackRes.recordset;
  }

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
 * Lấy chi tiết một môn thể thao theo ID kèm danh sách sân con.
 * @param {number} sportId
 */
export async function getSportById(sportId) {
  const all = await getAllSports();
  const sport = all.find((s) => s.sport_id === sportId);
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
  await ensureSportSchema();
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
 * Cập nhật thông tin môn thể thao.
 * @param {number} sportId
 * @param {{ sportName?: string, description?: string }} data
 */
export async function updateSport(sportId, data) {
  await ensureSportSchema();
  const { sportName, description } = data;
  const pool = await getPool();

  await getSportById(sportId);

  if (sportName !== undefined) {
    if (!sportName.trim()) {
      throw new AppError('Tên môn thể thao không được để trống.', 400);
    }

    const cleanName = sportName.trim();
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

  return await getSportById(sportId);
}

/**
 * Ngừng hoạt động hoặc kích hoạt lại môn thể thao (Soft toggle).
 * @param {number} sportId
 * @param {'ACTIVE' | 'INACTIVE'} status
 */
export async function updateSportStatus(sportId, status) {
  await ensureSportSchema();
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  await getSportById(sportId);

  const pool = await getPool();
  await pool.request()
    .input('id', sportId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE sports
      SET status = @status, updated_at = GETDATE()
      WHERE sport_id = @id
    `);

  return await getSportById(sportId);
}
