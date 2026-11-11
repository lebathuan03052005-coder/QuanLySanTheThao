# SportLink

Nền tảng đặt sân và cáp kèo thể thao.

---

## Yêu cầu cài đặt trước

Đảm bảo máy đã có các công cụ sau trước khi bắt đầu:

| Công cụ    | Phiên bản tối thiểu | Link tải                             |
| ---------- | ------------------- | ------------------------------------ |
| Node.js    | 20+                 | https://nodejs.org                   |
| SQL Server | 2019+               | https://www.microsoft.com/sql-server |
| Git        | bất kỳ              | https://git-scm.com                  |

---

## 1. Clone dự án về máy

```bash
git clone <link-repo>
cd QuanLySan
```

---

## 2. Cài đặt Backend

```bash
cd backend
npm install
```

Tạo file cấu hình môi trường:

```bash
# Copy file mẫu
cp .env.example .env
```

Mở file `.env` vừa tạo và điền thông tin thực của máy bạn:

```env
PORT=3000
NODE_ENV=development

DB_SERVER=localhost
DB_PORT=1433
DB_NAME=tên_database_của_bạn
DB_USER=sa
DB_PASSWORD=mật_khẩu_của_bạn

JWT_SECRET=đặt_một_chuỗi_bí_mật_bất_kỳ
JWT_EXPIRES_IN=7d
```

> ⚠️ **Không commit file `.env` lên git.** File này đã được thêm vào `.gitignore`.

````

### Chạy Backend

```bash
npm run dev
````

Backend sẽ chạy tại: `http://localhost:3000`

---

## 3. Cài đặt Frontend (App)

Mở terminal **mới**, quay lại thư mục gốc:

```bash
cd app
npm install
```

Tạo file cấu hình môi trường:

```bash
cp .env.example .env.local
```

Nội dung file `.env.local` (thường không cần sửa):

```env
VITE_API_URL=http://localhost:3000/api
```

### Chạy Frontend

```bash
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

---

## 4. Khởi tạo Database, Migration & Danh sách Tài khoản Kiểm thử (WBS 3.1)

1. **Nếu máy mới chưa có database `sportlink_db`**: mở file [`init_sportlink_db.sql`](init_sportlink_db.sql) ở thư mục gốc trong **SQL Server Management Studio (SSMS)** và nhấn **Execute** để tạo database cùng toàn bộ 20 bảng.
2. Sau khi cấu hình `backend/.env` xong, chạy lệnh sau trong thư mục `backend` để xác nhận kết nối thành công:

```bash
cd backend
node test-db.js
```

### 📌 Chú thích 3 Tài khoản Chủ sân (`OWNER`) dùng để Test Quản lý Cơ sở, Sân con & Môn thể thao

Để dữ liệu và cấu trúc bảng trong Database **không bao giờ bị tự ý thay đổi hay ghi đè mỗi khi khởi động lại Backend (`npm run dev`)**, phần đồng bộ Schema (DDL) và nạp dữ liệu mẫu (Seed) đã được **tách hoàn toàn thành 2 script chạy độc lập**:

```bash
cd backend

# 1. Đồng bộ cấu trúc bảng & cột mở rộng Sprint 2 (chạy 1 lần khi mới kéo code về)
npm run db:migrate

# 2. Nạp dữ liệu mẫu 6 môn thể thao, 3 tài khoản Chủ sân & các cơ sở/sân con (IF NOT EXISTS - không ghi đè dữ liệu hiện có)
npm run db:seed
```

- *(Tùy chọn)* Chạy thêm file [`sqlinport.sql`](sqlinport.sql) trong SQL Server nếu muốn nạp thêm tài khoản mẫu cho các vai trò khác (`admin@sportlink.vn`, `staff@sportlink.vn`, `player@sportlink.vn` — mật khẩu `password123`).

> 💡 **Lưu ý kiến trúc:**
> - Khi chạy `npm run dev`, Backend **tuyệt đối không tự chạy `CREATE TABLE` / `ALTER TABLE` (DDL) hay `INSERT` / `UPDATE` / `DELETE` (DML)** ghi đè dữ liệu hiện có.
> - Mọi thao tác Thêm / Sửa / Khóa Cơ sở, Sân con và Môn thể thao của Chủ sân nào được cô lập hoàn toàn theo `owner_id` của Chủ sân đó (kể cả khi sửa/khóa môn trên `/owner/sports`, chỉ áp dụng cho danh mục của Chủ sân đang đăng nhập mà không ảnh hưởng sang Chủ sân khác).

- **Mật khẩu đăng nhập chung cho cả 3 tài khoản:** `password123`
- **Trang đăng nhập:** `http://localhost:5173/login`
- **Nguyên tắc phân quyền (Strict Owner Isolation):** Tài khoản Chủ sân nào đăng nhập thì **chỉ nhìn thấy và thêm/sửa/khóa được đúng Cơ sở, Sân con & Cấu hình môn thể thao thuộc sở hữu của tài khoản đó** (không lộ sân hay email của chủ sân khác và không sửa chéo dữ liệu của chủ sân khác).

| STT | Email đăng nhập | Mật khẩu | Họ tên Chủ sân | Cơ sở sân thuộc quyền sở hữu (2 cơ sở / chủ sân) | Số lượng sân con & Phân bổ môn thể thao |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | `owner@sportlink.vn` | `password123` | **Nguyễn Văn Hùng**<br>*(Chủ Sân Man Thiện - Hiệp Phú)* | 1. **Cụm Sân Bóng Đá SportLink Man Thiện**<br>2. **CLB Cầu Lông SportLink Arena Hiệp Phú** | Chia đều đầy đủ **6 môn thể thao** *(Bóng đá, Cầu lông, Pickleball, Tennis, Bóng rổ, Bóng chuyền)* |
| **2** | `owner2@sportlink.vn` | `password123` | **Nguyễn Minh Hoàng**<br>*(Chủ sân Khu CNC)* | 1. **Trung Tâm Pickleball & Tennis SportLink SHTP**<br>2. **Nhà Thi Đấu Bóng Rổ Đặng Văn Bi Thủ Đức** | Chia đều đầy đủ **6 môn thể thao** *(Bóng đá, Cầu lông, Pickleball, Tennis, Bóng rổ, Bóng chuyền)* |
| **3** | `owner3@sportlink.vn` | `password123` | **Lê Quốc Bảo**<br>*(Chủ sân Làng Đại Học)* | 1. **Tổ Hợp Thể Thao Làng Đại Học Thủ Đức**<br>2. **Trung Tâm Thể Thao Sinh Viên ĐHQG - Khu B** | Chia đều đầy đủ **6 môn thể thao** *(Bóng đá, Cầu lông, Pickleball, Tennis, Bóng rổ, Bóng chuyền)* |

#### Các đường dẫn kiểm thử nhanh sau khi đăng nhập quyền `OWNER`:
1. **Quản lý Cơ sở sân & Danh sách Sân con (S2-02):** `http://localhost:5173/owner/courts`
   - Hỗ trợ chế độ xem **"Tổng hợp tất cả cơ sở của tôi (18 sân con)"** hoặc bấm chọn từng Cơ sở bên cột trái để lọc riêng **9 sân con** của cơ sở đó.
   - Tích hợp tìm kiếm, lọc theo môn thể thao, lọc trạng thái và thanh phân trang (`4 / 6 / 8 sân mỗi trang`).
2. **Quản lý Danh mục Loại môn thể thao (S2-03):** `http://localhost:5173/owner/sports`
   - Hiển thị 6 môn thể thao (`Bóng đá`, `Cầu lông`, `Pickleball`, `Tennis`, `Bóng rổ`, `Bóng chuyền`) chia trang cân đối (`3 môn / trang`), kèm bảng chi tiết các sân con của Chủ sân đang đăng nhập thuộc từng môn.
3. **Lịch đặt sân (liên kết trực tiếp với danh sách Sân con):** `http://localhost:5173/owner/schedule`

---

## 5. Cấu trúc dự án

```
QuanLySan/
├── backend/          # API Server (Node.js + Express 5)
│   └── src/
│       ├── modules/  # Các module nghiệp vụ (auth, courts, bookings, matches)
│       └── core/     # Middleware, config DB, utils
│
└── app/              # Frontend (React 19 + TypeScript + Vite)
    └── src/
        ├── features/ # Các tính năng (auth, booking, matches, courts...)
        └── shared/   # Component, layout, store, utils dùng chung
```

---

## 6. Quy ước làm việc nhóm

- **Mỗi tính năng** làm trên một branch riêng: `feature/tên-tính-năng`
- **Không push thẳng** lên branch `main`
- **Không commit** file `.env` hoặc thư mục `node_modules`
- Trước khi push, đảm bảo code chạy được trên máy bạn
