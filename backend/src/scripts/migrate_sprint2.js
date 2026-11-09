import { getPool } from '../core/config/db.js';

export async function runSprint2Migration() {
  const pool = await getPool();
  console.log('--- Bắt đầu Migration Sprint 2: Facilities, Courts & Sports ---');

  // 1. Tạo bảng facilities nếu chưa tồn tại
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'facilities')
    BEGIN
      CREATE TABLE [dbo].[facilities] (
        [facility_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [owner_id] INT NOT NULL,
        [name] NVARCHAR(150) NOT NULL,
        [address] NVARCHAR(255) NOT NULL,
        [phone] VARCHAR(20) NULL,
        [description] NVARCHAR(MAX) NULL,
        [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [fk_facilities_owner] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([user_id])
      );
      PRINT 'Đã tạo bảng facilities';
    END
  `);

  // 2. Cập nhật các cột bổ sung cho bảng courts
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'facility_id')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [facility_id] INT NULL;
      ALTER TABLE [dbo].[courts] ADD CONSTRAINT [fk_courts_facility] FOREIGN KEY ([facility_id]) REFERENCES [dbo].[facilities]([facility_id]);
      PRINT 'Đã thêm cột facility_id vào courts';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'capacity')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [capacity] INT NULL;
      PRINT 'Đã thêm cột capacity vào courts';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'created_at')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [created_at] DATETIME DEFAULT GETDATE();
      PRINT 'Đã thêm cột created_at vào courts';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'updated_at')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [updated_at] DATETIME DEFAULT GETDATE();
      PRINT 'Đã thêm cột updated_at vào courts';
    END

    -- Cập nhật ràng buộc status cho courts để hỗ trợ đầy đủ ACTIVE, INACTIVE, CLOSED, MAINTENANCE
    DECLARE @courtChkName NVARCHAR(256) = (
      SELECT name FROM sys.check_constraints 
      WHERE parent_object_id = OBJECT_ID('dbo.courts') AND definition LIKE '%status%'
    );
    IF @courtChkName IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE [dbo].[courts] DROP CONSTRAINT ' + @courtChkName);
      ALTER TABLE [dbo].[courts] WITH CHECK ADD CHECK ([status]='ACTIVE' OR [status]='INACTIVE' OR [status]='CLOSED' OR [status]='MAINTENANCE');
      PRINT 'Đã cập nhật ràng buộc status cho bảng courts';
    END
  `);

  // 3. Cập nhật các cột bổ sung cho bảng sports
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'status')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
      PRINT 'Đã thêm cột status vào sports';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'created_at')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [created_at] DATETIME DEFAULT GETDATE();
      PRINT 'Đã thêm cột created_at vào sports';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'updated_at')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [updated_at] DATETIME DEFAULT GETDATE();
      PRINT 'Đã thêm cột updated_at vào sports';
    END
  `);

  // 4. Nếu chưa có facility nào, tạo mẫu 2 cơ sở cho owner hiện tại và liên kết các court hiện có
  const checkFac = await pool.request().query('SELECT COUNT(*) AS total FROM facilities');
  if (checkFac.recordset[0].total === 0) {
    const ownerRes = await pool.request().query("SELECT TOP 1 user_id FROM users WHERE role = 'OWNER'");
    const ownerId = ownerRes.recordset[0]?.user_id ?? 0;

    await pool.request().query(`
      INSERT INTO facilities (owner_id, name, address, phone, description, status)
      VALUES 
      (${ownerId}, N'Cơ sở 1 - Cụm Sân Thể Thao Man Thiện PTIT', N'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', '0901234567', N'Tổ hợp sân thể thao chất lượng cao phục vụ sinh viên và phong trào khu vực Thủ Đức', 'ACTIVE'),
      (${ownerId}, N'Cơ sở 2 - Trung Tâm Thể Thao & Pickleball Lê Văn Việt', N'Số 216 Lê Văn Việt, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', '0901234568', N'Tổ hợp sân Pickleball ngoài trời có mái che và sân bóng đá mini', 'ACTIVE');
    `);

    // Gán các sân hiện có vào cơ sở 1 và 2
    const facs = await pool.request().query('SELECT facility_id FROM facilities ORDER BY facility_id ASC');
    if (facs.recordset.length >= 2) {
      const fac1 = facs.recordset[0].facility_id;
      const fac2 = facs.recordset[1].facility_id;
      await pool.request().query(`
        UPDATE courts SET facility_id = ${fac1}, capacity = 14 WHERE court_id IN (0, 1, 3);
        UPDATE courts SET facility_id = ${fac2}, capacity = 8 WHERE court_id IN (2, 4, 5);
        UPDATE courts SET facility_id = ${fac1}, capacity = 20 WHERE facility_id IS NULL;
      `);
    }
    console.log('Đã tạo 2 cơ sở mẫu và liên kết các sân con');
  }

  console.log('✅ Hoàn tất migration Sprint 2!');
}

// Nếu chạy trực tiếp script này
if (process.argv[1]?.endsWith('migrate_sprint2.js')) {
  runSprint2Migration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Lỗi migration:', err);
      process.exit(1);
    });
}
