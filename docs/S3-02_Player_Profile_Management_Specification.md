# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & BÁO CÁO NGHIỆM THU: [WBS 4.1.2 & 4.1.3] HỒ SƠ NGƯỜI CHƠI (S3-02)

- **Dự án:** Hệ Thống Quản Lý và Đặt Sân Thể Thao Trực Tuyến — **SportLink**
- **Mã công việc (Task ID):** `S3-02`
- **Hạng mục WBS:** `[4.1] Xác thực Người chơi` (`4.1.2 Xem & cập nhật hồ sơ người chơi`, `4.1.3 Đổi mật khẩu & thống kê hoạt động`)
- **Sprint:** Sprint 3 — Tìm sân, Đặt sân, Thanh toán & Xử lý đơn đặt
- **Người phụ trách thực hiện:** Trần Lê Quang Hữu (`@hutrn6`)
- **Thời lượng ước tính:** 8 giờ
- **Hạn hoàn thành (Deadline):** 26/11/2026
- **Trạng thái:** Hoàn thành 100% (Đã kiểm thử E2E & Automated Test 100% PASS)

---

## 1. Mục tiêu & Phạm vi Chức năng

Hạng mục `S3-02` (`[4.1] Hồ sơ người chơi`) cung cấp không gian quản lý thông tin cá nhân, bảo mật tài khoản, ảnh đại diện và thống kê thành tích đặt sân cho Người chơi:

1. **Xem hồ sơ & Thống kê hoạt động (`GET /api/auth/profile`):**
   - Hiển thị đầy đủ thông tin cá nhân: Họ và tên, Email, Số điện thoại, Giới tính (`MALE`, `FEMALE`, `OTHER`), Ngày sinh (`dob`), Địa chỉ liên hệ (`address`), Các môn thể thao yêu thích (`favoriteSports`), Giới thiệu bản thân (`bio`), Ảnh đại diện (`avatarUrl`) và Điểm uy tín (`reputationScore`).
   - Tự động tổng hợp **4 chỉ số KPI đặt sân của Người chơi**:
     - Tổng số lượt đặt sân (`totalBookings`) & Số ca đã hoàn thành (`completedBookings`).
     - Số lịch đặt sân sắp diễn ra (`upcomingBookings`).
     - Tổng chi tiêu tích lũy (`totalSpent`) & Số đơn đã hủy (`cancelledBookings`).
     - Tự động xếp **Hạng thành viên (`memberTier`)**: `DIAMOND` (>= 5.000.000đ), `GOLD` (>= 2.000.000đ), `SILVER` (>= 500.000đ), hoặc `BRONZE`.

2. **Cập nhật thông tin hồ sơ & Ảnh đại diện (`PUT /api/auth/profile` & `POST /api/auth/avatar`):**
   - Cho phép chỉnh sửa Họ tên, Số điện thoại, Giới tính, Ngày sinh, Địa chỉ, Chọn nhanh các môn thể thao yêu thích (Bóng đá, Cầu lông, Pickleball, Tennis, Bóng rổ, Bóng chuyền) và Giới thiệu bản thân.
   - Tích hợp công cụ cắt ảnh đại diện (`ImageCropModal` tỉ lệ 1:1) và xem ảnh phóng to (`ImageViewerModal`).
   - Tự động đồng bộ Họ tên và Số điện thoại mới sang bảng khách hàng CRM (`[dbo].[customers]`) để Chủ sân luôn thấy thông tin mới nhất.

3. **Đổi mật khẩu bảo mật (`PUT /api/auth/change-password`):**
   - Xác thực mật khẩu hiện tại bằng `bcrypt.compare`, kiểm tra mật khẩu mới tối thiểu 6 ký tự và khác mật khẩu cũ, cập nhật `password_hash` và gửi thông báo xác nhận.

---

## 2. Thiết kế Cơ sở Dữ liệu & API Backend

### 2.1. Mở rộng Bảng `[dbo].[users]`
Bổ sung các cột thông tin hồ sơ người chơi (tự động migrate an toàn khi khởi động):
- `gender VARCHAR(20) NULL`
- `dob DATE NULL`
- `address NVARCHAR(500) NULL`
- `bio NVARCHAR(1000) NULL`
- `favorite_sports NVARCHAR(500) NULL`

### 2.2. Danh sách API Endpoints (`backend/src/modules/auth/`)

| Phương thức | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/profile` | Authenticated | Lấy chi tiết hồ sơ Người chơi kèm thống kê KPI đặt sân & hạng thành viên. |
| `PUT` | `/api/auth/profile` | Authenticated | Cập nhật thông tin hồ sơ cá nhân & đồng bộ sang bảng `customers`. |
| `PUT` | `/api/auth/change-password` | Authenticated | Đổi mật khẩu sau khi xác minh mật khẩu hiện tại. |
| `POST` | `/api/auth/avatar` | Authenticated | Tải lên và cập nhật ảnh đại diện đã cắt. |
| `DELETE` | `/api/auth/avatar` | Authenticated | Xóa ảnh đại diện tùy chỉnh về mặc định. |

---

## 3. Giao diện Người dùng (`app/src/features/auth/PlayerProfilePage.tsx`)

- Được tích hợp tại đường dẫn `/profile` và liên kết trực tiếp từ menu tài khoản trên `PlayerNavbar`.
- Bao gồm **Banner Hồ sơ & Hạng thành viên**, **4 Thẻ KPI Thống kê**, và **3 Tab chức năng**:
  1. **👤 Thông tin cá nhân:** Form cập nhật hồ sơ và nút chọn nhanh môn thể thao yêu thích.
  2. **🔒 Đổi mật khẩu & Bảo mật:** Form đổi mật khẩu có kiểm tra xác nhận.
  3. **📅 Lịch đặt sân gần đây:** Hiển thị nhanh các ca đặt sân của người chơi kèm nút chuyển tới trang quản lý thanh toán / hủy đơn.

---

## 4. Kết quả Kiểm thử Tự động (Automated Test Report)

| Mã Test | Nội dung kiểm thử | Kết quả |
| :--- | :--- | :---: |
| `S3-02.1` | Xem hồ sơ Người chơi kèm thống kê lịch đặt sân & hạng thành viên (`memberTier`) | **PASS** |
| `S3-02.2` | Cập nhật thông tin hồ sơ Người chơi (Họ tên, Giới tính, Ngày sinh, Địa chỉ, Môn yêu thích, Bio) & đồng bộ CRM | **PASS** |
| `S3-02.3` | Đổi mật khẩu trong trang Hồ sơ người chơi thành công | **PASS** |
