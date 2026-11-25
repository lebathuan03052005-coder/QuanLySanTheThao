# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & BÁO CÁO NGHIỆM THU: [WBS 3.1.8] XỬ LÝ ĐƠN ĐẶT ONLINE PHÍA CHỦ SÂN/STAFF (S3-14)

- **Dự án:** Hệ Thống Quản Lý và Đặt Sân Thể Thao Trực Tuyến — **SportLink**
- **Mã công việc (Task ID):** `S3-14`
- **Hạng mục WBS:** `[3.1] Quản lý sân & Lịch sân` (`3.1.8 Xử lý đơn đặt online phía Chủ sân/Staff: danh sách đơn có lọc, xác nhận, từ chối kèm lý do, hủy và thông báo cho Người chơi`)
- **Sprint:** Sprint 3 — Tìm sân, Đặt sân, Thanh toán & Xử lý đơn đặt
- **Người phụ trách thực hiện:** Trần Lê Quang Hữu (`@hutrn6`)
- **Thời lượng ước tính:** 14 giờ
- **Hạn hoàn thành (Deadline):** 26/11/2026
- **Trạng thái:** Hoàn thành 100% (Đã kiểm thử E2E & Automated Test 100% PASS)

---

## 1. Mục tiêu & Phạm vi Chức năng

Hạng mục `S3-14` (`[3.1.8] Xử lý đơn đặt online phía Chủ sân/Staff`) trang bị cho Chủ sân (`OWNER`) và Nhân viên (`STAFF`) công cụ quản lý tập trung toàn bộ các đơn đặt sân trực tuyến từ Người chơi:

1. **Danh sách đơn đặt Online có bộ lọc đa chiều (`GET /api/bookings`):**
   - Hỗ trợ lọc kết hợp theo: **Trạng thái đơn** (`PENDING`, `CONFIRMED`, `CHECKED-IN`, `COMPLETED`, `CANCELLED`), **Trạng thái thanh toán** (`PAID`, `DEPOSIT_PAID`, `UNPAID`, `REFUNDED`), **Cơ sở sân (`facilityId`)**, **Sân con (`courtId`)**, **Môn thể thao (`sportId`)**, **Khoảng ngày (`startDate`, `endDate`)** và **Từ khóa tìm kiếm (`keyword` — mã đơn, tên sân, tên/SĐT khách)**.
   - Cô lập dữ liệu chặt chẽ theo quyền sở hữu: Chủ sân và Nhân viên chỉ nhìn thấy và xử lý các đơn thuộc cơ sở của mình.

2. **Xác nhận, Check-in, Hoàn thành và Hủy đơn (`PATCH /api/bookings/:id/status`):**
   - Chủ sân/Staff duyệt nhanh đơn `PENDING -> CONFIRMED`, xác nhận khách nhận sân (`CHECKED-IN`), hoàn tất thu tiền (`COMPLETED`) hoặc đánh dấu `NO-SHOW` / `CANCELLED`.
   - Khi chuyển sang `COMPLETED`, hệ thống tự động cộng điểm uy tín cho Người chơi và cập nhật doanh thu CRM.

3. **Từ chối đơn đặt Online kèm lý do bắt buộc & Hoàn tiền tự động (`POST /api/bookings/:id/reject`):**
   - Bắt buộc Chủ sân/Staff phải nhập **Lý do từ chối cụ thể** (nếu để trống trả về lỗi HTTP `400`).
   - Tự động chuyển trạng thái đơn sang `CANCELLED`, ghi nhận `cancel_reason = "[Từ chối đơn] <Lý do>"` và thời điểm `cancelled_at`.
   - Nếu Người chơi đã thanh toán hoặc đặt cọc trước (`paid_amount > 0`), hệ thống tự động **hoàn tiền 100%** (`refund_amount = paid_amount`, `payment_status = 'REFUNDED'`) và ghi bút toán giao dịch hoàn tiền `REFUND` vào bảng `[dbo].[booking_transactions]`.

4. **Hệ thống Thông báo tức thì cho Người chơi (`[dbo].[user_notifications]`):**
   - Bất kỳ thao tác Xác nhận, Từ chối (kèm lý do), Check-in, Hoàn thành hay Hủy đơn từ phía Chủ sân/Staff đều tự động đẩy một thông báo thời gian thực vào chuông thông báo (`PlayerNavbar`) của Người chơi.

---

## 2. Thiết kế API Backend (`backend/src/modules/bookings/`)

| Phương thức | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bookings` | Owner / Staff / Player | Lấy danh sách đơn đặt sân có lọc theo `status`, `paymentStatus`, `facilityId`, `courtId`, `sportId`, `startDate`, `endDate`, `keyword`. |
| `PATCH` | `/api/bookings/:id/status` | Owner / Staff | Xác nhận đơn (`CONFIRMED`), nhận sân (`CHECKED-IN`), hoàn thành (`COMPLETED`), hủy (`CANCELLED`) & tự động thông báo cho Người chơi. |
| `POST` | `/api/bookings/:id/reject` | Owner / Staff | Từ chối đơn đặt Online (bắt buộc kèm `reason`), tự động hoàn tiền 100% và gửi thông báo kèm lý do cho Người chơi. |
| `GET` | `/api/auth/notifications` | Authenticated | Lấy danh sách thông báo mới nhất của Người chơi. |
| `PATCH` | `/api/auth/notifications/read` | Authenticated | Đánh dấu đã đọc thông báo. |

---

## 3. Giao diện Người dùng (`app/src/features/booking/CourtSchedulePage.tsx`)

- Tích hợp tab **"📋 Xử lý đơn đặt Online"** ngay trên thanh điều hướng trang Lịch hoạt động sân (`/owner/schedule`), hiển thị số lượng đơn đang chờ duyệt (`pendingCount`).
- Cung cấp bảng danh sách đơn trực quan kèm ô tìm kiếm từ khóa, bộ lọc trạng thái thanh toán, bộ lọc cơ sở/môn/sân và các nút thao tác nhanh trên từng dòng: **✓ Xác nhận**, **🏃 Check-in**, **✕ Từ chối (Lý do)**, **💰 Hoàn thành**, **Hủy**.
- Tích hợp **Modal Từ chối đơn đặt Online (`rejectModalBooking`)** với các gợi ý lý do phổ biến (bảo trì đột xuất, sự cố thời tiết, trùng giải đấu...) và ô nhập lý do chi tiết gửi tới Người chơi.

---

## 4. Kết quả Kiểm thử Tự động (Automated Test Report)

| Mã Test | Nội dung kiểm thử | Kết quả |
| :--- | :--- | :---: |
| `S3-14.1` | Chủ sân/Staff lọc danh sách đơn đặt Online theo trạng thái (`PENDING`) & Sân con thành công | **PASS** |
| `S3-14.2` | Chủ sân/Staff xác nhận đơn đặt Online -> chuyển trạng thái `CONFIRMED` | **PASS** |
| `S3-14.3` | Chặn từ chối đơn đặt Online nếu Chủ sân/Staff không nhập lý do (HTTP 400) | **PASS** |
| `S3-14.4` | Từ chối đơn đặt Online lưu đúng lý do, chuyển `CANCELLED` & tự động hoàn 100% tiền cọc | **PASS** |
| `S3-14.5` | Tự động gửi thông báo In-App đến Người chơi khi đơn được Xác nhận và khi đơn bị Từ chối (kèm lý do) | **PASS** |
