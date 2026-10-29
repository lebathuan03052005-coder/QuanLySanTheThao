import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    cryptoCredentialsDetails: {
      minVersion: 'TLSv1',
    },
  },
};

console.log('Đang kết nối tới:', config.server + ':' + config.port, '|', config.database);

try {
  const pool = await sql.connect(config);
  const result = await pool.request().query('SELECT DB_NAME() AS db, GETDATE() AS now, SYSTEM_USER AS loginUser');
  console.log('✅ Kết nối thành công!');
  console.log('   Database:', result.recordset[0].db);
  console.log('   Login as:', result.recordset[0].loginUser);
  console.log('   Server time:', result.recordset[0].now);
  await pool.close();
} catch (err) {
  console.error('❌ Kết nối thất bại:', err.message);
  if (err.code) console.error('   Error code:', err.code);
}
