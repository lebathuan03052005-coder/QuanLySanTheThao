``

### Bước 2: Cài đặt Dependencies

Mở 2 cửa sổ dòng lệnh (Terminal / PowerShell):

**Cửa sổ 1 - Backend:**

```bash
cd backend
npm install
```

**Cửa sổ 2 - Frontend:**

```bash
cd app
npm install
```

---

### Bước 3: Cấu hình biến môi trường (`.env`)

#### 🔹 Cấu hình Backend (`backend/.env`)

Trong thư mục `backend/`, copy file mẫu `.env.example` thành `.env`:

```bash
# Windows PowerShell
copy .env.example .env

# Hoặc Git Bash / Linux / macOS
cp .env.example .env
```

Mở file `backend/.env` và chỉnh sửa các thông số kết nối SQL Server của máy bạn:

```env
PORT=3000
NODE_ENV=development

# Cấu hình SQL Server
DB_SERVER=localhost
DB_NAME=sportlink_db
DB_USER=sa
DB_PASSWORD=MatKhauCuaBan123
DB_PORT=1433

# JWT Secret
JWT_SECRET=sportlink_jwt_super_secret_key_2026
JWT_EXPIRES_IN=7d
```

#### 🔹 Cấu hình Frontend (`app/.env`)

Trong thư mục `app/`, tạo hoặc kiểm tra file `.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here_nhắn Thuần để có mã
```

---

## 1. Khởi tạo Cơ sở dữ liệu (Database Setup)

Bạn có thể chọn cách để khởi tạo cơ sở dữ liệu:

### 🌟 Chạy tự động bằng lệnh NPM (Khuyên dùng - Nhanh nhất)

Từ thư mục `backend/`:

```bash
cd backend

# 1. Chạy Migration: Tự động tạo bảng & bổ sung các cột mới (lat, lng, images, capacity...)
npm run db:migrate

# 2. Chạy Seed: Tự động nạp danh mục 6 môn thể thao, 3 Chủ sân, 6 Cơ sở, 18 Sân con & Bảng giá
npm run db:seed
```

## 5. Khởi động ứng dụng (Run App)

### 1️⃣ Khởi động Backend API (Port 3000)

Tại thư mục `backend/`:

```bash
npm run dev
```

- Máy chủ API sẽ chạy tại: `http://localhost:3000`
- Kiểm tra trạng thái: Mở trình duyệt vào `http://localhost:3000/api/sports` thấy trả về JSON là thành công.

### 2️⃣ Khởi động Frontend Client (Port 5173)

Mở một cửa sổ dòng lệnh khác, tại thư mục `app/`:

```bash
npm run dev
```

- Giao diện web sẽ khởi chạy tại: `http://localhost:5173`
- Truy cập vào: [http://localhost:5173](http://localhost:5173)

---

## 6. Danh sách tài khoản kiểm thử

Hệ thống đã nạp sẵn các tài khoản với đầy đủ phân quyền để phục vụ kiểm thử:

- **Mật khẩu chung cho tất cả tài khoản:** `password123`
- **Trang đăng nhập:** `http://localhost:5173/login`

|  STT  | Quyền hạn (Role)          | Email đăng nhập       | Mật khẩu      | Họ và tên             | Quyền sở hữu & Chức năng                                                                                                        |
| :---: | :------------------------ | :-------------------- | :------------ | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **Chủ sân (OWNER)**       | `owner@sportlink.vn`  | `password123` | **Nguyễn Văn Hùng**   | Sở hữu **Cơ sở 3** _(Man Thiện)_ & **Cơ sở 4** _(Hiệp Phú)_. Có toàn quyền quản lý, thêm/sửa/xóa ảnh cơ sở và sân con của mình. |
| **2** | **Chủ sân (OWNER)**       | `owner2@sportlink.vn` | `password123` | **Nguyễn Minh Hoàng** | Sở hữu **Cơ sở 7** _(SHTP)_ & **Cơ sở 8** _(Đặng Văn Bi)_.                                                                      |
| **3** | **Chủ sân (OWNER)**       | `owner3@sportlink.vn` | `password123` | **Lê Quốc Bảo**       | Sở hữu **Cơ sở 9** _(Làng ĐH)_ & **Cơ sở 10** _(ĐHQG Khu B)_.                                                                   |
| **4** | **Nhân viên (STAFF)**     | `staff@sportlink.vn`  | `password123` | **Trần Văn Tuấn**     | Quản lý ca trực, hỗ trợ check-in khách tại sân.                                                                                 |
| **5** | **Người chơi (PLAYER)**   | `player@sportlink.vn` | `password123` | **Lê Văn Nam**        | Đặt sân, tham gia kèo đấu (Chỉ xem ảnh cơ sở/sân con, không có quyền sửa).                                                      |
| **6** | **Quản trị viên (ADMIN)** | `admin@sportlink.vn`  | `password123` | **Hệ thống Quản trị** | Giám sát toàn hệ thống SportLink.                                                                                               |

---

## 7. Các tính năng & Đường dẫn kiểm thử chính

### 🏟️ 1. Khám phá sân & Chuyển hướng thông minh (Court Navigation & Focus)

- **Đường dẫn:** `http://localhost:5173/courts`
- **Cách kiểm thử:**
  1. Vào danh sách tất cả sân con tại `/courts`.
  2. Bấm vào bất kỳ sân con nào (ví dụ sân con thuộc Cơ sở 3 hoặc Cơ sở 4).
  3. Hệ thống sẽ **tự động chuyển hướng về trang cơ sở mẹ** (`/facilities/:facilityId?courtId=X#court-X`), tự động lọc đúng môn thể thao của sân đó, tự động cuộn màn hình mượt mà đến đúng vị trí sân con và **bật hiệu ứng viền vàng nổi bật** kèm huy hiệu `🎯 SÂN BẠN VỪA CHỌN`.

### 🖼️ 2. Phân quyền Quản lý ảnh Cơ sở & Sân con (Facility & Court Images RBAC)

- **Đường dẫn:** `http://localhost:5173/facilities/3`
- **Cách kiểm thử:**
  - **Trường hợp 1 (Đăng nhập với tài khoản Chủ sân sở hữu - `owner@sportlink.vn`):**
    - Vào trang cơ sở 3 của mình: Xuất hiện nút **"Thêm ảnh"** cho cơ sở, có nút xóa `✕` trên từng ảnh.
    - Tại từng thẻ sân con bên dưới: Xuất hiện nút **"+ Thêm ảnh"** cho từng sân con, có thể tải lên nhiều ảnh trực tiếp và xóa ảnh của sân con.
  - **Trường hợp 2 (Khách chưa đăng nhập HOẶC Người chơi `player@sportlink.vn` HOẶC Chủ sân khác `owner2@sportlink.vn`):**
    - Vào trang cơ sở 3: Chỉ hiển thị chế độ xem ảnh (Gallery), **hoàn toàn ẩn** các nút thêm ảnh, xóa ảnh. Đảm bảo tính bảo mật và cách ly tuyệt đối giữa các chủ sân.

### ⏰ 3. Chặn đặt sân trong quá khứ (Realtime Booking Validation)

- **Đường dẫn:** `http://localhost:5173/facilities/3` hoặc `http://localhost:5173/courts`
- **Cách kiểm thử:**
  1. Bấm nút **"Đặt sân ngay"** ở bất kỳ sân nào để mở Modal đặt sân.
  2. Ngày đặt sân bị khóa không cho chọn các ngày trước ngày hôm nay (`min=hôm nay`).
  3. Khi chọn ngày là **Hôm nay**:
     - Tất cả các khung giờ bắt đầu đã trôi qua so với giờ hiện tại sẽ bị làm mờ, bị vô hiệu hóa (`disabled`) và có nhãn `(Đã qua)`.
     - Giờ kết thúc luôn được tự động lọc bắt buộc phải lớn hơn giờ bắt đầu.
     - Nếu cố tình thao tác, hệ thống hiển thị cảnh báo `⏰ Khung giờ này đã ở trong quá khứ` và nút "Xác nhận đặt sân" bị khóa hoàn toàn.
     - Phía Backend cũng tích hợp tầng kiểm duyệt an toàn kép (trả về lỗi HTTP 400 nếu khung giờ ở quá khứ).

### 📊 4. Quản trị Chủ sân (Owner Management Dashboard)

Đăng nhập tài khoản `owner@sportlink.vn`:

- **Quản lý Cơ sở & Sân con:** `http://localhost:5173/owner/courts` (Bộ lọc theo từng cơ sở, quản lý 18 sân con, phân trang).
- **Quản lý Môn thể thao:** `http://localhost:5173/owner/sports` (Quản lý 6 môn thể thao thuộc các cơ sở của chủ sân).
- **Lịch biểu & Lịch đặt sân:** `http://localhost:5173/owner/schedule`

---

## 8. Xử lý sự cố thường gặp (Troubleshooting)

### ❓ 1. Lỗi kết nối Database `ConnectionError: Failed to connect to localhost:1433`

- **Nguyên nhân:** Dịch vụ SQL Server chưa khởi chạy hoặc chưa bật giao thức TCP/IP trên cổng 1433.
- **Khắc phục:**
  1. Mở **SQL Server Configuration Manager**.
  2. Vào **SQL Server Network Configuration** -> **Protocols for MSSQLSERVER**.
  3. Bật **TCP/IP** thành **Enabled**. Nhấp đúp vào TCP/IP, sang tab **IP Addresses**, cuộn xuống mục **IPAll** và đặt **TCP Port** là `1433`.
  4. Khởi động lại dịch vụ **SQL Server** trong mục Services.

### ❓ 2. Lỗi ảnh tải lên không hiển thị (Ảnh bị vỡ hoặc 404)

- **Nguyên nhân:** Backend chưa chạy hoặc cổng 3000 bị chặn.
- **Khắc phục:**
  - Đảm bảo Backend đang chạy tại `http://localhost:3000`.
  - Frontend Vite đã cấu hình proxy tự động chuyển tiếp các yêu cầu bắt đầu bằng `/uploads` sang `http://localhost:3000/uploads`.

### ❓ 3. Lỗi đăng nhập Google hiển thị cảnh báo khởi tạo

- Hệ thống đã tích hợp Singleton Pattern tại `app/src/shared/lib/googleAuth.ts`, đảm bảo Google Identity Services chỉ khởi tạo duy nhất 1 lần trong suốt vòng đời ứng dụng kể cả khi bật React 19 StrictMode.

---

_Chúc bạn có trải nghiệm phát triển và vận hành thuận lợi với dự án SportLink!_
