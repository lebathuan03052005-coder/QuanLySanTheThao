import express from 'express';
import jwt from 'jsonwebtoken';
import sql, { getPool } from '../core/config/db.js';
import { getJwtSecret } from '../core/utils/crypto.js';
import { errorHandler } from '../core/middlewares/errorHandler.js';
import notificationRouter from '../modules/notifications/notification.route.js';
import * as notificationService from '../modules/notifications/notification.service.js';
import * as bookingService from '../modules/bookings/booking.service.js';
import * as matchService from '../modules/matches/match.service.js';
import { runSprint2Migration } from './migrate_sprint2.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('KIỂM THỬ HỆ THỐNG THÔNG BÁO (SERVICE + TRIGGERS + HTTP API)');
  console.log('====================================================');

  await runSprint2Migration();
  const pool = await getPool();

  // Tạo dữ liệu test độc lập để không ảnh hưởng dữ liệu thật
  const suffix = Date.now();
  const createdUserIds = [];
  let testFacilityId = null;
  let testCourtId = null;
  let testSportId = null;
  let testBookingId = null;
  let testMatchId = null;

  // Khởi tạo Express server test trên ephemeral port
  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/notifications', notificationRouter);
  testApp.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = testApp.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/notifications`;

  try {
    // 1. Tạo Owner, Staff, Player 1, Player 2 dùng cho test
    const insertUser = async (name, email, role, ownerId = null) => {
      const r = await pool
        .request()
        .input('fullName', sql.NVarChar(100), name)
        .input('email', sql.VarChar(100), email)
        .input('phone', sql.VarChar(20), `09${String(Math.floor(10000000 + Math.random() * 89999999))}`)
        .input('role', sql.VarChar(20), role)
        .input('ownerId', sql.Int, ownerId)
        .query(`
          INSERT INTO users (full_name, phone, email, password_hash, role, status, owner_id, created_at)
          OUTPUT INSERTED.user_id, INSERTED.role, INSERTED.email, INSERTED.full_name
          VALUES (@fullName, @phone, @email, 'test_hash', @role, 'ACTIVE', @ownerId, GETDATE())
        `);
      createdUserIds.push(r.recordset[0].user_id);
      return r.recordset[0];
    };

    const owner = await insertUser('Test Owner Notif', `owner_notif_${suffix}@test.vn`, 'OWNER');
    const staff = await insertUser('Test Staff Notif', `staff_notif_${suffix}@test.vn`, 'STAFF', owner.user_id);
    const player1 = await insertUser('Test Player 1', `player1_notif_${suffix}@test.vn`, 'PLAYER');
    const player2 = await insertUser('Test Player 2', `player2_notif_${suffix}@test.vn`, 'PLAYER');

    // Lấy 1 sport ACTIVE
    const sportRes = await pool
      .request()
      .query("SELECT TOP 1 sport_id FROM sports WHERE UPPER(status) = 'ACTIVE' ORDER BY sport_id ASC");
    if (sportRes.recordset.length > 0) {
      testSportId = sportRes.recordset[0].sport_id;
    } else {
      const newSport = await pool
        .request()
        .query("INSERT INTO sports (sport_name, status) OUTPUT INSERTED.sport_id VALUES (N'Bóng đá Test', 'ACTIVE')");
      testSportId = newSport.recordset[0].sport_id;
    }

    // Tạo facility & court thuộc Owner + gán Staff cho court
    const facRes = await pool
      .request()
      .input('ownerId', sql.Int, owner.user_id)
      .query(`
        INSERT INTO facilities (owner_id, name, address, status)
        OUTPUT INSERTED.facility_id
        VALUES (@ownerId, N'Cụm Sân Test Notif', N'123 Test Street', 'ACTIVE')
      `);
    testFacilityId = facRes.recordset[0].facility_id;

    const courtRes = await pool
      .request()
      .input('ownerId', sql.Int, owner.user_id)
      .input('sportId', sql.Int, testSportId)
      .input('facilityId', sql.Int, testFacilityId)
      .query(`
        INSERT INTO courts (owner_id, sport_id, facility_id, court_name, status)
        OUTPUT INSERTED.court_id
        VALUES (@ownerId, @sportId, @facilityId, N'Sân Test Thông Báo A1', 'ACTIVE')
      `);
    testCourtId = courtRes.recordset[0].court_id;

    await pool
      .request()
      .input('staffId', sql.Int, staff.user_id)
      .input('courtId', sql.Int, testCourtId)
      .input('assignedBy', sql.Int, owner.user_id)
      .query(`
        INSERT INTO court_staff (staff_id, court_id, assigned_by)
        VALUES (@staffId, @courtId, @assignedBy)
      `);

    // ------------------------------------------------------------------
    // TEST GROUP 1: Schema & Notification Service CRUD
    // ------------------------------------------------------------------
    const colCheck = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'notifications' AND COLUMN_NAME IN ('type', 'link')
    `);
    assert(colCheck.recordset.length === 2, 'TC-N01: Bảng notifications có đủ cột type và link');

    const n1 = await notificationService.createNotificationSafe(pool, {
      userId: player1.user_id,
      title: 'Thông báo test 1',
      content: 'Nội dung test 1',
      type: 'BOOKING',
      link: '/bookings',
    });
    const n2 = await notificationService.createNotificationSafe(pool, {
      userId: player1.user_id,
      title: 'Thông báo test 2',
      content: 'Nội dung test 2',
      type: 'PAYMENT',
      link: '/bookings',
    });
    assert(n1 && n1.type === 'BOOKING' && n1.link === '/bookings', 'TC-N02: Tạo thông báo với type & link thành công');

    const listRes = await notificationService.getUserNotifications(player1.user_id, { page: 1, limit: 10 });
    assert(
      listRes.items.length === 2 && listRes.unreadCount === 2 && typeof listRes.items[0].seconds_ago === 'number',
      'TC-N03: Lấy danh sách & unreadCount + seconds_ago chính xác'
    );

    const unreadFiltered = await notificationService.getUserNotifications(player1.user_id, { type: 'PAYMENT' });
    assert(
      unreadFiltered.items.length === 1 && unreadFiltered.items[0].notification_id === n2.notification_id,
      'TC-N04: Lọc thông báo theo type hoạt động chính xác'
    );

    // Kiểm tra bảo mật cross-user
    let crossMarkBlocked = false;
    try {
      await notificationService.markAsRead(n1.notification_id, player2.user_id);
    } catch (err) {
      crossMarkBlocked = err.statusCode === 404;
    }
    assert(crossMarkBlocked, 'TC-N05: Ngăn chặn user khác đánh dấu đã đọc thông báo của người khác (404)');

    await notificationService.markAsRead(n1.notification_id, player1.user_id);
    const countAfterOne = await notificationService.getUnreadCount(player1.user_id);
    assert(countAfterOne === 1, 'TC-N06: Đánh dấu 1 thông báo đã đọc giảm unreadCount còn 1');

    // ------------------------------------------------------------------
    // TEST GROUP 2: HTTP API Routes (JWT Auth + Endpoints)
    // ------------------------------------------------------------------
    const unauthRes = await fetch(baseUrl);
    assert(unauthRes.status === 401, 'TC-N07: API GET /api/notifications từ chối request chưa đăng nhập (401)');

    const jwtSecret = getJwtSecret();
    const player1Token = jwt.sign(
      { id: player1.user_id, role: 'PLAYER', email: player1.email },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const apiListRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${player1Token}` },
    });
    const apiListJson = await apiListRes.json();
    assert(
      apiListRes.status === 200 && apiListJson.success && apiListJson.data.items.length === 2,
      'TC-N08: HTTP GET /api/notifications trả về đúng danh sách'
    );

    const apiCountRes = await fetch(`${baseUrl}/unread-count`, {
      headers: { Authorization: `Bearer ${player1Token}` },
    });
    const apiCountJson = await apiCountRes.json();
    assert(
      apiCountRes.status === 200 && apiCountJson.data.unreadCount === 1,
      'TC-N09: HTTP GET /api/notifications/unread-count trả về 1'
    );

    const apiReadAllRes = await fetch(`${baseUrl}/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${player1Token}` },
    });
    const apiReadAllJson = await apiReadAllRes.json();
    assert(
      apiReadAllRes.status === 200 && apiReadAllJson.data.updatedCount === 1,
      'TC-N10: HTTP PATCH /api/notifications/read-all đánh dấu hết chưa đọc'
    );

    const apiDelRes = await fetch(`${baseUrl}/${n1.notification_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${player1Token}` },
    });
    assert(apiDelRes.status === 200, 'TC-N11: HTTP DELETE /api/notifications/:id xóa thông báo thành công');

    // ------------------------------------------------------------------
    // TEST GROUP 3: Trigger Đặt sân -> Thông báo Player + Owner + Staff
    // ------------------------------------------------------------------
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const createdBooking = await bookingService.createBooking(
      {
        courtId: testCourtId,
        bookingDate: tomorrow,
        startTime: '18:00',
        endTime: '19:00',
      },
      { id: player1.user_id, role: 'PLAYER' }
    );
    testBookingId = createdBooking.booking_id;

    const p1NotifsAfterBook = await notificationService.getUserNotifications(player1.user_id);
    const ownerNotifsAfterBook = await notificationService.getUserNotifications(owner.user_id);
    const staffNotifsAfterBook = await notificationService.getUserNotifications(staff.user_id);

    assert(
      p1NotifsAfterBook.items.some((n) => n.type === 'BOOKING' && n.title.includes(`#SPL-${testBookingId}`)),
      'TC-N12: Đặt sân tạo thông báo BOOKING cho Player'
    );
    // Link deep-link tới đúng đơn trên lịch sân của Owner/Staff (frontend tự đổi /owner -> /staff theo vai trò)
    const expectedMgmtLink = `/owner/bookings?bookingId=${testBookingId}&date=${tomorrow}`;
    assert(
      ownerNotifsAfterBook.items.some((n) => n.type === 'BOOKING' && n.link === expectedMgmtLink),
      'TC-N13: Đặt sân tạo thông báo BOOKING cho Owner'
    );
    assert(
      staffNotifsAfterBook.items.some((n) => n.type === 'BOOKING' && n.link === expectedMgmtLink),
      'TC-N14: Đặt sân tạo thông báo BOOKING cho Staff được phân công sân'
    );

    // Owner xác nhận đơn -> Player nhận thông báo xác nhận
    await bookingService.updateBooking(
      testBookingId,
      { status: 'CONFIRMED' },
      { id: owner.user_id, role: 'OWNER' }
    );
    const p1NotifsAfterConfirm = await notificationService.getUserNotifications(player1.user_id);
    assert(
      p1NotifsAfterConfirm.items.some((n) => n.title.includes('đã được xác nhận')),
      'TC-N15: Cập nhật trạng thái CONFIRMED tạo thông báo cho Player'
    );

    // Player hủy đơn -> Player & Owner/Staff đều nhận thông báo
    await bookingService.cancelBookingWithRefund(
      testBookingId,
      { cancelReason: 'Test hủy' },
      { id: player1.user_id, role: 'PLAYER' }
    );
    const p1NotifsAfterCancel = await notificationService.getUserNotifications(player1.user_id);
    const ownerNotifsAfterCancel = await notificationService.getUserNotifications(owner.user_id);
    assert(
      p1NotifsAfterCancel.items.some((n) => n.title.includes('Đã hủy đơn')) &&
        ownerNotifsAfterCancel.items.some((n) => n.title.includes('đã bị hủy')),
      'TC-N16: Hủy đơn tạo thông báo cho cả Player lẫn Owner/Staff'
    );

    // ------------------------------------------------------------------
    // TEST GROUP 4: Trigger Cáp kèo (Matches) -> Tạo, Tham gia, Đủ người, Hủy
    // ------------------------------------------------------------------
    const matchStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const createdMatch = await matchService.createMatch({
      hostId: player1.user_id,
      courtId: testCourtId,
      sportId: testSportId,
      startTime: matchStart,
      maxPlayers: 2,
    });
    testMatchId = createdMatch.id;

    const p1NotifsAfterMatch = await notificationService.getUserNotifications(player1.user_id);
    assert(
      p1NotifsAfterMatch.items.some((n) => n.type === 'MATCH' && n.title.includes(`#M-${testMatchId}`)),
      'TC-N17: Tạo kèo mới tạo thông báo MATCH cho chủ kèo'
    );

    await matchService.joinMatch(testMatchId, player2.user_id);
    const p1AfterJoin = await notificationService.getUserNotifications(player1.user_id);
    const p2AfterJoin = await notificationService.getUserNotifications(player2.user_id);

    assert(
      p1AfterJoin.items.some((n) => n.title.includes('Có người tham gia kèo')) &&
        p1AfterJoin.items.some((n) => n.title.includes('đã đủ quân')),
      'TC-N18: Khi có người vào kèo & đủ quân -> Host nhận thông báo tham gia & đủ quân'
    );
    assert(
      p2AfterJoin.items.some((n) => n.title.includes('Tham gia kèo')) &&
        p2AfterJoin.items.some((n) => n.title.includes('đã đủ quân')),
      'TC-N19: Người tham gia nhận thông báo tham gia thành công & đủ quân'
    );

    await matchService.cancelMatch(testMatchId, player1.user_id);
    const p2AfterMatchCancel = await notificationService.getUserNotifications(player2.user_id);
    assert(
      p2AfterMatchCancel.items.some((n) => n.title.includes('đã bị hủy')),
      'TC-N20: Hủy kèo gửi thông báo tới thành viên đã tham gia'
    );
  } catch (err) {
    console.error('❌ Lỗi nghiêm trọng trong quá trình test:', err);
    failed++;
  } finally {
    // Cleanup toàn bộ dữ liệu test
    try {
      if (testMatchId) {
        await pool.request().input('mid', sql.Int, testMatchId).query('DELETE FROM match_participants WHERE match_id = @mid');
        await pool.request().input('mid', sql.Int, testMatchId).query('DELETE FROM matches WHERE match_id = @mid');
      }
      if (testBookingId) {
        await pool.request().input('bid', sql.Int, testBookingId).query('DELETE FROM transactions WHERE booking_id = @bid');
        await pool.request().input('bid', sql.Int, testBookingId).query('DELETE FROM bookings WHERE booking_id = @bid');
      }
      if (testCourtId) {
        await pool.request().input('cid', sql.Int, testCourtId).query('DELETE FROM court_staff WHERE court_id = @cid');
        await pool.request().input('cid', sql.Int, testCourtId).query('DELETE FROM courts WHERE court_id = @cid');
      }
      if (testFacilityId) {
        await pool.request().input('fid', sql.Int, testFacilityId).query('DELETE FROM facilities WHERE facility_id = @fid');
      }
      for (const uid of createdUserIds) {
        await pool.request().input('uid', sql.Int, uid).query('DELETE FROM notifications WHERE user_id = @uid');
        await pool.request().input('uid', sql.Int, uid).query('DELETE FROM users WHERE user_id = @uid');
      }
    } catch (cleanupErr) {
      console.error('Lỗi cleanup:', cleanupErr.message);
    }

    server.close();
    console.log('====================================================');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS / ${failed} FAIL`);
    console.log('====================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
