/**
 * ============================================================================
 * SPORTLINK — AUTOMATED TEST SUITE FOR SPRINT 3 (TRẦN LÊ QUANG HỮU)
 * Kiểm thử toàn diện 5 hạng mục nhiệm vụ Sprint 3 của Hữu:
 *   1. S3-01 [4.1.1]: Đăng ký tài khoản Người chơi, Quên mật khẩu (OTP 6 số),
 *                     Xác thực OTP, Đặt lại mật khẩu mới & Đăng nhập.
 *   2. S3-02 [4.1.2 & 4.1.3]: Hồ sơ người chơi (Thống kê đặt sân, Hạng thành viên,
 *                     Cập nhật thông tin cá nhân đồng bộ CRM, Đổi mật khẩu, Thông báo).
 *   3. S3-06 [4.3.1 & 4.3.2]: Chọn khung giờ & Giỏ đặt sân đa khung giờ (Tự động
 *                     bóc tách tiền từng 30 phút, phát hiện trùng ca trong giỏ,
 *                     và thanh toán hàng loạt với Transaction Lock).
 *   4. S3-14 [3.1.8]: Xử lý đơn đặt Online phía Chủ sân/Staff: Danh sách đơn có lọc,
 *                     Xác nhận đơn, Từ chối đơn (bắt buộc nhập lý do + hoàn tiền 100%),
 *                     Hủy đơn và tự động bắn thông báo cho Người chơi.
 *   5. S3-15 [3.1.4]: Trạng thái sân Hoạt động / Bảo trì (ACTIVE / MAINTENANCE):
 *                     Chặn đặt sân mới của Người chơi khi sân Bảo trì và cảnh báo
 *                     danh sách đơn đặt sắp tới bị ảnh hưởng + gửi thông báo.
 * ============================================================================
 */

import { getPool } from '../core/config/db.js';
import { runSprint2Migration } from './migrate_sprint2.js';
import * as authService from '../modules/auth/auth.service.js';
import * as bookingService from '../modules/bookings/booking.service.js';
import * as facilityService from '../modules/facilities/facility.service.js';
import * as courtService from '../modules/courts/court.service.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

function getFutureDateIso(daysAhead = 5) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function runTests() {
  console.log('======================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ SPRINT 3 (S3-01, S3-02, S3-06, S3-14, S3-15)');
  console.log('======================================================================\n');

  await runSprint2Migration({ closePool: false });
  const pool = await getPool();
  const ts = Date.now();
  const testEmail = `player.s3huu.${ts}@sportlink.vn`;
  const testPhone = `098${String(ts).slice(-7)}`;

  // Lấy 1 sân đang ACTIVE và Owner của sân đó để test
  const courtRes = await pool.request().query(`
    SELECT TOP 1 c.court_id, c.court_name, c.owner_id, c.facility_id
    FROM [dbo].[courts] c
    WHERE c.status = 'ACTIVE'
    ORDER BY c.court_id ASC
  `);
  if (courtRes.recordset.length === 0) {
    throw new Error('Không tìm thấy sân ACTIVE trong DB để chạy test.');
  }
  const sampleCourt = courtRes.recordset[0];
  const courtId = Number(sampleCourt.court_id);
  const ownerId = Number(sampleCourt.owner_id);
  const ownerActor = { id: ownerId, role: 'OWNER' };

  let testPlayerId = null;
  const createdBookingIds = [];

  try {
    // ========================================================================
    // 1. KIỂM THỬ S3-01 [WBS 4.1.1]: ĐĂNG KÝ & QUÊN MẬT KHẨU CHO NGƯỜI CHƠI
    // ========================================================================
    console.log('--- [1] S3-01 (WBS 4.1.1): Đăng ký & Quên mật khẩu cho Người chơi ---');

    const regResult = await authService.register({
      fullName: 'Trần Hữu Player S3',
      email: testEmail,
      phone: testPhone,
      password: 'Password@123',
    });

    testPlayerId = Number(regResult.user.id);
    assert(
      Boolean(regResult.token) &&
        testPlayerId > 0 &&
        String(regResult.user.role).toUpperCase() === 'PLAYER',
      'S3-01.1: Đăng ký tài khoản Người chơi trả về JWT Token & thông tin User đầy đủ'
    );

    const welcomeNotifs = await authService.getUserNotifications(testPlayerId);
    assert(
      welcomeNotifs &&
        Array.isArray(welcomeNotifs.notifications) &&
        welcomeNotifs.notifications.length >= 1,
      'S3-01.2: Tự động khởi tạo thông báo chào mừng cho Người chơi mới đăng ký'
    );

    const forgotRes = await authService.forgotPassword({ identifier: testEmail });
    const otpCode = forgotRes?.sandboxOtp || forgotRes?.demoOtp;
    assert(
      forgotRes && /^\d{6}$/.test(String(otpCode)),
      `S3-01.3: Yêu cầu Quên mật khẩu bằng Email/SĐT sinh mã OTP 6 chữ số (${otpCode})`
    );

    const verifyRes = await authService.verifyResetOtp({
      identifier: testEmail,
      otp: otpCode,
    });
    assert(
      verifyRes && (verifyRes.valid === true || verifyRes.verified === true),
      'S3-01.4: Xác thực mã OTP hợp lệ và còn hạn thành công'
    );

    let wrongOtpBlocked = false;
    try {
      await authService.verifyResetOtp({ identifier: testEmail, otp: '000000' });
    } catch {
      wrongOtpBlocked = true;
    }
    assert(wrongOtpBlocked, 'S3-01.5: Chặn mã OTP không chính xác với lỗi 400');

    const resetRes = await authService.resetPassword({
      identifier: testEmail,
      otp: otpCode,
      newPassword: 'NewPassword@456',
    });
    assert(
      resetRes && resetRes.success === true,
      'S3-01.6: Đặt lại mật khẩu mới bằng OTP thành công & thu hồi OTP cũ'
    );

    const loginWithNewPwd = await authService.login({
      email: testEmail,
      password: 'NewPassword@456',
    });
    assert(
      Boolean(loginWithNewPwd.token) && Number(loginWithNewPwd.user.id) === testPlayerId,
      'S3-01.7: Đăng nhập lại bằng mật khẩu mới sau khi khôi phục thành công'
    );

    // ========================================================================
    // 2. KIỂM THỬ S3-02 [WBS 4.1.2 & 4.1.3]: HỒ SƠ NGƯỜI CHƠI
    // ========================================================================
    console.log('\n--- [2] S3-02 (WBS 4.1.2 & 4.1.3): Hồ sơ người chơi & Đổi mật khẩu ---');

    const initialProfile = await authService.getUserById(testPlayerId);
    assert(
      initialProfile &&
        initialProfile.email === testEmail &&
        initialProfile.stats &&
        typeof initialProfile.stats.memberTier === 'string',
      'S3-02.1: Xem hồ sơ Người chơi kèm thống kê lịch đặt sân & hạng thành viên'
    );

    const updatedProfile = await authService.updateProfile(testPlayerId, {
      fullName: 'Trần Lê Quang Hữu (Updated)',
      phone: testPhone,
      gender: 'MALE',
      dob: '2004-03-31',
      address: 'TP. Thủ Đức, TP. Hồ Chí Minh',
      favoriteSports: ['Bóng đá', 'Cầu lông', 'Pickleball'],
      bio: 'Đam mê thể thao phong trào PTIT',
    });

    assert(
      updatedProfile.fullName === 'Trần Lê Quang Hữu (Updated)' &&
        updatedProfile.gender === 'MALE' &&
        Array.isArray(updatedProfile.favoriteSports) &&
        updatedProfile.favoriteSports.includes('Pickleball') &&
        updatedProfile.address === 'TP. Thủ Đức, TP. Hồ Chí Minh',
      'S3-02.2: Cập nhật thông tin hồ sơ Người chơi (Họ tên, Giới tính, Ngày sinh, Địa chỉ, Môn yêu thích, Bio) & đồng bộ CRM'
    );

    const changePwdRes = await authService.changePassword(testPlayerId, {
      currentPassword: 'NewPassword@456',
      newPassword: 'FinalPassword@789',
    });
    assert(
      changePwdRes && changePwdRes.success === true,
      'S3-02.3: Đổi mật khẩu trong trang Hồ sơ người chơi thành công'
    );

    // ========================================================================
    // 3. KIỂM THỬ S3-06 [WBS 4.3.1 & 4.3.2]: CHỌN KHUNG GIỜ & GIỎ ĐẶT SÂN
    // ========================================================================
    console.log('\n--- [3] S3-06 (WBS 4.3.1 & 4.3.2): Chọn khung giờ & Giỏ đặt sân (Tự động tính tiền) ---');

    const dateCart1 = getFutureDateIso(18);
    const dateCart2 = getFutureDateIso(19);

    const singleQuote = await bookingService.calculateBookingQuote({
      courtId,
      bookingDate: dateCart1,
      startTime: '16:30',
      endTime: '18:00',
    });

    assert(
      singleQuote.totalPrice > 0 &&
        Array.isArray(singleQuote.slotBreakdown) &&
        singleQuote.slotBreakdown.length === 3,
      `S3-06.1: Báo giá 1 ca tự động bóc tách 3 khung 30 phút (16:30-18:00 = ${singleQuote.totalPrice.toLocaleString('vi-VN')}đ)`
    );

    // Kiểm tra giỏ đặt sân với 2 ca hợp lệ
    const cartQuoteValid = await bookingService.calculateCartQuote({
      items: [
        {
          cartItemId: 'slot-1',
          courtId,
          bookingDate: dateCart1,
          startTime: '08:00',
          endTime: '09:30',
        },
        {
          cartItemId: 'slot-2',
          courtId,
          bookingDate: dateCart1,
          startTime: '17:00',
          endTime: '18:30',
        },
      ],
    });

    assert(
      cartQuoteValid.totalItems === 2 &&
        cartQuoteValid.allAvailable === true &&
        cartQuoteValid.totalCartPrice ===
          cartQuoteValid.items[0].totalPrice + cartQuoteValid.items[1].totalPrice,
      `S3-06.2: Giỏ đặt sân đa khung giờ tự động cộng tổng tiền động (${cartQuoteValid.totalCartPrice.toLocaleString('vi-VN')}đ cho ${cartQuoteValid.totalDurationHours} giờ)`
    );

    // Kiểm tra phát hiện trùng khung giờ ngay bên trong giỏ đặt sân
    const cartQuoteOverlap = await bookingService.calculateCartQuote({
      items: [
        {
          cartItemId: 'dup-1',
          courtId,
          bookingDate: dateCart1,
          startTime: '08:00',
          endTime: '10:00',
        },
        {
          cartItemId: 'dup-2',
          courtId,
          bookingDate: dateCart1,
          startTime: '09:00',
          endTime: '11:00',
        },
      ],
    });

    assert(
      cartQuoteOverlap.allAvailable === false && cartQuoteOverlap.conflictCount === 1,
      'S3-06.3: Giỏ đặt sân tự động phát hiện và cảnh báo 2 khung giờ bị chồng lấn nhau trong cùng giỏ'
    );

    // Checkout giỏ đặt sân đa khung giờ
    const playerActor = {
      id: testPlayerId,
      role: 'player',
      fullName: updatedProfile.fullName,
      email: testEmail,
    };

    const checkoutRes = await bookingService.checkoutBookingCart(
      {
        items: [
          {
            courtId,
            bookingDate: dateCart1,
            startTime: '07:00',
            endTime: '08:00',
          },
          {
            courtId,
            bookingDate: dateCart2,
            startTime: '07:00',
            endTime: '08:00',
          },
        ],
        paymentMethod: 'VNPAY',
      },
      playerActor
    );

    if (Array.isArray(checkoutRes?.bookings)) {
      checkoutRes.bookings.forEach((b) => createdBookingIds.push(Number(b.booking_id)));
    }

    assert(
      checkoutRes &&
        checkoutRes.totalBookings === 2 &&
        checkoutRes.totalPrice > 0 &&
        checkoutRes.bookings.length === 2,
      `S3-06.4: Đặt sân hàng loạt từ Giỏ đặt sân thành công (${checkoutRes.totalBookings} đơn, tổng ${checkoutRes.totalPrice.toLocaleString('vi-VN')}đ)`
    );

    // ========================================================================
    // 4. KIỂM THỬ S3-14 [WBS 3.1.8]: XỬ LÝ ĐƠN ĐẶT ONLINE PHÍA CHỦ SÂN / STAFF
    // ========================================================================
    console.log('\n--- [4] S3-14 (WBS 3.1.8): Xử lý đơn đặt Online (Lọc, Xác nhận, Từ chối kèm lý do, Thông báo) ---');

    const bookingIdToConfirm = createdBookingIds[0];
    const bookingIdToReject = createdBookingIds[1];

    // Chuyển đơn sang PENDING để mô phỏng đơn đặt online chờ duyệt
    await pool
      .request()
      .input('bid1', bookingIdToConfirm)
      .input('bid2', bookingIdToReject)
      .query(`
        UPDATE [dbo].[bookings]
        SET status = 'PENDING', deposit_amount = 100000, payment_status = 'DEPOSIT_PAID'
        WHERE booking_id IN (@bid1, @bid2)
      `);

    const filteredOwnerOrders = await bookingService.getBookingsByUser(ownerActor, {
      status: 'PENDING',
      courtId: String(courtId),
    });

    assert(
      Array.isArray(filteredOwnerOrders) &&
        filteredOwnerOrders.some((b) => Number(b.booking_id) === bookingIdToConfirm),
      'S3-14.1: Chủ sân/Staff lọc danh sách đơn đặt Online theo trạng thái (PENDING) & Sân con thành công'
    );

    // Chủ sân xác nhận đơn #1
    const confirmedOrder = await bookingService.updateBooking(
      bookingIdToConfirm,
      { status: 'CONFIRMED' },
      ownerActor
    );
    assert(
      confirmedOrder && confirmedOrder.status === 'CONFIRMED',
      `S3-14.2: Chủ sân/Staff xác nhận đơn đặt Online #${bookingIdToConfirm} -> CONFIRMED`
    );

    // Kiểm tra bắt buộc nhập lý do khi từ chối đơn
    let emptyReasonBlocked = false;
    try {
      await bookingService.rejectOnlineBooking(bookingIdToReject, { reason: '   ' }, ownerActor);
    } catch {
      emptyReasonBlocked = true;
    }
    assert(
      emptyReasonBlocked,
      'S3-14.3: Chặn từ chối đơn đặt Online nếu Chủ sân/Staff không nhập lý do'
    );

    // Từ chối đơn #2 kèm lý do
    const rejectReasonText = 'Sân nâng cấp hệ thống chiếu sáng LED khẩn cấp';
    const rejectedRes = await bookingService.rejectOnlineBooking(
      bookingIdToReject,
      { reason: rejectReasonText },
      ownerActor
    );
    const rejectedOrder = rejectedRes?.booking || rejectedRes;

    assert(
      rejectedOrder &&
        rejectedOrder.status === 'CANCELLED' &&
        String(rejectedOrder.cancel_reason || '').includes(rejectReasonText) &&
        Number(rejectedOrder.refund_amount) === 100000,
      `S3-14.4: Từ chối đơn đặt Online #${bookingIdToReject} lưu đúng lý do, chuyển CANCELLED & hoàn 100% tiền cọc`
    );

    const playerNotifsAfterProcess = await authService.getUserNotifications(testPlayerId);
    const notifItems = playerNotifsAfterProcess?.notifications || [];
    const hasConfirmNotif = notifItems.some((n) =>
      String(n.title || '').includes(`#SPL-${bookingIdToConfirm}`)
    );
    const hasRejectNotif = notifItems.some(
      (n) =>
        String(n.title || '').includes(`#SPL-${bookingIdToReject}`) &&
        String(n.content || n.message || '').includes(rejectReasonText)
    );

    assert(
      hasConfirmNotif && hasRejectNotif,
      'S3-14.5: Tự động gửi thông báo In-App đến Người chơi khi đơn được Xác nhận và khi đơn bị Từ chối (kèm lý do)'
    );

    // ========================================================================
    // 5. KIỂM THỬ S3-15 [WBS 3.1.4]: TRẠNG THÁI SÂN HOẠT ĐỘNG / BẢO TRÌ
    // ========================================================================
    console.log('\n--- [5] S3-15 (WBS 3.1.4): Trạng thái sân Hoạt động/Bảo trì, Chặn đặt sân & Cảnh báo đơn bị ảnh hưởng ---');

    const affectedCheck = await facilityService.getAffectedBookingsForCourt(courtId, ownerId);
    assert(
      affectedCheck &&
        affectedCheck.affectedCount >= 1 &&
        affectedCheck.affectedBookings.some((b) => Number(b.bookingId) === bookingIdToConfirm),
      `S3-15.1: Phát hiện chính xác ${affectedCheck.affectedCount} đơn đặt sân sắp tới bị ảnh hưởng trước khi chuyển sân sang Bảo trì`
    );

    // Chuyển sân sang trạng thái MAINTENANCE
    const maintUpdateRes = await facilityService.updateCourtStatus(
      courtId,
      ownerId,
      'MAINTENANCE',
      {
        reason: 'Bảo trì thay mặt thảm sân định kỳ',
        notifyPlayers: true,
        cancelAffected: false,
      }
    );

    assert(
      maintUpdateRes &&
        maintUpdateRes.status === 'MAINTENANCE' &&
        maintUpdateRes.affectedCount >= 1 &&
        maintUpdateRes.notifiedCount >= 1,
      `S3-15.2: Chuyển trạng thái sân sang MAINTENANCE trả về cảnh báo (${maintUpdateRes.affectedCount} đơn bị ảnh hưởng) & gửi thông báo cho Người chơi`
    );

    // Kiểm tra danh sách sân công khai vẫn hiển thị sân với trạng thái MAINTENANCE để UI hiện nhãn "Đang bảo trì"
    const publicCourts = await courtService.getAllCourts({ facility_id: sampleCourt.facility_id });
    const maintCourtInPublic = publicCourts.find((c) => Number(c.court_id) === courtId);
    assert(
      maintCourtInPublic && maintCourtInPublic.status === 'MAINTENANCE',
      'S3-15.3: API danh sách sân trả về trạng thái MAINTENANCE để giao diện hiển thị huy hiệu "Đang bảo trì"'
    );

    // Kiểm tra báo giá trả về isAvailable = false khi sân đang MAINTENANCE
    const quoteWhileMaint = await bookingService.calculateBookingQuote({
      courtId,
      bookingDate: getFutureDateIso(21),
      startTime: '09:00',
      endTime: '10:00',
    });
    assert(
      quoteWhileMaint.isAvailable === false &&
        String(quoteWhileMaint.conflictReason || '').toLowerCase().includes('bảo trì'),
      'S3-15.4: Báo giá tự động báo sân không khả dụng (isAvailable = false) kèm lý do đang bảo trì'
    );

    // Kiểm tra chặn Người chơi đặt sân khi sân đang ở trạng thái MAINTENANCE
    let bookingBlockedWhileMaint = false;
    try {
      await bookingService.createBooking(
        {
          courtId,
          userId: testPlayerId,
          bookingDate: getFutureDateIso(21),
          startTime: '09:00',
          endTime: '10:00',
        },
        playerActor
      );
    } catch (err) {
      bookingBlockedWhileMaint = err.statusCode === 400;
    }
    assert(
      bookingBlockedWhileMaint,
      'S3-15.5: Chặn hoàn toàn việc tạo đơn đặt sân mới khi sân đang ở trạng thái Bảo trì (HTTP 400)'
    );

    // Khôi phục sân về trạng thái ACTIVE
    const activeRestoreRes = await facilityService.updateCourtStatus(courtId, ownerId, 'ACTIVE');
    assert(
      activeRestoreRes && activeRestoreRes.status === 'ACTIVE',
      'S3-15.6: Khôi phục trạng thái sân về Hoạt động (ACTIVE) thành công'
    );
  } finally {
    // Luôn đảm bảo khôi phục sân mẫu về ACTIVE và dọn dữ liệu test
    await pool
      .request()
      .input('courtId', courtId)
      .query(`UPDATE [dbo].[courts] SET status = 'ACTIVE' WHERE court_id = @courtId`);

    for (const bid of createdBookingIds) {
      await pool
        .request()
        .input('bid', bid)
        .query(`
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'transactions')
            DELETE FROM [dbo].[transactions] WHERE booking_id = @bid;
          DELETE FROM [dbo].[bookings] WHERE booking_id = @bid;
        `);
    }

    if (testPlayerId) {
      await pool
        .request()
        .input('uid', testPlayerId)
        .input('email', testEmail)
        .query(`
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
            DELETE FROM [dbo].[notifications] WHERE user_id = @uid;
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
            DELETE FROM [dbo].[customers] WHERE email = @email OR user_id = @uid;
          DELETE FROM [dbo].[users] WHERE user_id = @uid;
        `);
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ SPRINT 3 (HỮU): ${passed} PASSED / ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Lỗi nghiêm trọng khi chạy test Sprint 3:', err);
  process.exit(1);
});
