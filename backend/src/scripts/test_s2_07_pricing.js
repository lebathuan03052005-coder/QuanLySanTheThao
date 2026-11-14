/**
 * Kiểm thử Unit/Integration Test cho WBS 3.2 (S2-07): Cấu hình khung giờ & biểu phí sân
 * Lệnh chạy: node --env-file=.env src/scripts/test_s2_07_pricing.js
 */
import assert from 'node:assert/strict';
import { getPool } from '../core/config/db.js';
import * as courtService from '../modules/courts/court.service.js';

async function runTest() {
  console.log('===================================================================');
  console.log('🧪 KIỂM THỬ S2-07: CẤU HÌNH KHUNG GIỜ & BIỂU PHÍ SÂN (COURT_PRICES)');
  console.log('===================================================================');

  const pool = await getPool();

  // Lấy 1 sân mẫu trong DB
  const courtRes = await pool.request().query('SELECT TOP 1 court_id, court_name FROM courts ORDER BY court_id ASC');
  const testCourt = courtRes.recordset[0];
  assert.ok(testCourt, 'Phải có ít nhất 1 sân trong DB để test');
  const courtId = testCourt.court_id;
  console.log(`Kiểm thử trên sân: ${testCourt.court_name} (court_id = ${courtId})`);

  // 1. Test getCourtPrices
  const initialPrices = await courtService.getCourtPrices(courtId);
  console.log(`✅ TC-PRICING-01: Lấy thành công ${initialPrices.length} quy tắc giá hiện có`);

  // 2. Test updateCourtPrices với bộ quy tắc mẫu mới
  const newRules = [
    { day_type: 'NORMAL', start_time: '06:00', end_time: '17:00', price: 90000 },
    { day_type: 'NORMAL', start_time: '17:00', end_time: '23:00', price: 160000 },
    { day_type: 'WEEKEND', start_time: '06:00', end_time: '23:00', price: 190000 },
    { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 220000 },
  ];

  const updatedPrices = await courtService.updateCourtPrices(courtId, newRules);
  assert.equal(updatedPrices.length, 4, 'Số lượng quy tắc sau khi cập nhật phải là 4');
  assert.equal(Number(updatedPrices[0].price), 90000, 'Đơn giá ca thường phải là 90.000 đ');
  assert.equal(Number(updatedPrices[1].price), 160000, 'Đơn giá ca cao điểm phải là 160.000 đ');
  console.log('✅ TC-PRICING-02: Cập nhật thành công 4 quy tắc giá mới trong Transaction');

  // 3. Test validate: từ chối khi loại ngày không hợp lệ
  let invalidDayBlocked = false;
  try {
    await courtService.updateCourtPrices(courtId, [
      { day_type: 'INVALID_DAY', start_time: '06:00', end_time: '12:00', price: 100000 }
    ]);
  } catch (err) {
    invalidDayBlocked = true;
  }
  assert.equal(invalidDayBlocked, true, 'Phải từ chối khi loại ngày không hợp lệ');
  console.log('✅ TC-PRICING-03: Chặn thành công khi loại ngày không hợp lệ');

  // 4. Test validate: từ chối khi giá âm
  let negativePriceBlocked = false;
  try {
    await courtService.updateCourtPrices(courtId, [
      { day_type: 'NORMAL', start_time: '06:00', end_time: '12:00', price: -50000 }
    ]);
  } catch (err) {
    negativePriceBlocked = true;
  }
  assert.equal(negativePriceBlocked, true, 'Phải từ chối khi đơn giá âm');
  console.log('✅ TC-PRICING-04: Chặn thành công khi đơn giá âm');

  console.log('-------------------------------------------------------------------');
  console.log('🎉 TẤT CẢ 4/4 CA KIỂM THỬ S2-07 ĐỀU VƯỢT QUA (100% PASSED)!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
