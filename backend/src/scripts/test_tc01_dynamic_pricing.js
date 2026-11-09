/**
 * [6.0] Kịch bản Kiểm thử Chéo Giá động và Biên Khung giờ (TC01)
 * Phụ trách: Đặng Quang Luân (S2-12)
 * Chạy kiểm thử: node src/scripts/test_tc01_dynamic_pricing.js
 */
import assert from 'node:assert/strict';
import { calculateDynamicPrice } from '../modules/bookings/booking.service.js';

const samplePriceRules = [
  { day_type: 'WEEKDAY', start_time: '06:00', end_time: '16:00', price: 200000 },
  { day_type: 'WEEKDAY', start_time: '16:00', end_time: '21:00', price: 350000 },
  { day_type: 'WEEKDAY', start_time: '21:00', end_time: '23:00', price: 250000 },
  { day_type: 'WEEKEND', start_time: '06:00', end_time: '16:00', price: 280000 },
  { day_type: 'WEEKEND', start_time: '16:00', end_time: '22:00', price: 420000 },
  { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 450000 },
];

console.log('===================================================================');
console.log('🧪 CHẠY BỘ KIỂM THỬ TC01: HÀM TÍNH GIÁ ĐỘNG & BIÊN KHUNG GIỜ');
console.log('===================================================================');

// TC01-1: Ngày thường (Thứ Hai 2026-11-09), trọn vẹn trong khung giờ thấp điểm (08:00 - 10:00)
const tc1 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '08:00', '10:00', false);
assert.equal(tc1, 400000, 'TC01-1 thất bại: 2 giờ thấp điểm ngày thường phải bằng 400,000đ');
console.log('✅ TC01-1 PASS: Đặt 08:00-10:00 ngày thường (Off-peak) =>', tc1.toLocaleString('vi-VN'), 'đ');

// TC01-2: Ngày thường (Thứ Hai 2026-11-09), trọn vẹn trong khung giờ cao điểm (17:00 - 19:00)
const tc2 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '17:00', '19:00', false);
assert.equal(tc2, 700000, 'TC01-2 thất bại: 2 giờ cao điểm ngày thường phải bằng 700,000đ');
console.log('✅ TC01-2 PASS: Đặt 17:00-19:00 ngày thường (Peak)     =>', tc2.toLocaleString('vi-VN'), 'đ');

// TC01-3: Đặt sân vắt qua biên khung giờ (15:00 - 17:00, biên đổi giá lúc 16:00)
// 1 giờ thấp điểm (200k) + 1 giờ cao điểm (350k) = 550,000đ
const tc3 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '15:00', '17:00', false);
assert.equal(tc3, 550000, 'TC01-3 thất bại: Vắt biên 15:00-17:00 phải bằng 550,000đ');
console.log('✅ TC01-3 PASS: Vắt biên 15:00-17:00 (1h thường + 1h cao điểm) =>', tc3.toLocaleString('vi-VN'), 'đ');

// TC01-4: Đặt sân vắt qua biên có lẻ 30 phút (15:30 - 17:00)
// 0.5 giờ thấp điểm (100k) + 1 giờ cao điểm (350k) = 450,000đ
const tc4 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '15:30', '17:00', false);
assert.equal(tc4, 450000, 'TC01-4 thất bại: Vắt biên 15:30-17:00 phải bằng 450,000đ');
console.log('✅ TC01-4 PASS: Vắt biên lẻ 30p (15:30-17:00)          =>', tc4.toLocaleString('vi-VN'), 'đ');

// TC01-5: Đặt sân vào ngày cuối tuần (Chủ Nhật 2026-11-15, 15:00 - 17:00)
// 1 giờ cuối tuần thấp điểm (280k) + 1 giờ cuối tuần cao điểm (420k) = 700,000đ
const tc5 = calculateDynamicPrice(samplePriceRules, '2026-11-15', '15:00', '17:00', false);
assert.equal(tc5, 700000, 'TC01-5 thất bại: Cuối tuần vắt biên 15:00-17:00 phải bằng 700,000đ');
console.log('✅ TC01-5 PASS: Cuối tuần (WEEKEND) vắt biên 15:00-17:00 =>', tc5.toLocaleString('vi-VN'), 'đ');

// TC01-6: Đặt sân vào ngày lễ (HOLIDAY, 2 giờ: 18:00 - 20:00) => 900,000đ
const tc6 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '18:00', '20:00', true);
assert.equal(tc6, 900000, 'TC01-6 thất bại: 2 giờ ngày lễ phải bằng 900,000đ');
console.log('✅ TC01-6 PASS: Ngày lễ (HOLIDAY) 18:00-20:00          =>', tc6.toLocaleString('vi-VN'), 'đ');

// TC01-7: Kiểm tra bắt lỗi khi giờ kết thúc <= giờ bắt đầu
let errorThrown = false;
try {
  calculateDynamicPrice(samplePriceRules, '2026-11-09', '19:00', '17:00', false);
} catch (err) {
  errorThrown = true;
}
assert.equal(errorThrown, true, 'TC01-7 thất bại: Phải báo lỗi khi giờ kết thúc <= giờ bắt đầu');
console.log('✅ TC01-7 PASS: Chặn hợp lệ trường hợp giờ kết thúc <= giờ bắt đầu');

console.log('-------------------------------------------------------------------');
console.log('🎉 TẤT CẢ 7/7 TEST CASES CỦA TC01 ĐỀU VƯỢT QUA (100% PASSED)!');

