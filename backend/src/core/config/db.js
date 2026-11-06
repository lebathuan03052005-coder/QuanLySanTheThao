import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

/** @type {sql.config} */
const dbConfig = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/** @type {sql.ConnectionPool | null} */
let pool = null;

/**
 * Lấy hoặc khởi tạo connection pool đến SQL Server.
 * Tự động đảm bảo schema cơ sở dữ liệu được đồng bộ đầy đủ (avatar_url, staff, status, court_staff).
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('Kết nối SQL Server thành công.');

    try {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
          AND name = 'avatar_url'
        )
        BEGIN
          ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
        END

        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
          AND name = 'status'
        )
        BEGIN
          ALTER TABLE [dbo].[users] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
        END

        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
          AND name = 'owner_id'
        )
        BEGIN
          ALTER TABLE [dbo].[users] ADD [owner_id] INT NULL;
        END

        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
          AND name = 'job_title'
        )
        BEGIN
          ALTER TABLE [dbo].[users] ADD [job_title] NVARCHAR(100) NULL;
        END

        IF NOT EXISTS (
          SELECT * FROM sys.tables 
          WHERE object_id = OBJECT_ID(N'[dbo].[court_staff]')
        )
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
    } catch (e) {
      // Bỏ qua nếu đã tồn tại hoặc không đủ quyền DDL
    }
  }
  return pool;
}

export default sql;
