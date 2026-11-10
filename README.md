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

## 4. Kiểm tra kết nối Database & Danh sách Tài khoản Kiểm thử (WBS 3.1)

Sau khi cấu hình `.env` xong, chạy lệnh sau trong thư mục `backend` để xác nhận kết nối thành công:

```bash
node test-db.js
```

### 📌 Chú thích 3 Tài khoản Chủ sân (`OWNER`) dùng để Test Quản lý Cơ sở, Sân con & Môn thể thao

Khi khởi chạy Backend (`npm run dev`), hệ thống sẽ **tự động đồng bộ cấu trúc bảng** (`dbo.facilities`, `dbo.courts`, `dbo.sports`) và **khởi tạo sẵn 3 tài khoản Chủ sân độc lập** để cả nhóm dễ dàng kiểm thử phân quyền sở hữu và phân trang:

- **Mật khẩu đăng nhập chung cho cả 3 tài khoản:** `password123`
- **Trang đăng nhập:** `http://localhost:5173/login`
- **Nguyên tắc phân quyền (Strict Owner Isolation):** Tài khoản Chủ sân nào đăng nhập thì **chỉ nhìn thấy và thêm/sửa/khóa được đúng Cơ sở & Sân con thuộc sở hữu của tài khoản đó** (không hiển thị cơ sở mặc định rỗng cho mọi tài khoản và không sửa chéo sân của chủ sân khác).

| STT | Email đăng nhập | Mật khẩu | Họ tên Chủ sân | Cơ sở sân thuộc quyền sở hữu (2 cơ sở / chủ sân) | Số lượng sân con & Phân bổ môn thể thao |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | `owner@sportlink.vn` | `password123` | **Trần Chủ Sân**<br>*(Khu vực Man Thiện - Hiệp Phú)* | 1. **Cụm Sân Bóng Đá SportLink Man Thiện** *(9 sân)*<br>2. **CLB Cầu Lông SportLink Arena Hiệp Phú** *(9 sân)* | **Tổng 18 sân con** chia đều cho **6 môn thể thao** *(3 Bóng đá, 3 Cầu lông, 3 Pickleball, 3 Tennis, 3 Bóng rổ, 3 Bóng chuyền)* |
| **2** | `owner2@sportlink.vn` | `password123` | **Nguyễn Minh Hoàng**<br>*(Chủ sân Khu CNC)* | 1. **Trung Tâm Pickleball & Tennis SportLink SHTP** *(9 sân)*<br>2. **Nhà Thi Đấu Bóng Rổ Đặng Văn Bi Thủ Đức** *(9 sân)* | **Tổng 18 sân con** chia đều cho **6 môn thể thao** *(3 Bóng đá, 3 Cầu lông, 3 Pickleball, 3 Tennis, 3 Bóng rổ, 3 Bóng chuyền)* |
| **3** | `owner3@sportlink.vn` | `password123` | **Lê Hoàng Phúc**<br>*(Chủ sân Làng Đại Học)* | 1. **Khu Liên Hợp Thể Thao Sinh Viên Quốc Gia** *(9 sân)*<br>2. **Sân Bóng Chuyền & Cầu Lông Linh Trung** *(9 sân)* | **Tổng 18 sân con** chia đều cho **6 môn thể thao** *(3 Bóng đá, 3 Cầu lông, 3 Pickleball, 3 Tennis, 3 Bóng rổ, 3 Bóng chuyền)* |

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
