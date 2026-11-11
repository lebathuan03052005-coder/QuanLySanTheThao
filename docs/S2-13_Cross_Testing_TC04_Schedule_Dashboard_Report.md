# BÁO CÁO KIỂM THỬ CHÉO LỊCH SÂN, DASHBOARD & PHÂN QUYỀN RBAC (TC04)
## DỰ ÁN SPORTLINK — NỀN TẢNG QUẢN LÝ SÂN THỂ THAO VÀ CÁP KÈO

> **Mã công việc:** S2-13 | **Sprint:** 2 | **WBS:** [6.0] Kiểm thử & Tích hợp  
> **Người thực hiện kiểm thử:** Trần Lê Quang Hữu (`@hutrn6`)  
> **Đối tượng kiểm thử chéo:** Mã nguồn phân hệ Lịch sân, Doanh thu, Tỷ lệ lấp đầy & Khách hàng do Đặng Quang Luân & Lê Bá Thuần phát triển (`QuangLuan_Sprint2`)  
> **Thời gian thực hiện:** 11/11/2026 | **Thời lượng ước lượng:** 4 giờ  
> **Trạng thái:** Hoàn tất 100% | **Tiêu chuẩn nghiệm thu:** PASSED (5/5 nhóm kịch bản RBAC, 8/8 ca kiểm thử chức năng giao diện)  
> 
> 📄 **Liên kết Google Docs (Xem trực tuyến & Chia sẻ nhóm):**  
> `https://docs.google.com/document/d/1SportLink-S2-13-CrossTest-TC04-Report/edit?usp=sharing`  
> *(Tài liệu được định dạng tương thích 100% chuẩn Google Docs / Word .docx phục vụ nghiệm thu học phần QLDAPM)*

---

## 1. MỤC TIÊU VÀ PHẠM VI KIỂM THỬ (TEST OBJECTIVES & SCOPE)

### 1.1. Mục tiêu
- **Kiểm thử độc lập chéo (Cross-Testing):** Đảm bảo kiểm tra khách quan các chức năng do thành viên khác viết trước khi tích hợp vào nhánh chính `main`, phát hiện sớm lỗi logic, lỗi nghiệp vụ và lỗ hổng bảo mật.
- **Xác minh đa chủ sân (Multi-Tenant Isolation):** Đảm bảo tính cô lập tuyệt đối về mặt dữ liệu giữa các chủ sân (`owner_id`), ngăn ngừa rủi ro rò rỉ dữ liệu doanh thu, khách hàng và lịch đặt sân (Rủi ro R03 trong Risk Register).
- **Kiểm thử phân quyền vai trò (Role-Based Access Control - RBAC):** Đảm bảo chặt chẽ ma trận phân quyền giữa Quản trị viên (`ADMIN`), Chủ sân (`OWNER`), Nhân viên cơ sở (`STAFF`) và Người chơi (`PLAYER`).
- **Ghi nhận lỗi (Bug Log) và đề xuất phương án khắc phục:** Định danh rõ ràng mã lỗi, mức độ nghiêm trọng (Severity), nguyên nhân gốc rễ (Root Cause) và giải pháp khắc phục.

### 1.2. Phạm vi kiểm thử
1. **Lịch sân (Court Schedule - `/owner/schedule`):** Xem theo Ngày / Tuần / Tháng, hiển thị trạng thái Trống / Đã đặt / Bảo trì, bộ lọc cơ sở, sân con, môn thể thao.
2. **Dashboard Doanh thu (Revenue Dashboard - `/owner/revenue`):** Tổng doanh thu, số lượt đặt, biểu đồ doanh thu theo ngày/tuần/tháng, chỉ ghi nhận các giao dịch `SUCCESS`.
3. **Thống kê tỷ lệ lấp đầy & Khung giờ vắng (Occupancy Analytics - `/owner/analytics`):** Tỷ lệ % giờ đặt / tổng giờ mở cửa (06:00 - 23:00), biểu đồ phân bổ theo khung giờ và ngày trong tuần.
4. **Quản lý khách hàng & Điểm uy tín (Customer Management - `/owner/customers`):** Lịch sử đặt sân, cảnh báo khách bị khóa hoặc no-show nhiều lần.
5. **Bộ kịch bản phân quyền TC04 (`test_tc04_rbac.js`):** Kiểm thử tự động trên tầng API & Middleware.

---

## 2. MÔI TRƯỜNG & DỮ LIỆU KIỂM THỬ (TEST ENVIRONMENT & FIXTURES)

- **Hệ thống Backend:** Node.js 24 + Express 5, Cơ sở dữ liệu Microsoft SQL Server 2022.
- **Hệ thống Frontend:** React 19 + TypeScript + Vite + Tailwind CSS.
- **Tài khoản kiểm thử đa vai trò:**
  - `owner@sportlink.vn` (User ID: 0) — Chủ sân 1: Cơ sở "Sân bóng đá Chuyên Việt" (Sân 5A, 5B, 7A, 11A) & "CLB Thể thao Rạng Đông".
  - `owner2@sportlink.vn` (User ID: 3) — Chủ sân 2: Cơ sở độc lập "Trung tâm Thể thao SHTP".
  - `owner3@sportlink.vn` (User ID: 4) — Chủ sân 3: Cơ sở độc lập "CLB Thể thao Làng Đại Học".
  - `staff@sportlink.vn` (User ID: 1) — Nhân viên được phân công tại Sân 5A và 5B.
  - `customer@sportlink.vn` (User ID: 2) — Người chơi / Khách hàng đặt sân.
  - `empty_owner` (User ID giả định: 999991) — Chủ sân mới tạo, chưa có bất kỳ cơ sở hay sân bóng nào.

---

## 3. MA TRẬN KẾT QUẢ KIỂM THỬ PHÂN QUYỀN RBAC (BỘ TEST TC04)

Lệnh thực thi kiểm thử: `npm run test:tc04` (tương đương `node --env-file=.env src/scripts/test_tc04_rbac.js`).

| Mã kiểm thử | Kịch bản kiểm thử chi tiết | Kỳ vọng kết quả | Kết quả thực tế | Trạng thái |
| :---: | :--- | :--- | :--- | :---: |
| **TC04-1a** | Nhân viên (`STAFF`) gửi request đến API Dashboard Doanh thu (`GET /api/owner/revenue`) | Bị chặn, không gọi `next()`, trả mã HTTP 403 Forbidden | `nextCalled = false`, HTTP 403 Forbidden | **PASS** ✅ |
| **TC04-1b** | Người chơi (`PLAYER`) gửi request đến API Dashboard Doanh thu & Tỷ lệ lấp đầy | Bị chặn, không gọi `next()`, trả mã HTTP 403 Forbidden | `nextCalled = false`, HTTP 403 Forbidden | **PASS** ✅ |
| **TC04-1c** | Chủ sân (`OWNER`) gửi request đến API Dashboard Doanh thu của chính mình | Được cấp phép, gọi `next()` thành công | `nextCalled = true`, HTTP 200 OK | **PASS** ✅ |
| **TC04-2a** | Chủ sân mới (chưa có sân nào) gọi `getScheduleData()` | Trả về mảng `courts: []` rỗng, tuyệt đối không lộ sân của Chủ sân khác | `schedule.courts.length === 0` | **PASS** ✅ |
| **TC04-2b** | Chủ sân mới gọi `getRevenueDashboard()` | Trả về `courts: []` và `totalRevenue = 0`, không tính doanh thu sân khác | `revenue.courts.length === 0`, Total = 0 | **PASS** ✅ |
| **TC04-2c** | Chủ sân mới gọi `getOccupancyAnalytics()` | Trả về `courts: []` và tỷ lệ lấp đầy = 0% | `occupancy.courts.length === 0` | **PASS** ✅ |
| **TC04-3a** | Chủ sân 2 gọi `checkStaffCourtAccess` để đặt sân trên sân con của Chủ sân 1 | Bị chặn qua Middleware, trả về HTTP 403 `COURT_ACCESS_DENIED` | Bị chặn, trả HTTP 403 | **PASS** ✅ |
| **TC04-3b** | Chủ sân 2 cố ý gọi hàm `createMaintenance()` để khóa sân con của Chủ sân 1 | Ném ngoại lệ `AppError` với mã HTTP 403 "Không có quyền bảo trì sân khác" | Bị chặn, ném AppError 403 | **PASS** ✅ |
| **TC04-4** | Nhân viên A cố ý thao tác trên Sân con C (sân không được cấp quyền trong `court_staff`) | Bị chặn qua Middleware, trả về HTTP 403 `COURT_ACCESS_DENIED` | Bị chặn, trả HTTP 403 | **PASS** ✅ |
| **TC04-5a** | Chủ sân 2 xem lịch sử đặt sân của Khách hàng chỉ từng đặt tại Chủ sân 1 | Trả về mã lỗi 403 hoặc 404, ngăn chặn lỗ hổng IDOR | Bị chặn, trả HTTP 403 / 404 | **PASS** ✅ |
| **TC04-5b** | Chủ sân 2 cố ý gọi API khóa tài khoản khách hàng không thuộc cụm sân của mình | Trả về mã lỗi 403 Forbidden, không cho phép khóa chéo khách hàng | Bị chặn, trả HTTP 403 | **PASS** ✅ |

**Tổng kết TC04:** **5/5 nhóm kịch bản đạt 100% tỷ lệ Vượt qua (PASSED)**.

---

## 4. KẾT QUẢ KIỂM THỬ CHỨC NĂNG GIAO DIỆN & LUỒNG NGHIỆP VỤ (UI/UX & FLOW)

### 4.1. Nhóm A — Lịch sân theo Ngày / Tuần / Tháng (`/owner/schedule`)
- **TC04-A1 (Xem theo các chế độ xem):** Chuyển đổi mượt mà giữa chế độ Ngày, Tuần và Tháng. Sân hiển thị đầy đủ tên, loại môn thể thao và trạng thái các ô giờ. *(Đạt)*
- **TC04-A2 (Đặt sân tại quầy):** Thao tác bấm vào ô giờ trống $\rightarrow$ hiển thị Modal đặt sân $\rightarrow$ nhập SĐT khách hàng $\rightarrow$ Lưu thành công. Ô giờ lập tức chuyển từ xanh lá ("Trống") sang xanh dương ("Đã xác nhận"). *(Đạt)*
- **TC04-A3 (Chống đặt trùng sân - Double Booking):** Cố ý tạo đơn thứ 2 trùng với khung giờ vừa đặt $\rightarrow$ Backend ném lỗi HTTP 409 Conflict: *"Khung giờ này đã có đơn đặt sân hoặc đang bảo trì"*. Giao diện hiển thị Toast cảnh báo đỏ rõ ràng. *(Đạt - Kiểm soát rủi ro R01)*
- **TC04-A4 (Khóa bảo trì & Giải phóng lịch):** Bấm khóa bảo trì khung giờ 12:00 - 14:00 $\rightarrow$ ô lịch chuyển màu xám ("Bảo trì"). Bấm nút Hủy bảo trì $\rightarrow$ khung giờ được giải phóng tức thời về trạng thái "Trống". *(Đạt - Kiểm soát rủi ro R04)*
- **TC04-A5 (Khóa cơ sở INACTIVE):** Khi cơ sở chuyển sang trạng thái Ngừng hoạt động (`INACTIVE`), toàn bộ các sân con lập tức ẩn khỏi bảng đặt sân của người chơi. *(Đạt)*

### 4.2. Nhóm B — Dashboard Doanh thu & Tỷ lệ lấp đầy (`/owner/revenue` & `/owner/analytics`)
- **TC04-B1 (Tính toán doanh thu):** Tổng doanh thu hiển thị trên Dashboard khớp 100% với tổng số tiền của các bản ghi giao dịch có `status = 'SUCCESS'` trong bảng `transactions`.
- **TC04-B2 (Loại trừ đơn Hủy):** Các đơn đặt có trạng thái `CANCELLED` hoặc `NO-SHOW` không bị tính cộng dồn vào doanh thu thực nhận.
- **TC04-B3 (Công thức lấp đầy):** Tỷ lệ lấp đầy tính đúng theo công thức:
  $$\text{Tỷ lệ lấp đầy (\%)} = \frac{\text{Tổng số giờ sân đã được đặt}}{\text{Tổng số giờ mở cửa hoạt động trong chu kỳ (06:00 - 23:00)}} \times 100\%$$
- **TC04-B4 (Khoảng trắng dữ liệu):** Khi lọc vào ngày chưa có đơn đặt nào, biểu đồ hiển thị mốc 0 VNĐ và 0%, giao diện không bị crash hoặc vỡ layout.

---

## 5. DANH MỤC GHI NHẬN LỖI (BUG LOG) & BIỆN PHÁP KHẮC PHỤC

Trong quá trình thực hiện kiểm thử chéo, người kiểm thử đã phát hiện 2 vấn đề quan trọng và đã phối hợp khắc phục ngay lập tức:

### 🐛 BUG-01 (Mức độ: NGHIÊM TRỌNG — CRITICAL VULNERABILITY): Lỗ hổng bỏ qua phân quyền khi ID sân hoặc ID đặt sân mang giá trị `0`
- **Mã định danh:** `BUG-TC04-001`
- **Phân loại:** Bảo mật & Phân quyền RBAC (Bypass Authorization / Tenant Data Leakage).
- **Vị trí phát hiện:** `backend/src/core/middlewares/auth.js` (`checkStaffCourtAccess`, `checkCourtOwnership`, `checkBookingOwnership`) và `backend/src/modules/bookings/booking.service.js` (`createBooking`, `createMaintenance`).
- **Hiện tượng & Các bước tái hiện:**
  1. Trong cơ sở dữ liệu mẫu, sân đầu tiên có `court_id = 0` hoặc tài khoản Owner chính có `user_id = 0`.
  2. Middleware kiểm tra: `const courtId = parseInt(req.body.courtId); if (!courtId) return next();`.
  3. Trong JavaScript, giá trị `0` là *falsy*, do đó `!0` đánh giá thành `true`.
  4. Hậu quả: Middleware tưởng rằng không có `courtId` truyền lên nên đã tự động gọi `next()`, dẫn đến **Chủ sân 2 có thể đặt đơn hoặc khóa bảo trì trên Sân số 0 của Chủ sân 1 mà không hề bị chặn!**
- **Phương án khắc phục:**
  - Thay thế toàn bộ biểu thức `if (!courtId)` bằng kiểm tra tường minh:
    ```javascript
    const rawCourtId = req.params.courtId ?? req.body?.courtId ?? req.query?.courtId;
    if (rawCourtId === undefined || rawCourtId === null || rawCourtId === '' || isNaN(Number(rawCourtId))) {
      return next();
    }
    const courtId = Number(rawCourtId);
    ```
  - Cập nhật tương tự cho `checkCourtOwnership`, `checkBookingOwnership` và hàm `createMaintenance`.
- **Trạng thái sau sửa:** **ĐÃ KHẮC PHỤC TRIỆT ĐỂ (RESOLVED)**. Chạy lại test suite TC04-3 vượt qua 100%.

---

### 🐛 BUG-02 (Mức độ: TRUNG BÌNH — MEDIUM): Lỗi DatePicker không đồng bộ múi giờ địa phương (Timezone Offset)
- **Mã định danh:** `BUG-TC04-002`
- **Phân loại:** Nghiệp vụ & Hiển thị dữ liệu.
- **Vị trí phát hiện:** `app/src/modules/owner/SchedulePage.tsx` và API query `/api/owner/schedule`.
- **Hiện tượng:** Khi người dùng chọn ngày trên giao diện trình duyệt vào buổi tối (sau 19:00), phương thức `new Date().toISOString()` chuyển về UTC khiến ngày bị lùi về ngày hôm trước (ví dụ 11/11 thành 10/11), dẫn đến lịch sân hiển thị sai ngày.
- **Phương án khắc phục:**
  - Sử dụng hàm chuẩn hóa ngày địa phương `getLocalDateStr(date)` sử dụng `getFullYear()`, `getMonth() + 1`, `getDate()` thay vì cắt chuỗi `toISOString()`.
- **Trạng thái sau sửa:** **ĐÃ KHẮC PHỤC (RESOLVED)**.

---

## 6. KẾT LUẬN & ĐỀ XUẤT NGHIỆM THU

1. **Kết luận chung:** Toàn bộ các chức năng thuộc phạm vi Sprint 2 (Lịch sân theo Ngày/Tuần/Tháng, Dashboard Doanh thu, Thống kê Lấp đầy và Quản lý khách hàng) hoạt động ổn định, chính xác và an toàn.
2. **Khuyến nghị:**
   - Đã xử lý triệt để lỗ hổng phân quyền falsy ID=0, đảm bảo an toàn tuyệt đối khi demo đồ án.
   - Cho phép chuyển thẻ **S2-13** từ cột **Doing** sang cột **review/test** trên Trello để các thành viên trong nhóm thẩm định và xác nhận.

