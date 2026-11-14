/**
 * [3.2 / 6.0] Kịch bản Kiểm thử Hàm Tính Giá Động và Biên Khung Giờ (TC01)
 * Phát triển & Unit Test: Trần Lê Quang Hữu (S2-08)
 * Test chéo & Ghi lỗi: Đặng Quang Luân (S2-12)
 * Chạy kiểm thử: npm run test:tc01 (hoặc node src/scripts/test_tc01_dynamic_pricing.js)
 */
import assert from 'node:assert/strict';
import { calculateDynamicPrice } from '../modules/bookings/booking.service.js';

const samplePriceRules = [
  { day_type: 'NORMAL', start_time: '06:00', end_time: '16:00', price: 200000 },
  { day_type: 'NORMAL', start_time: '16:00', end_time: '21:00', price: 350000 },
  { day_type: 'NORMAL', start_time: '21:00', end_time: '23:00', price: 250000 },
  { day_type: 'WEEKEND', start_time: '06:00', end_time: '16:00', price: 280000 },
  { day_type: 'WEEKEND', start_time: '16:00', end_time: '23:00', price: 420000 },
  { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 450000 },
];

// Bảng giá có biên đổi giá lúc 17:00 để khớp ví dụ 16:00 - 18:00 trong thẻ Trello
const boundary17PriceRules = [
  { day_type: 'WEEKDAY', start_time: '06:00', end_time: '17:00', price: 180000 },
  { day_type: 'WEEKDAY', start_time: '17:00', end_time: '23:00', price: 320000 },
];

console.log('===================================================================');
console.log('🧪 CHẠY BỘ KIỂM THỬ TC01: HÀM TÍNH GIÁ ĐỘNG & BIÊN KHUNG GIỜ');
console.log('===================================================================');

// TC01-1: Ngày thường (Thứ Hai 2026-11-09), trọn vẹn trong khung giờ thấp điểm (08:00 - 10:00)
const tc1 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '08:00', '10:00', false);
assert.equal(tc1, 400000, 'TC01-1 thất bại: 2 giờ thấp điểm ngày thường phải bằng 400,000đ');
console.log('✅ TC01-1 PASS: Đặt 08:00-10:00 ngày thường (Off-peak)          =>', tc1.toLocaleString('vi-VN'), 'đ');

// TC01-2: Ngày thường (Thứ Hai 2026-11-09), trọn vẹn trong khung giờ cao điểm (17:00 - 19:00)
const tc2 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '17:00', '19:00', false);
assert.equal(tc2, 700000, 'TC01-2 thất bại: 2 giờ cao điểm ngày thường phải bằng 700,000đ');
console.log('✅ TC01-2 PASS: Đặt 17:00-19:00 ngày thường (Peak Hour)         =>', tc2.toLocaleString('vi-VN'), 'đ');

// TC01-3A: Đặt sân vắt qua biên khung giờ 16:00 - 18:00 (biên đổi giá lúc 17:00 theo đúng mô tả thẻ)
// 1 giờ giá thường (180k) + 1 giờ giá cao điểm (320k) = 500,000đ
const tc3a = calculateDynamicPrice(boundary17PriceRules, '2026-11-09', '16:00', '18:00', false);
assert.equal(tc3a, 500000, 'TC01-3A thất bại: Vắt biên 16:00-18:00 (biên 17:00) phải bằng 500,000đ');
console.log('✅ TC01-3A PASS: Vắt biên 16:00-18:00 (biên 17:00: 180k + 320k) =>', tc3a.toLocaleString('vi-VN'), 'đ');

// TC01-3B: Đặt sân vắt qua biên khung giờ (15:00 - 17:00, biên đổi giá lúc 16:00)
// 1 giờ thấp điểm (200k) + 1 giờ cao điểm (350k) = 550,000đ
const tc3b = calculateDynamicPrice(samplePriceRules, '2026-11-09', '15:00', '17:00', false);
assert.equal(tc3b, 550000, 'TC01-3B thất bại: Vắt biên 15:00-17:00 phải bằng 550,000đ');
console.log('✅ TC01-3B PASS: Vắt biên 15:00-17:00 (biên 16:00: 200k + 350k) =>', tc3b.toLocaleString('vi-VN'), 'đ');

// TC01-4: Đặt sân vắt qua biên có lẻ 30 phút (15:30 - 17:00)
// 0.5 giờ thấp điểm (100k) + 1 giờ cao điểm (350k) = 450,000đ
const tc4 = calculateDynamicPrice(samplePriceRules, '2026-11-09', '15:30', '17:00', false);
assert.equal(tc4, 450000, 'TC01-4 thất bại: Vắt biên lẻ 30 phút 15:30-17:00 phải bằng 450,000đ');
console.log('✅ TC01-4 PASS: Vắt biên lẻ 30p (15:30-17:00)                   =>', tc4.toLocaleString('vi-VN'), 'đ');

// TC01-5: Đặt sân ngày cuối tuần (Chủ Nhật 2026-11-08) vắt qua biên 15:00 - 17:00
// 1 giờ thường cuối tuần (280k) + 1 giờ cao điểm cuối tuần (420k) = 700,000đ
const tc5 = calculateDynamicPrice(samplePriceRules, '2026-11-08', '15:00', '17:00', false);
assert.equal(tc5, 700000, 'TC01-5 thất bại: Cuối tuần vắt biên 15:00-17:00 phải bằng 700,000đ');
console.log('✅ TC01-5 PASS: Cuối tuần (WEEKEND) vắt biên 15:00-17:00        =>', tc5.toLocaleString('vi-VN'), 'đ');

// TC01-6: Đặt sân ngày lễ (HOLIDAY - tự động nhận diện Quốc khánh 2026-09-02) 18:00 - 20:00 (2 giờ x 450k = 900,000đ)
const tc6 = calculateDynamicPrice(samplePriceRules, '2026-09-02', '18:00', '20:00', false);
assert.equal(tc6, 900000, 'TC01-6 thất bại: Ngày lễ 2 giờ phải bằng 900,000đ');
console.log('✅ TC01-6 PASS: Ngày lễ (HOLIDAY 02/09) 18:00-20:00             =>', tc6.toLocaleString('vi-VN'), 'đ');

// TC01-7: Kiểm tra dữ liệu đầu vào bất hợp lệ (Giờ kết thúc <= Giờ bắt đầu)
let invalidTimeCaught = false;
try {
  calculateDynamicPrice(samplePriceRules, '2026-11-09', '18:00', '16:00', false);
} catch (err) {
  invalidTimeCaught = err.statusCode === 400;
}
assert.equal(invalidTimeCaught, true, 'TC01-7 thất bại: Phải ném lỗi 400 khi giờ kết thúc <= giờ bắt đầu');
console.log('✅ TC01-7 PASS: Chặn hợp lệ trường hợp giờ kết thúc <= giờ bắt đầu (400)');

// TC01-8: Kiểm tra khung giờ ngoài giờ mở cửa (Trước 06:00 hoặc sau 23:00)
let outsideOpenHoursCaught = false;
try {
  calculateDynamicPrice(samplePriceRules, '2026-11-09', '04:30', '06:30', false);
} catch (err) {
  outsideOpenHoursCaught = err.statusCode === 400;
}
let afterCloseHoursCaught = false;
try {
  calculateDynamicPrice(samplePriceRules, '2026-11-09', '22:00', '23:30', false);
} catch (err) {
  afterCloseHoursCaught = err.statusCode === 400;
}
assert.equal(
  outsideOpenHoursCaught && afterCloseHoursCaught,
  true,
  'TC01-8 thất bại: Phải ném lỗi 400 khi đặt sân ngoài khung giờ mở cửa 06:00 - 23:00'
);
console.log('✅ TC01-8 PASS: Chặn hợp lệ khung giờ ngoài giờ mở cửa 06:00 - 23:00 (400)');

console.log('-------------------------------------------------------------------');
console.log('🎉 TẤT CẢ 9/9 TEST CASES CỦA TC01 ĐỀU VƯỢT QUA (100% PASSED)!');

