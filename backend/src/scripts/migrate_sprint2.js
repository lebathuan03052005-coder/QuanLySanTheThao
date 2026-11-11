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

  // 5. Đồng bộ bảng [court_prices], [court_maintenances], [customers], [bookings], [transactions] (WBS 3.1, 3.2, 3.3)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'court_prices')
    BEGIN
      CREATE TABLE [dbo].[court_prices] (
        [price_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [court_id] INT NOT NULL,
        [day_type] VARCHAR(20) NOT NULL DEFAULT 'WEEKDAY',
        [start_time] TIME NOT NULL,
        [end_time] TIME NOT NULL,
        [price] DECIMAL(18,2) NOT NULL DEFAULT 200000
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'court_maintenances')
    BEGIN
      CREATE TABLE [dbo].[court_maintenances] (
        [maintenance_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [court_id] INT NOT NULL,
        [start_time] DATETIME NOT NULL,
        [end_time] DATETIME NOT NULL,
        [reason] NVARCHAR(255) NULL,
        [created_at] DATETIME DEFAULT GETDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
    BEGIN
      CREATE TABLE [dbo].[customers] (
        [customer_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [user_id] INT NULL,
        [full_name] NVARCHAR(100) NOT NULL,
        [phone] VARCHAR(20) NOT NULL,
        [email] VARCHAR(100) NULL,
        [reputation_score] DECIMAL(3,2) NOT NULL DEFAULT 5.0,
        [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        [notes] NVARCHAR(500) NULL,
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [UQ_customers_phone] UNIQUE NONCLUSTERED ([phone] ASC)
      );
    END

    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'bookings')
    BEGIN
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[bookings]') AND name = 'customer_id')
      BEGIN
        ALTER TABLE [dbo].[bookings] ADD [customer_id] INT NULL;
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[bookings]') AND name = 'deposit_amount')
      BEGIN
        ALTER TABLE [dbo].[bookings] ADD [deposit_amount] DECIMAL(18,2) NOT NULL DEFAULT 0;
      END

      IF EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[bookings]')
          AND name = 'user_id'
          AND is_nullable = 0
      )
      BEGIN
        ALTER TABLE [dbo].[bookings] ALTER COLUMN [user_id] INT NULL;
      END

      DECLARE @bkChkName NVARCHAR(256) = (
        SELECT TOP 1 name FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.bookings')
          AND definition LIKE '%status%'
          AND (definition NOT LIKE '%CHECKED-IN%' OR definition NOT LIKE '%NO-SHOW%')
      );
      IF @bkChkName IS NOT NULL
      BEGIN
        EXEC('ALTER TABLE [dbo].[bookings] DROP CONSTRAINT [' + @bkChkName + ']');
        ALTER TABLE [dbo].[bookings] WITH CHECK ADD CHECK (
          [status]='PENDING' OR [status]='CONFIRMED' OR [status]='CHECKED-IN'
          OR [status]='COMPLETED' OR [status]='CANCELLED' OR [status]='NO-SHOW'
        );
      END
    END

    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions')
    BEGIN
      IF EXISTS (
        SELECT * FROM sys.columns
        WHERE object_id = OBJECT_ID(N'[dbo].[transactions]')
          AND name = 'user_id'
          AND is_nullable = 0
      )
      BEGIN
        ALTER TABLE [dbo].[transactions] ALTER COLUMN [user_id] INT NULL;
      END
    END
  `);

  // Đồng bộ dữ liệu khách hàng từ các đơn đặt sân đã có sang bảng [customers]
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
    AND EXISTS (SELECT * FROM sys.tables WHERE name = 'bookings')
    BEGIN
      INSERT INTO [dbo].[customers] ([user_id], [full_name], [phone], [email], [reputation_score], [status], [created_at], [updated_at])
      SELECT DISTINCT
        u.user_id,
        u.full_name,
        u.phone,
        CASE WHEN u.email LIKE 'guest_%@sportlink.vn' THEN NULL ELSE u.email END,
        ISNULL(u.reputation_score, 5.0),
        ISNULL(u.status, 'ACTIVE'),
        ISNULL(u.created_at, GETDATE()),
        GETDATE()
      FROM [dbo].[users] u
      INNER JOIN [dbo].[bookings] b ON b.user_id = u.user_id
      WHERE u.phone IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM [dbo].[customers] c WHERE c.phone = u.phone
        );

      UPDATE b
      SET b.customer_id = c.customer_id
      FROM [dbo].[bookings] b
      INNER JOIN [dbo].[users] u ON b.user_id = u.user_id
      INNER JOIN [dbo].[customers] c ON c.phone = u.phone
      WHERE b.customer_id IS NULL;
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
