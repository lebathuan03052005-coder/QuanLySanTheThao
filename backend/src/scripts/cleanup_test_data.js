import { getPool } from '../core/config/db.js';

// Xóa các cơ sở, sân con và môn thể thao được tạo bởi script kiểm thử tự động (dựa theo tên test, không xóa theo ID cứng)
async function cleanup() {
  const pool = await getPool();

  // Xóa khung giá của các sân test trước (nếu có)
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'court_prices')
    BEGIN
      DELETE FROM court_prices WHERE court_id IN (
        SELECT court_id FROM courts
        WHERE court_name LIKE N'%Kiểm Thử%' OR court_name LIKE N'Sân Cỏ 5 Người Số 1%' OR court_name LIKE N'Sân Không Được Tạo Test%'
      );
    END
  `);

  // Xóa sân con kiểm thử
  await pool.request().query(`
    DELETE FROM courts
    WHERE court_name LIKE N'%Kiểm Thử%' OR court_name LIKE N'Sân Cỏ 5 Người Số 1%' OR court_name LIKE N'Sân Không Được Tạo Test%'
  `);
  console.log('Đã xóa sân con kiểm thử');

  // Xóa các cơ sở kiểm thử
  await pool.request().query(`
    DELETE FROM facilities WHERE name LIKE N'%Kiểm Thử%'
  `);
  console.log('Đã xóa cơ sở kiểm thử');

  // Xóa các môn thể thao kiểm thử
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'owner_sports')
    BEGIN
      DELETE FROM owner_sports WHERE sport_id IN (SELECT sport_id FROM sports WHERE sport_name LIKE N'Môn Test %');
    END
    DELETE FROM sports WHERE sport_name LIKE N'Môn Test %';
  `);
  console.log('Đã xóa môn thể thao kiểm thử');

  // Hiển thị danh sách sạch
  const remaining = await pool.request().query('SELECT facility_id, name, status FROM facilities ORDER BY facility_id');
  console.log('\nDanh sách cơ sở còn lại:');
  remaining.recordset.forEach((f) => console.log(`  [${f.facility_id}] ${f.name} (${f.status})`));

  process.exit(0);
}

cleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
