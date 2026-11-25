# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & BÁO CÁO NGHIỆM THU: [WBS 4.1.1] ĐĂNG KÝ & QUÊN MẬT KHẨU CHO NGƯỜI CHƠI (S3-01)

- **Dự án:** Hệ Thống Quản Lý và Đặt Sân Thể Thao Trực Tuyến — **SportLink**
- **Mã công việc (Task ID):** `S3-01`
- **Hạng mục WBS:** `[4.1] Xác thực Người chơi` (`4.1.1 Đăng ký, quên mật khẩu cho Người chơi`)
- **Sprint:** Sprint 3 — Tìm sân, Đặt sân, Thanh toán & Xử lý đơn đặt
- **Người phụ trách thực hiện:** Trần Lê Quang Hữu (`@hutrn6`)
- **Thời lượng ước tính:** 14 giờ
- **Hạn hoàn thành (Deadline):** 26/11/2026
- **Trạng thái:** Hoàn thành 100% (Đã kiểm thử E2E & Automated Test 100% PASS)

---

## 1. Mục tiêu & Phạm vi Chức năng

Hạng mục `S3-01` (`[4.1.1] Đăng ký, quên mật khẩu cho Người chơi`) xây dựng luồng tự phục vụ hoàn chỉnh cho Người chơi (Player) từ lúc tạo tài khoản mới đến khi khôi phục mật khẩu bị quên qua mã xác thực OTP 6 chữ số:

1. **Đăng ký tài khoản Người chơi (`POST /api/auth/register` & Giao diện `/register`):**
   - Cho phép người chơi đăng ký nhanh bằng **Họ và tên, Email, Số điện thoại và Mật khẩu**.
   - Kiểm tra chặt chẽ định dạng Email, độ mạnh mật khẩu (`>= 6` ký tự), xác nhận mật khẩu khớp và chống trùng lặp Email trong cơ sở dữ liệu.
   - Mã hóa mật khẩu an toàn bằng thuật toán `bcryptjs` (Salt rounds = 10).
   - Tự động khởi tạo bản ghi khách hàng đồng bộ sang phân hệ CRM (`[dbo].[customers]`) với điểm uy tín mặc định `100` và tạo thông báo chào mừng trong hộp thư Người chơi (`[dbo].[user_notifications]`).
   - Cấp ngay **JWT Access Token** sau khi đăng ký để tự động đăng nhập liền mạch vào ứng dụng.

2. **Quên mật khẩu & Khôi phục mật khẩu 3 bước bằng mã OTP 6 số (`/forgot-password`):**
   - **Bước 1 — Yêu cầu mã khôi phục (`POST /api/auth/forgot-password`):** Người chơi nhập **Email hoặc Số điện thoại** đã đăng ký. Hệ thống kiểm tra tài khoản đang hoạt động, sinh mã **OTP 6 chữ số ngẫu nhiên** có hiệu lực trong **10 phút** (`reset_otp`, `reset_otp_expires`), đồng thời gửi thông báo chứa mã OTP vào hệ thống (và trả kèm mã OTP Sandbox để phục vụ demo/kiểm thử).
   - **Bước 2 — Xác thực mã OTP (`POST /api/auth/verify-reset-otp`):** Kiểm tra tính hợp lệ và thời hạn của mã OTP 6 chữ số trước khi cho phép đặt mật khẩu mới.
   - **Bước 3 — Đặt lại mật khẩu mới (`POST /api/auth/reset-password`):** Cập nhật mật khẩu mới đã băm (`password_hash`), xóa mã OTP đã sử dụng để chống dùng lại (Replay Attack), gửi thông báo bảo mật và cấp JWT Token mới.

---

## 2. Thiết kế Cơ sở Dữ liệu & API Backend

### 2.1. Mở rộng Bảng `[dbo].[users]`
Hệ thống tự động kiểm tra và bổ sung các cột phục vụ khôi phục mật khẩu (Idempotent Migration trong `migrate_sprint2.js` và `ensureUserProfileColumns` trong `auth.service.js`):
- `reset_otp VARCHAR(10) NULL`: Lưu mã xác thực OTP 6 chữ số.
- `reset_otp_expires DATETIME2 NULL`: Thời điểm hết hạn của mã OTP (10 phút kể từ lúc yêu cầu).

### 2.2. Danh sách API Endpoints (`backend/src/modules/auth/`)

| Phương thức | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản Người chơi mới, đồng bộ CRM `customers`, tạo thông báo chào mừng & trả về `{ token, user }`. |
| `POST` | `/api/auth/forgot-password` | Public | Tìm tài khoản theo Email hoặc SĐT, sinh mã OTP 6 số có hạn 10 phút. |
| `POST` | `/api/auth/verify-reset-otp` | Public | Kiểm tra mã OTP 6 số hợp lệ và còn thời hạn hiệu lực. |
| `POST` | `/api/auth/reset-password` | Public | Đặt lại mật khẩu mới với mã OTP hợp lệ, thu hồi OTP cũ và trả về `{ token, user }`. |

---

## 3. Giao diện Người dùng (Frontend — React 19 + TypeScript + Tailwind CSS)

1. **Trang Đăng ký Người chơi (`app/src/features/auth/RegisterPage.tsx` — Route `/register`):**
   - Thiết kế đồng bộ nhận diện thương hiệu SportLink, có kiểm tra lỗi trực tiếp trên từng trường dữ liệu, nút ẩn/hiện mật khẩu và tự động đăng nhập chuyển hướng về Trang chủ sau khi đăng ký thành công.
2. **Trang Quên mật khẩu 3 bước (`app/src/features/auth/ForgotPasswordPage.tsx` — Route `/forgot-password`):**
   - Thanh tiến trình 3 bước trực quan: **1. Nhập tài khoản -> 2. Xác thực OTP -> 3. Mật khẩu mới**.
   - Hỗ trợ hộp hiển thị mã OTP Sandbox và nút **"Điền nhanh mã OTP"** giúp giảng viên và nhóm kiểm thử nghiệm thu nhanh chóng mà không phụ thuộc cổng SMS bên thứ ba.

---

## 4. Kết quả Kiểm thử Tự động (Automated Test Report)

Kịch bản kiểm thử tự động trong `backend/src/scripts/test_sprint3_huu.js` (`npm run test:s3huu`):

| Mã Test | Nội dung kiểm thử | Kết quả |
| :--- | :--- | :---: |
| `S3-01.1` | Đăng ký tài khoản Người chơi trả về JWT Token & thông tin User đầy đủ | **PASS** |
| `S3-01.2` | Tự động khởi tạo thông báo chào mừng cho Người chơi mới đăng ký | **PASS** |
| `S3-01.3` | Yêu cầu Quên mật khẩu bằng Email/SĐT sinh mã OTP 6 chữ số hợp lệ | **PASS** |
| `S3-01.4` | Xác thực mã OTP hợp lệ và còn hạn thành công | **PASS** |
| `S3-01.5` | Chặn mã OTP không chính xác với mã lỗi HTTP 400 | **PASS** |
| `S3-01.6` | Đặt lại mật khẩu mới bằng OTP thành công & tự động cấp JWT mới | **PASS** |
| `S3-01.7` | Đăng nhập lại bằng mật khẩu mới sau khi khôi phục thành công | **PASS** |
