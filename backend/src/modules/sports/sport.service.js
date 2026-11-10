import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE MANAGEMENT SERVICE
 * Đáp ứng đặc tả chức năng WBS 3.1 (S2-03): Quản lý loại môn thể thao
 * Tự động đồng bộ schema bảng [sports] khi khởi chạy để không bao giờ lỗi 500
 * khi các thành viên trong nhóm pull code về máy mới.
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

    // Khởi tạo danh mục môn thể thao mặc định nếu bảng đang trống
    const countRes = await pool.request().query('SELECT COUNT(*) AS total FROM [dbo].[sports]');
    if ((countRes.recordset[0]?.total || 0) === 0) {
      await pool.request().query(`
        INSERT INTO [dbo].[sports] ([sport_name], [description], [status], [created_at], [updated_at])
        VALUES
          (N'Bóng đá', N'Sân bóng đá cỏ nhân tạo 5 người, 7 người và 11 người', 'ACTIVE', GETDATE(), GETDATE()),
          (N'Cầu lông', N'Sân cầu lông thảm PVC tiêu chuẩn thi đấu trong nhà', 'ACTIVE', GETDATE(), GETDATE()),
          (N'Pickleball', N'Sân Pickleball mặt sơn Acrylic chống trượt có mái che', 'ACTIVE', GETDATE(), GETDATE()),
          (N'Tennis', N'Sân quần vợt tiêu chuẩn có hệ thống đèn chiếu sáng ban đêm', 'ACTIVE', GETDATE(), GETDATE()),
          (N'Bóng rổ', N'Sân bóng rổ 3x3 và 5x5 mặt sàn gỗ/sơn chuyên dụng', 'ACTIVE', GETDATE(), GETDATE()),
          (N'Bóng chuyền', N'Sân bóng chuyền hơi và bóng chuyền da trong nhà', 'ACTIVE', GETDATE(), GETDATE());
      `);
    }

    sportSchemaReady = true;
  } catch (err) {
    console.error('Cảnh báo đồng bộ schema bảng sports:', err.message);
  }
}

/**
 * Lấy danh sách loại môn thể thao kèm số lượng sân đang sử dụng.
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
  await ensureSportSchema();
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

  return result.recordset[0];
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
  await ensureSportSchema();
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
