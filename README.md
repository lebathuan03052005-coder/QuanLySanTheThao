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

## 4. Kiểm tra kết nối Database

Sau khi cấu hình `.env` xong, chạy lệnh sau trong thư mục `backend` để xác nhận kết nối thành công:

```bash
node test-db.js
```

Kết quả thành công trông như thế này:

```
Đang kết nối tới: localhost:1433 | tên_database
✅ Kết nối thành công!
   Database: tên_database
   Login as: sa
   Server time: 2026-10-29T...
```

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
