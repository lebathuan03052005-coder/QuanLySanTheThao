/**
 * ============================================================================
 * [S3-07, S3-08, S3-09, S3-10, S3-12] BỘ KIỂM THỬ TỰ ĐỘNG SPRINT 3 (TC02)
 * - TC02-1: Concurrency Lock khi 2 người đặt trùng khung giờ cùng 1 giây (HTTP 409)
 * - TC02-2: Burst Concurrency 10 request đồng thời tranh chấp 1 khung giờ vàng
 * - TC02-3: Concurrency khi 2 request giao thoa một phần khung giờ (15:00-17:00 vs 16:00-18:00)
 * - TC02-4: Thanh toán Sandbox (VNPay/MoMo), Chống giả mạo chữ ký HMAC-SHA512 (R07) & Idempotency
 * - TC02-5: Phương án dự phòng thanh toán VietQR Napas 247 (S3-09 - Rủi ro R2)
 * - TC02-6: Hủy đặt sân, Hoàn tiền tự động (REFUND) & Giải phóng lịch sân tức thì (S3-10 - R04)
 * - TC02-7: Kiểm thử hiệu năng phản hồi API < 2000ms (S3-12)
 *
 * Cách chạy:
 *   cd backend
 *   npm run test:tc02
 * ============================================================================
 */
import assert from 'node:assert/strict';
import { getPool } from '../core/config/db.js';
import { runSprint2Migration } from './migrate_sprint2.js';
import * as bookingService from '../modules/bookings/booking.service.js';

function getFutureDateStr(daysAhead = 14) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return bookingService.getLocalDateStr(d);
}

async function runTc02Suite() {
  console.log('=========================================================================');
  console.log('🚀 CHẠY BỘ KIỂM THỬ SPRINT 3 (TC02): TRANSACTION LOCK, SANDBOX, VIETQR & REFUND');
  console.log('=========================================================================');

  await runSprint2Migration();
  const pool = await getPool();

  // Lấy 1 sân đang ACTIVE và 2 tài khoản PLAYER (hoặc tạo tạm nếu chưa có)
  const courtRes = await pool
    .request()
    .query("SELECT TOP 1 court_id, court_name, owner_id FROM courts WHERE status = 'ACTIVE' ORDER BY court_id ASC");

  const testCourt = courtRes.recordset[0];
  assert.ok(testCourt, 'Phải có ít nhất 1 sân ACTIVE trong DB để chạy kiểm thử TC02');
  const courtId = testCourt.court_id;

  const playersRes = await pool
    .request()
    .query("SELECT TOP 2 user_id, full_name, phone, email FROM users WHERE UPPER(role) = 'PLAYER' AND status = 'ACTIVE' ORDER BY user_id ASC");

  const player1 = playersRes.recordset[0] || {
    user_id: 2,
    full_name: 'Người chơi Kiểm thử 1',
    phone: '0911000111',
    email: 'player1_tc02@sportlink.vn',
  };
  const player2 = playersRes.recordset[1] || {
    user_id: player1.user_id,
    full_name: 'Người chơi Kiểm thử 2',
    phone: '0911000222',
    email: 'player2_tc02@sportlink.vn',
  };

  const testDate = getFutureDateStr(25);
  const createdBookingIds = [];

  try {
    // Dọn sạch dữ liệu cũ trên ngày testDate của sân này trước khi chạy
    await pool
      .request()
      .input('courtId', courtId)
      .input('testDate', testDate)
      .query(`
        DELETE FROM transactions WHERE booking_id IN (
          SELECT booking_id FROM bookings WHERE court_id = @courtId AND booking_date = @testDate
        );
        DELETE FROM bookings WHERE court_id = @courtId AND booking_date = @testDate;
      `);

    // -------------------------------------------------------------------------
    // TC02-1: 2 Request đồng thời cùng 1 mili-giây đặt trùng 100% khung giờ (18:00 - 19:30)
    // -------------------------------------------------------------------------
    const t0 = performance.now();
    const settled2 = await Promise.allSettled([
      bookingService.createBooking(
        {
          courtId,
          bookingDate: testDate,
          startTime: '18:00',
          endTime: '19:30',
          customerName: 'Khách Đồng Thời A',
          customerPhone: '0988111001',
        },
        { id: player1.user_id, role: 'player' }
      ),
      bookingService.createBooking(
        {
          courtId,
          bookingDate: testDate,
          startTime: '18:00',
          endTime: '19:30',
          customerName: 'Khách Đồng Thời B',
          customerPhone: '0988111002',
        },
        { id: player2.user_id, role: 'player' }
      ),
    ]);
    const elapsedTc02_1 = Math.round(performance.now() - t0);

    const fulfilled2 = settled2.filter((r) => r.status === 'fulfilled');
    const rejected2 = settled2.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled2.length, 1, 'TC02-1a: Chỉ đúng 1 request được phép tạo đơn thành công (201)');
    assert.equal(rejected2.length, 1, 'TC02-1b: Request đồng thời còn lại phải bị từ chối');
    assert.equal(
      rejected2[0].reason?.statusCode,
      409,
      'TC02-1c: Request bị từ chối phải nhận đúng mã lỗi HTTP 409 Conflict'
    );

    const winnerBooking1 = fulfilled2[0].value;
    createdBookingIds.push(winnerBooking1.booking_id);
    console.log(
      `✅ TC02-1 PASS (${elapsedTc02_1}ms): 2 Request đồng thời đặt 18:00-19:30 -> 1 Thành công (#${winnerBooking1.booking_id}), 1 Bị chặn (HTTP 409 Conflict)`
    );

    // -------------------------------------------------------------------------
    // TC02-2: Burst Concurrency 10 Request đồng thời tranh chấp khung giờ vàng (19:30 - 21:00)
    // -------------------------------------------------------------------------
    const burstCount = 10;
    const tBurst = performance.now();
    const burstPromises = Array.from({ length: burstCount }, (_, idx) =>
      bookingService.createBooking(
        {
          courtId,
          bookingDate: testDate,
          startTime: '19:30',
          endTime: '21:00',
          customerName: `Burst Player #${idx + 1}`,
          customerPhone: `09770000${String(idx + 1).padStart(2, '0')}`,
        },
        { id: player1.user_id, role: 'player' }
      )
    );

    const settledBurst = await Promise.allSettled(burstPromises);
    const elapsedBurst = Math.round(performance.now() - tBurst);

    const burstFulfilled = settledBurst.filter((r) => r.status === 'fulfilled');
    const burstRejected409 = settledBurst.filter(
      (r) => r.status === 'rejected' && r.reason?.statusCode === 409
    );

    assert.equal(
      burstFulfilled.length,
      1,
      'TC02-2a: Trong 10 request đồng thời, chỉ duy nhất 1 request thành công'
    );
    assert.equal(
      burstRejected409.length,
      burstCount - 1,
      'TC02-2b: Cả 9 request đồng thời còn lại đều phải trả về HTTP 409 Conflict'
    );

    const winnerBooking2 = burstFulfilled[0].value;
    createdBookingIds.push(winnerBooking2.booking_id);

    // Kiểm tra trực tiếp trong DB để chắc chắn không có bản ghi trùng
    const dbCheck = await pool
      .request()
      .input('courtId', courtId)
      .input('testDate', testDate)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM bookings
        WHERE court_id = @courtId
          AND booking_date = @testDate
          AND start_time = '19:30:00'
          AND status NOT IN ('CANCELLED', 'NO-SHOW')
      `);
    assert.equal(
      Number(dbCheck.recordset[0].cnt),
      1,
      'TC02-2c: Trong cơ sở dữ liệu chỉ tồn tại duy nhất 1 bản ghi đặt sân cho khung giờ 19:30-21:00'
    );
    console.log(
      `✅ TC02-2 PASS (${elapsedBurst}ms): Burst 10 Request đồng thời -> 1 Thành công (#${winnerBooking2.booking_id}), 9 Bị chặn (HTTP 409), DB nhất quán 100%`
    );

    // -------------------------------------------------------------------------
    // TC02-3: 2 Request đồng thời giao thoa một phần khung giờ (15:00-17:00 vs 16:00-18:00)
    // -------------------------------------------------------------------------
    const settledOverlap = await Promise.allSettled([
      bookingService.createBooking(
        {
          courtId,
          bookingDate: testDate,
          startTime: '15:00',
          endTime: '17:00',
          customerName: 'Khách Giao Thoa 1',
          customerPhone: '0966111001',
        },
        { id: player1.user_id, role: 'player' }
      ),
      bookingService.createBooking(
        {
          courtId,
          bookingDate: testDate,
          startTime: '16:00',
          endTime: '18:00',
          customerName: 'Khách Giao Thoa 2',
          customerPhone: '0966111002',
        },
        { id: player2.user_id, role: 'player' }
      ),
    ]);

    const overlapFulfilled = settledOverlap.filter((r) => r.status === 'fulfilled');
    const overlapRejected = settledOverlap.filter(
      (r) => r.status === 'rejected' && r.reason?.statusCode === 409
    );

    assert.equal(overlapFulfilled.length, 1, 'TC02-3a: Chỉ 1 trong 2 khung giờ giao thoa được tạo');
    assert.equal(overlapRejected.length, 1, 'TC02-3b: Khung giờ giao thoa còn lại bị chặn với HTTP 409');
    createdBookingIds.push(overlapFulfilled[0].value.booking_id);
    console.log(
      '✅ TC02-3 PASS: Chặn chính xác 2 request đồng thời có khung giờ giao thoa một phần (15:00-17:00 & 16:00-18:00)'
    );

    // -------------------------------------------------------------------------
    // TC02-4: Thanh toán qua cổng Sandbox, Chống giả mạo chữ ký HMAC-SHA512 (R07) & Idempotency (S3-08)
    // -------------------------------------------------------------------------
    const paymentSessionFailed = await bookingService.initiateBookingPayment(
      winnerBooking1.booking_id,
      { paymentMethod: 'VNPAY', paymentType: 'FULL_PAYMENT' },
      { id: player1.user_id, role: 'player' }
    );

    assert.ok(paymentSessionFailed.orderCode, 'TC02-4a: Khởi tạo phiên thanh toán Sandbox có orderCode');
    assert.ok(
      paymentSessionFailed.sandboxGateway?.webhookPayloads?.success?.signature,
      'TC02-4b: Phiên thanh toán sinh đầy đủ chữ ký HMAC-SHA512'
    );

    // 4.1. Thử gửi Webhook giả mạo chữ ký (Forged Signature - Kiểm thử Rủi ro R07)
    let forgedBlocked = false;
    try {
      await bookingService.processPaymentWebhook({
        ...paymentSessionFailed.sandboxGateway.webhookPayloads.success,
        signature: '000000000000000000000000000000000000000000000000000000000000dead',
      });
    } catch (err) {
      forgedBlocked = err.statusCode === 400;
    }
    assert.equal(
      forgedBlocked,
      true,
      'TC02-4c (R07): Webhook có chữ ký HMAC-SHA512 giả mạo phải bị chặn (HTTP 400)'
    );

    // 4.2. Giả lập giao dịch lỗi/hủy trên cổng Sandbox (Mã lỗi 24) -> Tự động trả về VietQR dự phòng (S3-09)
    const failedWebhookRes = await bookingService.processPaymentWebhook(
      paymentSessionFailed.sandboxGateway.webhookPayloads.failed
    );
    assert.equal(failedWebhookRes.status, 'FAILED', 'TC02-4d: Ghi nhận trạng thái FAILED khi lỗi cổng');
    assert.equal(
      failedWebhookRes.fallbackRecommended,
      true,
      'TC02-4e: Tự động kích hoạt gợi ý phương án dự phòng VietQR khi cổng thanh toán lỗi'
    );
    assert.ok(
      failedWebhookRes.vietQrFallback?.qrImageUrl,
      'TC02-4f: Có đầy đủ URL mã QR chuyển khoản dự phòng VietQR Napas 247'
    );

    // 4.3. Khởi tạo lại phiên thanh toán VNPay Sandbox & Gửi Webhook Thành công (Mã 00)
    const paymentSessionSuccess = await bookingService.initiateBookingPayment(
      winnerBooking1.booking_id,
      { paymentMethod: 'VNPAY', paymentType: 'FULL_PAYMENT' },
      { id: player1.user_id, role: 'player' }
    );

    const successWebhookRes = await bookingService.processPaymentWebhook(
      paymentSessionSuccess.sandboxGateway.webhookPayloads.success
    );
    assert.equal(successWebhookRes.status, 'SUCCESS', 'TC02-4g: Đối soát Webhook thành công');
    assert.equal(
      successWebhookRes.booking?.status,
      'CONFIRMED',
      'TC02-4h: Đơn đặt sân tự động chuyển từ PENDING sang CONFIRMED sau khi thanh toán'
    );
    assert.equal(
      successWebhookRes.booking?.payment_status,
      'PAID',
      'TC02-4i: Trạng thái thanh toán của đơn chuyển sang PAID'
    );

    // 4.4. Gửi lặp lại đúng gói tin Webhook đó lần 2 (Kiểm tra tính Idempotent)
    const duplicateWebhookRes = await bookingService.processPaymentWebhook(
      paymentSessionSuccess.sandboxGateway.webhookPayloads.success
    );
    assert.equal(
      duplicateWebhookRes.idempotent,
      true,
      'TC02-4j: Gọi lặp lại Webhook cùng orderCode phải đảm bảo Idempotent (không cộng dồn tiền 2 lần)'
    );
    console.log(
      '✅ TC02-4 PASS: Cổng thanh toán Sandbox, xác thực chữ ký số HMAC-SHA512 (R07) & chống trùng lặp Webhook (Idempotent) hoạt động chính xác'
    );

    // -------------------------------------------------------------------------
    // TC02-5: Phương án dự phòng thanh toán VietQR Napas 247 (S3-09)
    // -------------------------------------------------------------------------
    const vietQrInfo = await bookingService.getVietQrFallbackForBooking(winnerBooking2.booking_id);
    assert.equal(vietQrInfo.provider, 'VIETQR_NAPAS247', 'TC02-5a: Tạo thông tin VietQR chuẩn Napas 247');
    assert.ok(
      vietQrInfo.transferContent.includes(`SPL ${winnerBooking2.booking_id}`),
      'TC02-5b: Nội dung chuyển khoản VietQR tự động gắn mã đơn SPL'
    );

    const vietQrConfirmRes = await bookingService.confirmVietQrPayment(
      winnerBooking2.booking_id,
      { paymentType: 'FULL_PAYMENT', bankRefCode: 'FT26322999888' },
      { id: player1.user_id, role: 'player' }
    );
    assert.equal(vietQrConfirmRes.status, 'SUCCESS', 'TC02-5c: Đối soát thanh toán VietQR thành công');
    assert.equal(
      vietQrConfirmRes.booking?.payment_method,
      'VIETQR',
      'TC02-5d: Lưu đúng phương thức thanh toán VIETQR'
    );
    console.log(
      '✅ TC02-5 PASS: Phương án dự phòng thanh toán VietQR Napas 247 (S3-09) tạo mã QR & đối soát thành công'
    );

    // -------------------------------------------------------------------------
    // TC02-6: Hủy đặt sân, Hoàn tiền tự động (REFUND) & Giải phóng lịch sân (S3-10 / R04)
    // -------------------------------------------------------------------------
    const cancelResult = await bookingService.cancelBookingWithRefund(
      winnerBooking1.booking_id,
      { cancelReason: 'Bận công tác đột xuất, xin hủy lịch trước giờ bóng lăn' },
      { id: player1.user_id, role: 'player' }
    );

    assert.equal(
      cancelResult.booking?.status,
      'CANCELLED',
      'TC02-6a: Đơn đặt sân chuyển sang trạng thái CANCELLED'
    );
    assert.equal(
      cancelResult.booking?.payment_status,
      'REFUNDED',
      'TC02-6b: Trạng thái thanh toán chuyển sang REFUNDED'
    );
    assert.equal(
      cancelResult.refund?.refundAmount,
      Number(winnerBooking1.total_price),
      'TC02-6c: Hoàn trả 100% số tiền đã thanh toán khi hủy trước giờ thi đấu >= 2 giờ'
    );
    assert.ok(
      cancelResult.refund?.refundTransaction?.transaction_id,
      'TC02-6d: Tự động tạo bản ghi giao dịch REFUND trong bảng transactions'
    );

    // Kiểm tra đặt lại đúng khung giờ 18:00 - 19:30 vừa hủy (Xác minh R04: Giải phóng lịch sân ngay lập tức)
    const rebooked = await bookingService.createBooking(
      {
        courtId,
        bookingDate: testDate,
        startTime: '18:00',
        endTime: '19:30',
        customerName: 'Khách Đặt Lại Sau Khi Hủy',
        customerPhone: '0988999888',
      },
      { id: player2.user_id, role: 'player' }
    );
    assert.ok(
      rebooked?.booking_id,
      'TC02-6e (R04): Khung giờ 18:00-19:30 được giải phóng ngay sau khi hủy, cho phép người khác đặt lại thành công'
    );
    createdBookingIds.push(rebooked.booking_id);
    console.log(
      `✅ TC02-6 PASS: Hủy đặt sân, ghi nhận giao dịch REFUND (${cancelResult.refund.refundAmount.toLocaleString('vi-VN')}đ) & giải phóng lịch sân tức thì (R04)`
    );

    // -------------------------------------------------------------------------
    // TC02-7: Kiểm thử hiệu năng phản hồi API < 2000ms (S3-12)
    // -------------------------------------------------------------------------
    const tPerfStart = performance.now();
    await bookingService.getCourtAvailability({ courtId, date: testDate });
    const tAvail = Math.round(performance.now() - tPerfStart);

    const tQuoteStart = performance.now();
    await bookingService.calculateBookingQuote({
      courtId,
      bookingDate: testDate,
      startTime: '08:00',
      endTime: '09:30',
    });
    const tQuote = Math.round(performance.now() - tQuoteStart);

    const tHistStart = performance.now();
    const historyList = await bookingService.getBookingsByUser({
      id: player1.user_id,
      role: 'player',
    });
    const tHist = Math.round(performance.now() - tHistStart);

    assert.ok(Array.isArray(historyList), 'TC02-7a: API lấy lịch sử đặt sân trả về danh sách hợp lệ');
    assert.ok(
      tAvail < 2000 && tQuote < 2000 && tHist < 2000,
      `TC02-7b: Thời gian phản hồi các API đều < 2000ms (Availability: ${tAvail}ms, Quote: ${tQuote}ms, History: ${tHist}ms)`
    );
    console.log(
      `✅ TC02-7 PASS: Hiệu năng API đạt chuẩn < 2000ms (Availability: ${tAvail}ms, Quote: ${tQuote}ms, History: ${tHist}ms)`
    );

    console.log('-------------------------------------------------------------------------');
    console.log('🎉 TẤT CẢ 7/7 NHÓM KỊCH BẢN SPRINT 3 (TC02, SANDBOX, VIETQR, REFUND, PERF) ĐỀU PASSED 100%!');
    console.log('=========================================================================');
  } finally {
    // Dọn dẹp dữ liệu kiểm thử tạm trên ngày testDate
    try {
      await pool
        .request()
        .input('courtId', courtId)
        .input('testDate', testDate)
        .query(`
          DELETE FROM transactions WHERE booking_id IN (
            SELECT booking_id FROM bookings WHERE court_id = @courtId AND booking_date = @testDate
          );
          DELETE FROM bookings WHERE court_id = @courtId AND booking_date = @testDate;
          DELETE FROM customers WHERE phone IN ('0988111001', '0988111002', '0966111001', '0966111002', '0988999888')
            OR phone LIKE '09770000%';
        `);
    } catch {
      // ignore cleanup error
    }
  }
}

runTc02Suite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Lỗi khi chạy bộ kiểm thử TC02:', err);
    process.exit(1);
  });

