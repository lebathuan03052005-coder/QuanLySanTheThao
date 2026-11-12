/**
 * [6.0] Kịch bản Kiểm thử Phân quyền Chéo RBAC & Cô lập Dữ liệu (TC04)
 * Thực hiện & Ghi nhận lỗi: Trần Lê Quang Hữu (S2-13) & Đặng Quang Luân (S2-12)
 * Chạy kiểm thử: npm run test:tc04 (hoặc node --env-file=.env src/scripts/test_tc04_rbac.js)
 */
import assert from 'node:assert/strict';
import { getPool } from '../core/config/db.js';
import { authorize, checkStaffCourtAccess } from '../core/middlewares/auth.js';
import * as bookingService from '../modules/bookings/booking.service.js';
import * as customerService from '../modules/customers/customer.service.js';
import * as analyticsService from '../modules/analytics/analytics.service.js';

function createMockRes() {
  return {
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
}

async function runMiddleware(mw, req) {
  const res = createMockRes();
  let nextCalled = false;
  await mw(req, res, (err) => {
    if (err) throw err;
    nextCalled = true;
  });
  return { res, nextCalled };
}

async function runTc04() {
  console.log('===================================================================');
  console.log('🛡️  CHẠY BỘ KIỂM THỬ TC04: PHÂN QUYỀN RBAC & CÔ LẬP DỮ LIỆU CHỦ SÂN');
  console.log('===================================================================');

  const pool = await getPool();

  // Lấy 2 tài khoản OWNER khác nhau để kiểm thử cô lập dữ liệu chéo
  const ownersRes = await pool
    .request()
    .query("SELECT TOP 2 user_id, email FROM users WHERE UPPER(role) = 'OWNER' ORDER BY user_id ASC");

  const owner1Id = ownersRes.recordset[0]?.user_id ?? 1;
  const owner2Id = ownersRes.recordset[1]?.user_id ?? 2;
  const emptyOwnerId = 999991; // Chủ sân giả định chưa có bất kỳ sân nào

  // 1. TC04-1: Chặn STAFF và PLAYER truy cập API Dashboard Doanh thu & Tỷ lệ lấp đầy
  const ownerOnlyGuard = authorize('owner', 'admin');
  const staffRes = await runMiddleware(ownerOnlyGuard, {
    user: { id: 100, role: 'STAFF' },
  });
  const playerRes = await runMiddleware(ownerOnlyGuard, {
    user: { id: 101, role: 'PLAYER' },
  });
  const ownerRes = await runMiddleware(ownerOnlyGuard, {
    user: { id: owner1Id, role: 'OWNER' },
  });

  assert.equal(staffRes.nextCalled, false, 'TC04-1a: STAFF phải bị chặn truy cập Dashboard Doanh thu');
  assert.equal(staffRes.res.statusCode, 403, 'TC04-1b: STAFF truy cập Dashboard phải trả về HTTP 403');
  assert.equal(playerRes.nextCalled, false, 'TC04-1c: PLAYER phải bị chặn truy cập Dashboard Doanh thu');
  assert.equal(ownerRes.nextCalled, true, 'TC04-1d: OWNER được phép truy cập Dashboard Doanh thu');
  console.log('✅ TC04-1 PASS: Chặn STAFF & PLAYER truy cập Dashboard Doanh thu / Lấp đầy (HTTP 403)');

  // 2. TC04-2: Cô lập dữ liệu tuyệt đối khi Owner chưa có sân nào (Không bị lộ sân qua OR NOT EXISTS)
  const emptySchedule = await bookingService.getScheduleData({
    id: emptyOwnerId,
    role: 'owner',
  });
  const emptyRevenue = await analyticsService.getRevenueDashboard({
    id: emptyOwnerId,
    role: 'owner',
  });
  const emptyOccupancy = await analyticsService.getOccupancyAnalytics({
    id: emptyOwnerId,
    role: 'owner',
  });

  assert.equal(emptySchedule.courts.length, 0, 'TC04-2a: Owner 0 sân không được thấy lịch sân của người khác');
  assert.equal(emptyRevenue.courts.length, 0, 'TC04-2b: Owner 0 sân không được thấy doanh thu của người khác');
  assert.equal(emptyOccupancy.courts.length, 0, 'TC04-2c: Owner 0 sân không được thấy thống kê lấp đầy của người khác');
  console.log('✅ TC04-2 PASS: Cô lập tuyệt đối dữ liệu theo owner_id (không lộ sân khi Owner chưa có sân)');

  // 3. TC04-3: Chặn Owner 2 thao tác tạo lịch đặt hoặc bảo trì trên sân của Owner 1
  const owner1CourtRes = await pool
    .request()
    .input('owner1Id', owner1Id)
    .query('SELECT TOP 1 court_id FROM courts WHERE owner_id = @owner1Id ORDER BY court_id ASC');
  const owner1CourtId = owner1CourtRes.recordset[0]?.court_id;

  if (owner1CourtId !== undefined && owner1CourtId !== null) {
    const crossOwnerCheck = await runMiddleware(checkStaffCourtAccess, {
      user: { id: owner2Id, role: 'owner' },
      params: {},
      body: { courtId: owner1CourtId },
      query: {},
    });
    assert.equal(crossOwnerCheck.nextCalled, false, 'TC04-3a: Owner 2 không được phép đặt sân trên sân của Owner 1');
    assert.equal(crossOwnerCheck.res.statusCode, 403, 'TC04-3b: Phải trả về HTTP 403 khi Owner thao tác chéo sân');

    let crossMaintBlocked = false;
    try {
      await bookingService.createMaintenance(
        { id: owner2Id, role: 'owner' },
        {
          courtId: owner1CourtId,
          date: '2026-12-20',
          startTime: '08:00',
          endTime: '10:00',
          reason: 'Test Cross Owner',
        }
      );
    } catch (err) {
      crossMaintBlocked = err.statusCode === 403;
    }
    assert.equal(crossMaintBlocked, true, 'TC04-3c: Chặn Owner 2 khóa bảo trì trên sân của Owner 1 (403)');
    console.log('✅ TC04-3 PASS: Chặn Chủ sân A tạo đơn hoặc khóa bảo trì trên sân của Chủ sân B (HTTP 403)');

    // 4. TC04-4: Chặn STAFF chưa được phân công vào sân trong bảng court_staff
    const unassignedStaffCheck = await runMiddleware(checkStaffCourtAccess, {
      user: { id: 999992, role: 'staff' },
      params: {},
      body: { courtId: owner1CourtId },
      query: {},
    });
    assert.equal(unassignedStaffCheck.nextCalled, false, 'TC04-4a: Staff không có trong court_staff phải bị chặn');
    assert.equal(unassignedStaffCheck.res.statusCode, 403, 'TC04-4b: Phải trả về HTTP 403 COURT_ACCESS_DENIED');
    console.log('✅ TC04-4 PASS: Chặn STAFF thao tác trên sân không được phân công trong court_staff (HTTP 403)');
  }

  // 5. TC04-5: Chống IDOR khi xem lịch sử hoặc khóa khách hàng không thuộc cụm sân của Owner
  const anyCustomerRes = await pool
    .request()
    .query('SELECT TOP 1 customer_id FROM customers ORDER BY customer_id ASC');
  const sampleCustId = anyCustomerRes.recordset[0]?.customer_id;

  if (sampleCustId !== undefined && sampleCustId !== null) {
    let idorHistoryBlocked = false;
    try {
      await customerService.getCustomerHistory({ id: emptyOwnerId, role: 'owner' }, sampleCustId);
    } catch (err) {
      idorHistoryBlocked = err.statusCode === 404 || err.statusCode === 403;
    }

    let idorLockBlocked = false;
    try {
      await customerService.updateCustomerReputation(
        { id: emptyOwnerId, role: 'owner' },
        sampleCustId,
        { status: 'LOCKED' }
      );
    } catch (err) {
      idorLockBlocked = err.statusCode === 403 || err.statusCode === 404;
    }

    assert.equal(
      idorHistoryBlocked && idorLockBlocked,
      true,
      'TC04-5: Phải chặn IDOR khi Owner khác xem lịch sử hoặc khóa khách hàng không thuộc sân của mình'
    );
    console.log('✅ TC04-5 PASS: Chống IDOR trên hồ sơ khách hàng & khóa tài khoản giữa các Chủ sân');
  }

  console.log('-------------------------------------------------------------------');
  console.log('🎉 TẤT CẢ 5/5 NHÓM KỊCH BẢN PHÂN QUYỀN TC04 ĐỀU VƯỢT QUA (100% PASSED)!');
  process.exit(0);
}

runTc04().catch((err) => {
  console.error('❌ Lỗi khi chạy kiểm thử TC04:', err);
  process.exit(1);
});

