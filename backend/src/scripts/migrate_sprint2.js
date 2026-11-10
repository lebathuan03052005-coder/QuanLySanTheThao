import { getPool } from '../core/config/db.js';

/**
 * ============================================================================
 * SCRIPT MIGRATION SPRINT 2 (CHỈ CHỨA DDL - CHẠY 1 LẦN KHI CẬP NHẬT SCHEMA)
 * Cách chạy:
 *   cd backend
 *   npm run db:migrate
 * ============================================================================
 */
export async function runSprint2Migration() {
  const pool = await getPool();
  console.log('--- Bắt đầu Migration Sprint 2 (DDL): Users, Staff, Facilities, Courts & Sports ---');

  // 1. Đồng bộ các cột mở rộng của bảng [users] và bảng [court_staff]
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'avatar_url')
    BEGIN
      ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'status')
    BEGIN
      ALTER TABLE [dbo].[users] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'owner_id')
    BEGIN
      ALTER TABLE [dbo].[users] ADD [owner_id] INT NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'job_title')
    BEGIN
      ALTER TABLE [dbo].[users] ADD [job_title] NVARCHAR(100) NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[court_staff]'))
    BEGIN
      CREATE TABLE [dbo].[court_staff] (
        [assignment_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [staff_id] INT NOT NULL,
        [court_id] INT NOT NULL,
        [assigned_by] INT NOT NULL,
        [assigned_at] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [unique_staff_court] UNIQUE NONCLUSTERED ([staff_id] ASC, [court_id] ASC)
      );
    END
  `);

  // 2. Tạo bảng [facilities] nếu chưa tồn tại
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
    END
  `);

  // 3. Cập nhật các cột bổ sung cho bảng [courts]
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'facility_id')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [facility_id] INT NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'capacity')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [capacity] INT NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'images')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [images] NVARCHAR(MAX) NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'created_at')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [created_at] DATETIME DEFAULT GETDATE();
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'updated_at')
    BEGIN
      ALTER TABLE [dbo].[courts] ADD [updated_at] DATETIME DEFAULT GETDATE();
    END

    DECLARE @courtChkName NVARCHAR(256) = (
      SELECT TOP 1 name FROM sys.check_constraints 
      WHERE parent_object_id = OBJECT_ID('dbo.courts')
        AND definition LIKE '%status%'
        AND definition NOT LIKE '%MAINTENANCE%'
    );
    IF @courtChkName IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE [dbo].[courts] DROP CONSTRAINT [' + @courtChkName + ']');
      ALTER TABLE [dbo].[courts] WITH CHECK ADD CHECK ([status]='ACTIVE' OR [status]='INACTIVE' OR [status]='CLOSED' OR [status]='MAINTENANCE');
    END
  `);

  // 4. Cập nhật các cột bổ sung cho bảng [sports] và bảng cấu hình riêng theo chủ sân [owner_sports]
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sports')
    BEGIN
      CREATE TABLE [dbo].[sports] (
        [sport_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [sport_name] NVARCHAR(100) NOT NULL,
        [description] NVARCHAR(500) NULL,
        [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        [owner_id] INT NULL,
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'status')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'owner_id')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [owner_id] INT NULL;
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'created_at')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [created_at] DATETIME DEFAULT GETDATE();
    END

    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sports]') AND name = 'updated_at')
    BEGIN
      ALTER TABLE [dbo].[sports] ADD [updated_at] DATETIME DEFAULT GETDATE();
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'owner_sports')
    BEGIN
      CREATE TABLE [dbo].[owner_sports] (
        [owner_id] INT NOT NULL,
        [sport_id] INT NOT NULL,
        [custom_name] NVARCHAR(100) NULL,
        [custom_description] NVARCHAR(500) NULL,
        [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        [updated_at] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [pk_owner_sports] PRIMARY KEY CLUSTERED ([owner_id] ASC, [sport_id] ASC),
        CONSTRAINT [fk_owner_sports_user] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_owner_sports_sport] FOREIGN KEY ([sport_id]) REFERENCES [dbo].[sports]([sport_id])
      );
    END
  `);

  console.log('✅ Hoàn tất Migration Sprint 2 (DDL) thành công!');
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
