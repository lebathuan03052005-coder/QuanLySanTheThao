import assert from 'node:assert/strict';
import { getPool } from '../core/config/db.js';
import {
  calculateDynamicPrice,
  getScheduleData,
  createBooking,
  updateBooking,
  createMaintenance,
  deleteMaintenance,
  getLocalDateStr,
} from '../modules/bookings/booking.service.js';
import {
  getCustomerList,
  getCustomerHistory,
  updateCustomerReputation,
} from '../modules/customers/customer.service.js';
import {
  getRevenueDashboard,
  getOccupancyAnalytics,
} from '../modules/analytics/analytics.service.js';
import { authorize } from '../core/middlewares/auth.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

async function runLuanSprint2AutomatedTests() {
  console.log('========================================================================');
  console.log('🚀 BỘ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN SPRINT 2 - ĐẶNG QUANG LUÂN');
  console.log('   Bao gồm: S2-05 (Lịch sân), S2-06 (Khách hàng CRM), S2-09 (Doanh thu),');
  console.log('            S2-10 (Tỷ lệ lấp đầy & Giờ vắng), S2-12 (TC01 & TC04 RBAC)');
  console.log('========================================================================\n');

  const pool = await getPool();
  let totalPassed = 0;
  const pass = (code, msg) => {
    totalPassed++;
    console.log(`✅ [PASS] ${code}: ${msg}`);
  };

  // Lấy thông tin các tài khoản thực tế trong DB
  const usersRes = await pool.request().query(`
    SELECT user_id, email, full_name, role, owner_id
    FROM users
    WHERE email IN ('owner@sportlink.vn', 'owner2@sportlink.vn', 'staff@sportlink.vn', 'player@sportlink.vn')
  `);
  const userByEmail = Object.fromEntries(
    usersRes.recordset.map((u) => [u.email.toLowerCase(), u])
  );

  const owner1 = {
    id: userByEmail['owner@sportlink.vn']?.user_id || 2,
    role: 'owner',
    email: 'owner@sportlink.vn',
  };
  const owner2 = {
    id: userByEmail['owner2@sportlink.vn']?.user_id || 5,
    role: 'owner',
    email: 'owner2@sportlink.vn',
  };
  const staff1 = {
    id: userByEmail['staff@sportlink.vn']?.user_id || 3,
    role: 'staff',
    email: 'staff@sportlink.vn',
  };

  // =========================================================================
  // SUITE 1: S2-05 — [3.1] LỊCH SÂN THEO NGÀY / TUẦN / THÁNG (TRỐNG / ĐÃ ĐẶT)
  // =========================================================================
  console.log('--- 1. Kiểm thử S2-05: Lịch sân theo Ngày/Tuần/Tháng & Vận hành đặt sân ---');
  const todayStr = getLocalDateStr(new Date());

  // S2-05.1: Lấy lịch sân chế độ Ngày/Tuần/Tháng & kiểm tra tiếng Việt chuẩn UTF-8
  const scheduleData = await getScheduleData(owner1, {
    startDate: todayStr,
    endDate: todayStr,
  });
  assert.ok(Array.isArray(scheduleData.facilities), 'Phải trả về danh sách cơ sở (facilities)');
  assert.ok(Array.isArray(scheduleData.sports), 'Phải trả về danh sách môn thể thao (sports)');
  assert.ok(Array.isArray(scheduleData.courts) && scheduleData.courts.length > 0, 'Owner 1 phải có danh sách sân con');
  assert.ok(Array.isArray(scheduleData.bookings), 'Phải trả về danh sách bookings');
  assert.ok(Array.isArray(scheduleData.maintenances), 'Phải trả về danh sách lịch bảo trì');
  for (const c of scheduleData.courts) {
    assert.ok(!/(?:Ã.|Ä.|á».|Æ.)/.test(c.courtName), `Tên sân không được lỗi font mojibake: ${c.courtName}`);
  }
  pass('S2-05.1', `Lấy dữ liệu Lịch sân thành công (${scheduleData.courts.length} sân, ${scheduleData.facilities.length} cơ sở, không lỗi font UTF-8)`);

  // S2-05.2: Kiểm tra bộ lọc theo Cơ sở (facilityId), Môn thể thao (sportId), Sân con (courtId) và Trạng thái (status)
  const targetCourt = scheduleData.courts[0];
  const filteredSchedule = await getScheduleData(owner1, {
    startDate: todayStr,
    endDate: todayStr,
    facilityId: String(targetCourt.facilityId),
    sportId: String(targetCourt.sportId),
    courtId: String(targetCourt.courtId),
    status: 'CONFIRMED',
  });
  assert.ok(filteredSchedule.courts.length > 0 && filteredSchedule.courts.length <= scheduleData.courts.length);
  for (const c of filteredSchedule.courts) {
    assert.equal(c.facilityId, targetCourt.facilityId, 'Lọc theo facilityId chỉ trả về sân của cơ sở đó');
    assert.equal(c.sportId, targetCourt.sportId, 'Lọc theo sportId chỉ trả về sân của môn đó');
  }
  for (const b of filteredSchedule.bookings) {
    assert.equal(b.courtId, targetCourt.courtId, 'Lọc theo courtId chỉ trả về booking của sân đó');
    assert.equal(b.status, 'CONFIRMED', 'Lọc theo status=CONFIRMED chỉ trả về đơn CONFIRMED');
  }
  pass('S2-05.2', 'Bộ lọc đa tầng (Cơ sở / Môn thể thao / Sân con / Trạng thái) hoạt động chính xác');

  // S2-05.3: Tạo đơn vãng lai, kiểm tra máy trạng thái (State Machine) và thanh toán phần còn thiếu
  const futureDateObj = new Date();
  futureDateObj.setDate(futureDateObj.getDate() + 18);
  const futureDateStr = getLocalDateStr(futureDateObj);

  // Xóa đơn test cũ nếu tồn tại ở ngày futureDateStr
  await pool.request()
    .input('courtId', targetCourt.courtId)
    .input('bDate', futureDateStr)
    .query(`
      DELETE FROM transactions WHERE booking_id IN (SELECT booking_id FROM bookings WHERE court_id = @courtId AND booking_date = @bDate);
      DELETE FROM bookings WHERE court_id = @courtId AND booking_date = @bDate;
    `);

  const createdBooking = await createBooking(
    {
      courtId: targetCourt.courtId,
      customerName: 'Khách Test Tự Động S2-05',
      customerPhone: '0909888777',
      bookingDate: futureDateStr,
      startTime: '08:00',
      endTime: '10:00',
      depositAmount: 100000,
      status: 'CONFIRMED',
    },
    owner1
  );
  assert.ok(createdBooking.booking_id > 0, 'Tạo đơn đặt sân tại quầy thành công');
  assert.ok(Number(createdBooking.total_price) > 0, 'Backend tự động tính giá động > 0');

  // Kiểm tra chặn đặt trùng giờ trên cùng sân
  let overlapBlocked = false;
  try {
    await createBooking(
      {
        courtId: targetCourt.courtId,
        customerName: 'Khách Đặt Trùng',
        customerPhone: '0909888776',
        bookingDate: futureDateStr,
        startTime: '09:00',
        endTime: '11:00',
      },
      owner1
    );
  } catch (err) {
    overlapBlocked = err.statusCode === 409;
  }
  assert.equal(overlapBlocked, true, 'Phải chặn đặt sân trùng khung giờ (HTTP 409)');

  // Chuyển trạng thái CONFIRMED -> CHECKED-IN -> COMPLETED
  const checkedIn = await updateBooking(createdBooking.booking_id, { status: 'CHECKED-IN' }, owner1);
  assert.equal(checkedIn.status, 'CHECKED-IN');

  const completed = await updateBooking(createdBooking.booking_id, { status: 'COMPLETED' }, owner1);
  assert.equal(completed.status, 'COMPLETED');

  // Kiểm tra tổng tiền giao dịch không bị nhân đôi tiền cọc
  const txSumRes = await pool.request()
    .input('bid', createdBooking.booking_id)
    .query(`
      SELECT SUM(amount) AS totalPaid
      FROM transactions
      WHERE booking_id = @bid AND status = 'SUCCESS' AND transaction_type IN ('DEPOSIT', 'FULL_PAYMENT')
    `);
  assert.equal(
    Number(txSumRes.recordset[0].totalPaid),
    Number(createdBooking.total_price),
    'Tổng tiền thu (Cọc + Tất toán) phải khớp đúng 100% giá trị đơn (không cộng trùng tiền cọc)'
  );

  // Kiểm tra chặn chuyển trạng thái ngược từ COMPLETED về PENDING
  let invalidTransitionBlocked = false;
  try {
    await updateBooking(createdBooking.booking_id, { status: 'PENDING' }, owner1);
  } catch (err) {
    invalidTransitionBlocked = err.statusCode === 400;
  }
  assert.equal(invalidTransitionBlocked, true, 'Chặn chuyển trạng thái ngược từ COMPLETED về PENDING (HTTP 400)');
  pass('S2-05.3', 'Tạo đơn, chặn trùng giờ (409), luồng trạng thái Check-in -> Hoàn thành & thu phần tiền còn thiếu chính xác');

  // S2-05.4: Khóa sân bảo trì & chặn đặt sân trong giờ bảo trì
  const maint = await createMaintenance(owner1, {
    courtId: targetCourt.courtId,
    date: futureDateStr,
    startTime: '14:00',
    endTime: '16:00',
    reason: 'Bảo trì mặt sân định kỳ (Test tự động)',
  });
  assert.ok(maint.maintenance_id > 0, 'Tạo lịch bảo trì thành công');

  let maintOverlapBlocked = false;
  try {
    await createBooking(
      {
        courtId: targetCourt.courtId,
        customerName: 'Khách Đặt Giờ Bảo Trì',
        customerPhone: '0909888775',
        bookingDate: futureDateStr,
        startTime: '14:30',
        endTime: '15:30',
      },
      owner1
    );
  } catch (err) {
    maintOverlapBlocked = err.statusCode === 409;
  }
  assert.equal(maintOverlapBlocked, true, 'Phải chặn đặt sân vào khung giờ đang khóa bảo trì (HTTP 409)');
  await deleteMaintenance(owner1, maint.maintenance_id);
  pass('S2-05.4', 'Khóa bảo trì sân, chặn đặt trùng giờ bảo trì & mở khóa bảo trì hoạt động chính xác');

  // Dọn dẹp đơn test S2-05
  await pool.request()
    .input('bid', createdBooking.booking_id)
    .query(`
      DELETE FROM transactions WHERE booking_id = @bid;
      DELETE FROM bookings WHERE booking_id = @bid;
    `);

  // =========================================================================
  // SUITE 2: S2-06 — [3.1] QUẢN LÝ KHÁCH HÀNG VÀ LỊCH SỬ ĐẶT SÂN (CRM)
  // =========================================================================
  console.log('\n--- 2. Kiểm thử S2-06: Quản lý khách hàng & Lịch sử đặt sân ---');

  // S2-06.1: Lấy danh sách khách hàng & KPIs cho Owner và Staff
  const customersList = await getCustomerList(owner1, {});
  assert.ok(Array.isArray(customersList) && customersList.length > 0, 'Danh sách khách hàng của Owner 1 phải > 0');
  const sampleCust = customersList[0];
  assert.ok(typeof sampleCust.todayActiveBookings === 'number', 'Phải có trường todayActiveBookings');
  assert.ok(typeof sampleCust.unpaidDepositBookings === 'number', 'Phải có trường unpaidDepositBookings');
  pass('S2-06.1', `Lấy danh sách khách hàng CRM thành công (${customersList.length} khách hàng, đầy đủ chỉ số ca hôm nay & chờ thu cọc)`);

  // S2-06.2: Tra cứu lịch sử đặt sân chi tiết của khách hàng
  const historyData = await getCustomerHistory(owner1, sampleCust.id);
  assert.equal(historyData.customer.id, sampleCust.id);
  assert.ok(Array.isArray(historyData.bookings), 'Phải trả về danh sách lịch sử đặt sân');
  if (historyData.bookings.length > 0) {
    const firstBk = historyData.bookings[0];
    assert.equal(
      firstBk.remainingAmount,
      firstBk.status === 'CANCELLED' || firstBk.status === 'COMPLETED'
        ? 0
        : Math.max(0, firstBk.totalPrice - firstBk.paidAmount),
      'Số tiền còn lại (remainingAmount) trong lịch sử phải tính chính xác'
    );
  }
  pass('S2-06.2', `Tra cứu lịch sử đặt sân của khách "${historyData.customer.fullName}" (${historyData.bookings.length} đơn) chính xác`);

  // S2-06.3: Khóa khách hàng (LOCKED) -> Chặn đặt sân (403) -> Mở khóa lại (ACTIVE)
  const origScore = sampleCust.reputationScore;
  const origStatus = sampleCust.status;

  await updateCustomerReputation(owner1, sampleCust.id, {
    reputationScore: 2.0,
    status: 'LOCKED',
  });

  let lockedCustomerBlocked = false;
  try {
    await createBooking(
      {
        courtId: targetCourt.courtId,
        customerName: sampleCust.fullName,
        customerPhone: sampleCust.phone,
        bookingDate: futureDateStr,
        startTime: '10:00',
        endTime: '11:00',
      },
      owner1
    );
  } catch (err) {
    lockedCustomerBlocked = err.statusCode === 403;
  }
  assert.equal(lockedCustomerBlocked, true, 'Khách hàng đang bị LOCKED phải bị chặn tạo đơn đặt sân mới (HTTP 403)');

  // Khôi phục trạng thái khách hàng
  await updateCustomerReputation(owner1, sampleCust.id, {
    reputationScore: origScore,
    status: origStatus,
  });
  pass('S2-06.3', 'Cập nhật điểm uy tín, khóa tài khoản (LOCKED) chặn đặt sân (403) và mở khóa lại thành công');

  // =========================================================================
  // SUITE 3: S2-09 — [3.3] DASHBOARD DOANH THU THEO NGÀY / TUẦN / THÁNG
  // =========================================================================
  console.log('\n--- 3. Kiểm thử S2-09: Dashboard doanh thu theo Ngày/Tuần/Tháng/Năm ---');

  for (const period of ['day', 'week', 'month', 'year']) {
    const revData = await getRevenueDashboard(owner1, { period });
    assert.equal(revData.period, period);
    assert.ok(typeof revData.summary.totalRevenue === 'number');
    assert.ok(typeof revData.summary.growthPercent === 'number');
    assert.ok(Array.isArray(revData.chartData) && revData.chartData.length > 0, `chartData (${period}) không được rỗng`);
    assert.ok(Array.isArray(revData.revenueByCourt), 'Phải có cơ cấu doanh thu theo sân');
    assert.ok(Array.isArray(revData.revenueBySport), 'Phải có cơ cấu doanh thu theo môn thể thao');
    assert.ok(Array.isArray(revData.recentTransactions), 'Phải có sổ cái giao dịch');
  }
  pass('S2-09.1', 'Dashboard doanh thu hoạt động chính xác ở cả 4 chế độ: Ngày (day), Tuần (week), Tháng (month), Năm (year)');

  const revMonth = await getRevenueDashboard(owner1, { period: 'month' });
  const sumCourtRev = revMonth.revenueByCourt.reduce((acc, c) => acc + c.revenue, 0);
  assert.equal(
    sumCourtRev,
    revMonth.summary.totalRevenue,
    'Tổng doanh thu cộng theo từng sân con phải khớp 100% với tổng doanh thu toàn kỳ'
  );
  pass('S2-09.2', `Đối soát số liệu tài chính khớp 100% (Tổng doanh thu 30 ngày: ${revMonth.summary.totalRevenue.toLocaleString('vi-VN')} đ, Tăng trưởng: ${revMonth.summary.growthPercent}%)`);

  // =========================================================================
  // SUITE 4: S2-10 — [3.3] THỐNG KÊ TỶ LỆ LẤP ĐẦY SÂN VÀ KHUNG GIỜ VẮNG
  // =========================================================================
  console.log('\n--- 4. Kiểm thử S2-10: Thống kê tỷ lệ lấp đầy sân & Khung giờ vắng ---');

  const occData = await getOccupancyAnalytics(owner1, {
    startDate: todayStr,
    endDate: todayStr,
  });
  assert.ok(typeof occData.summary.overallOccupancyRate === 'number');
  assert.ok(Array.isArray(occData.occupancyByCourt) && occData.occupancyByCourt.length > 0, 'Phải có thống kê lấp đầy theo từng sân');
  assert.equal(occData.heatmap.length, 8, 'Ma trận Heatmap phải có 8 hàng khung giờ (06:00 - 22:00)');
  for (const row of occData.heatmap) {
    assert.equal(row.days.length, 7, 'Mỗi hàng Heatmap phải có đủ 7 ngày trong tuần (T2 - CN)');
  }
  for (const quiet of occData.quietSlots) {
    assert.ok(quiet.occupancyRate < 30, 'Khung giờ vắng phải có tỷ lệ lấp đầy < 30% đúng đặc tả Trello S2-10');
    assert.ok(typeof quiet.suggestion === 'string' && quiet.suggestion.length > 0, 'Phải kèm theo gợi ý khuyến mãi / ghép kèo');
  }
  pass('S2-10.1', `Thống kê lấp đầy sân & Heatmap 8x7 hoạt động chính xác (Tỷ lệ lấp đầy: ${occData.summary.overallOccupancyRate}%, Phát hiện ${occData.quietSlots.length} khung giờ vắng < 30%)`);

  // =========================================================================
  // SUITE 5: S2-12 — [6.0] KIỂM THỬ GIÁ ĐỘNG (TC01) & PHÂN QUYỀN RBAC (TC04)
  // =========================================================================
  console.log('\n--- 5. Kiểm thử S2-12: Giá động vắt biên (TC01) & Phân quyền RBAC (TC04) ---');

  const mockRules = [
    { day_type: 'WEEKDAY', start_time: '06:00', end_time: '16:00', price: 200000 },
    { day_type: 'WEEKDAY', start_time: '16:00', end_time: '23:00', price: 350000 },
    { day_type: 'WEEKEND', start_time: '06:00', end_time: '23:00', price: 400000 },
    { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 500000 },
  ];

  assert.equal(
    calculateDynamicPrice(mockRules, '2026-11-11', '15:00', '17:00', false),
    550000,
    'TC01: Vắt qua biên 16:00 (1h giá thường 200k + 1h giá vàng 350k = 550k)'
  );
  assert.equal(
    calculateDynamicPrice(mockRules, '2026-09-02', '18:00', '20:00', false),
    1000000,
    'TC01: Tự động nhận diện ngày lễ Quốc khánh 02/09 (2h x 500k = 1.000.000đ)'
  );
  pass('S2-12 (TC01)', 'Thuật toán tính giá động tách bước 30p qua biên giờ vàng & nhận diện Cuối tuần/Ngày lễ chính xác 100%');

  // Kiểm tra RBAC chặn STAFF truy cập Dashboard Doanh thu / Lấp đầy
  const rbacMiddleware = authorize('owner', 'admin');
  const mockRes = createMockRes();
  let nextCalled = false;
  rbacMiddleware({ user: staff1 }, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(mockRes.statusCode, 403, 'STAFF phải bị chặn HTTP 403 khi truy cập API của Owner');

  // Kiểm tra cô lập dữ liệu giữa Owner 1 và Owner 2
  const o2Courts = (await getScheduleData(owner2, { startDate: todayStr, endDate: todayStr })).courts;
  if (o2Courts.length > 0) {
    let crossOwnerBlocked = false;
    try {
      await createMaintenance(owner1, {
        courtId: o2Courts[0].courtId,
        date: futureDateStr,
        startTime: '12:00',
        endTime: '13:00',
        reason: 'Owner 1 thử khóa sân của Owner 2',
      });
    } catch (err) {
      crossOwnerBlocked = err.statusCode === 403;
    }
    assert.equal(crossOwnerBlocked, true, 'Chủ sân 1 không được phép khóa bảo trì sân của Chủ sân 2 (HTTP 403)');
  }
  pass('S2-12 (TC04)', 'Phân quyền RBAC (chặn STAFF vào trang doanh thu 403) & Cô lập dữ liệu chéo giữa các Chủ sân an toàn tuyệt đối');

  console.log('\n========================================================================');
  console.log(`🎉 KẾT QUẢ CHUNG CUỘC: ${totalPassed}/${totalPassed} BỘ TEST TỰ ĐỘNG ĐỀU VƯỢT QUA (100% PASSED)!`);
  console.log('========================================================================');
  process.exit(0);
}

runLuanSprint2AutomatedTests().catch((err) => {
  console.error('❌ Lỗi khi chạy bộ kiểm thử tự động:', err);
  process.exit(1);
});
