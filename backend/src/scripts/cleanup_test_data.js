import { getPool } from '../core/config/db.js';

// Xóa các cơ sở và sân con được tạo bởi script kiểm thử tự động
// Giữ lại facility_id 1 và 2 (dữ liệu mẫu chính thức)
async function cleanup() {
  const pool = await getPool();

  // Xóa khung giá của các sân test trước (nếu có)
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'court_prices')
    BEGIN
      DELETE FROM court_prices WHERE court_id IN (
        SELECT court_id FROM courts WHERE facility_id IN (3,4,5,6) OR court_name LIKE N'%Test%' OR court_name LIKE N'%Kiểm Thử%'
      );
    END
  `);

  // Xóa sân con thuộc các facility test trước
  await pool.request().query(
    `DELETE FROM courts WHERE facility_id IN (3,4,5,6) OR court_name LIKE N'%Test%' OR court_name LIKE N'%Kiểm Thử%'`
  );
  console.log('Đã xóa sân con của facilities test');

  // Xóa các facility test
  await pool.request().query(
    `DELETE FROM facilities WHERE facility_id IN (3,4,5,6) OR name LIKE N'%Kiểm Thử%'`
  );
  console.log('Đã xóa facilities test (ID 3,4,5,6)');

  // Xóa các môn thể thao test
  await pool.request().query(`
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'owner_sports')
    BEGIN
      DELETE FROM owner_sports WHERE sport_id IN (SELECT sport_id FROM sports WHERE sport_name LIKE N'%Test%');
    END
    DELETE FROM sports WHERE sport_name LIKE N'%Test%';
  `);
  console.log('Đã xóa các môn thể thao test');

  // Hiển thị danh sách sạch
  const remaining = await pool.request().query('SELECT facility_id, name, status FROM facilities ORDER BY facility_id');
  console.log('\nDanh sách cơ sở còn lại:');
  remaining.recordset.forEach(f => console.log(`  [${f.facility_id}] ${f.name} (${f.status})`));

  process.exit(0);
}

cleanup().catch(e => { console.error(e); process.exit(1); });
