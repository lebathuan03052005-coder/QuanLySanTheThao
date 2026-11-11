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
 * Không tự động chạy DDL/DML khi khởi động server (đã tách sang `npm run db:migrate`).
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('Kết nối SQL Server thành công.');
  }
  return pool;
}

export default sql;
