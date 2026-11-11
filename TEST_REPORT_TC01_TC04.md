# BIÊN BẢN KẾT QUẢ KIỂM THỬ CHÉO GIÁ ĐỘNG (TC01) & PHÂN QUYỀN RBAC (TC04)

- **Mã công việc**: `S2-12` – `[6.0] Test chéo giá động và khung giờ (TC01) và ghi lỗi`
- **Sprint**: Sprint 2 – Phân hệ Chủ sân & Nhân viên (WBS 3.x)
- **Người thực hiện**: Đặng Quang Luân (`@quangluan`)
- **Ngày thực hiện**: 11/11/2026
- **Lệnh thực thi tự động**:
  - `cd backend && npm run test:tc01`
  - `cd backend && npm run test:tc04`
  - `cd backend && npm run test:luan`

---

## 1. Kết quả Kiểm thử Hàm Tính Giá Động & Biên Khung Giờ (TC01)

- **File kịch bản**: [`backend/src/scripts/test_tc01_dynamic_pricing.js`](file:///d:/SportLink/QuanLySanTheThao/backend/src/scripts/test_tc01_dynamic_pricing.js)
- **Hàm kiểm thử**: `calculateDynamicPrice` trong [`booking.service.js`](file:///d:/SportLink/QuanLySanTheThao/backend/src/modules/bookings/booking.service.js)

| Mã TC | Kịch bản kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC01-1** | Đặt sân trọn vẹn trong khung giờ thường (Off-Peak) | Ngày thường `2026-11-09`, `08:00 - 10:00` (200.000đ/h) | `400.000 đ` | `400.000 đ` | **PASS** ✅ |
| **TC01-2** | Đặt sân trọn vẹn trong khung giờ cao điểm (Peak Hour) | Ngày thường `2026-11-09`, `17:00 - 19:00` (350.000đ/h) | `700.000 đ` | `700.000 đ` | **PASS** ✅ |
| **TC01-3A** | Đặt sân vắt qua biên khung giờ `16:00 - 18:00` (biên đổi giá lúc `17:00`) | Ngày thường `2026-11-09`, `16:00 - 18:00` (1h×180k + 1h×320k) | `500.000 đ` | `500.000 đ` | **PASS** ✅ |
| **TC01-3B** | Đặt sân vắt qua biên khung giờ `15:00 - 17:00` (biên đổi giá lúc `16:00`) | Ngày thường `2026-11-09`, `15:00 - 17:00` (1h×200k + 1h×350k) | `550.000 đ` | `550.000 đ` | **PASS** ✅ |
| **TC01-4** | Đặt sân vắt qua biên khung giờ có bước lẻ 30 phút | Ngày thường `2026-11-09`, `15:30 - 17:00` (0.5h×200k + 1h×350k) | `450.000 đ` | `450.000 đ` | **PASS** ✅ |
| **TC01-5** | Đặt sân vào ngày cuối tuần (`WEEKEND`) vắt qua biên | Chủ Nhật `2026-11-08`, `15:00 - 17:00` (1h×280k + 1h×420k) | `700.000 đ` | `700.000 đ` | **PASS** ✅ |
| **TC01-6** | Đặt sân vào ngày lễ (`HOLIDAY` - Quốc khánh `02/09`) | Ngày lễ `2026-09-02`, `18:00 - 20:00` (2h×450k) | `900.000 đ` | `900.000 đ` | **PASS** ✅ |
| **TC01-7** | Kiểm tra dữ liệu đầu vào bất hợp lệ: Giờ kết thúc <= Giờ bắt đầu | `startTime = 18:00`, `endTime = 16:00` | Ném lỗi `HTTP 400` | Ném lỗi `HTTP 400` | **PASS** ✅ |
| **TC01-8** | Kiểm tra khung giờ ngoài giờ mở cửa (`06:00 – 23:00`) | `04:30 - 06:30` và `22:00 - 23:30` | Ném lỗi `HTTP 400` | Ném lỗi `HTTP 400` | **PASS** ✅ |

---

## 2. Kết quả Kiểm thử Phân quyền Chéo RBAC & Cô lập Dữ liệu (TC04)

- **File kịch bản**: [`backend/src/scripts/test_tc04_rbac.js`](file:///d:/SportLink/QuanLySanTheThao/backend/src/scripts/test_tc04_rbac.js)

| Mã TC | Kịch bản kiểm thử phân quyền & bảo mật | Vai trò thực hiện | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **TC04-1** | Truy cập API Dashboard Doanh thu (`/api/analytics/revenue`) & Tỷ lệ lấp đầy (`/api/analytics/occupancy`) | `STAFF`, `PLAYER` | Chặn truy cập `HTTP 403 Forbidden` | `HTTP 403 Forbidden` | **PASS** ✅ |
| **TC04-2** | Cô lập dữ liệu `owner_id` khi Chủ sân chưa tạo sân nào | `OWNER` (0 sân) | Trả về danh sách rỗng `[]`, không lộ sân của Owner khác | `courts.length = 0` | **PASS** ✅ |
| **TC04-3** | Chủ sân B cố tình đặt sân hoặc khóa bảo trì trên sân thuộc sở hữu của Chủ sân A | `OWNER 2` | Chặn thao tác chéo `HTTP 403 Forbidden` | `HTTP 403 Forbidden` | **PASS** ✅ |
| **TC04-4** | Nhân viên (`STAFF`) cố tình thao tác trên sân không nằm trong bảng phân công `court_staff` | `STAFF` | Chặn thao tác `HTTP 403 COURT_ACCESS_DENIED` | `HTTP 403 Forbidden` | **PASS** ✅ |
| **TC04-5** | Chống IDOR khi Chủ sân khác cố tình xem lịch sử hoặc khóa tài khoản khách hàng không thuộc cụm sân của mình | `OWNER` khác | Chặn truy cập `HTTP 403 / 404` | `HTTP 403 / 404` | **PASS** ✅ |

---

## 3. Ghi nhận lỗi phát hiện trong quá trình Test Chéo & Trạng thái khắc phục

| Mã lỗi | Mô tả lỗi phát hiện khi kiểm thử chéo | Mức độ | Trạng thái xử lý |
| :--- | :--- | :---: | :---: |
| **BUG-S2-01** | Hàm `calculateDynamicPrice` chưa chặn khung giờ đặt ngoài giờ mở cửa (`06:00 - 23:00`) và chưa tự động nhận diện ngày lễ cố định. | Medium | **Đã khắc phục (Fixed)** ✅ |
| **BUG-S2-02** | Khi chuyển trạng thái đơn sang `COMPLETED` (Thu tiền & Hoàn tất), hệ thống ghi nhận `FULL_PAYMENT` bằng toàn bộ `total_price` làm cộng đúp số tiền đã cọc (`DEPOSIT`). | High | **Đã khắc phục (Fixed)** ✅ |
| **BUG-S2-03** | Điều kiện `OR NOT EXISTS (SELECT 1 FROM courts WHERE owner_id = @ownerId)` làm lộ dữ liệu sân và doanh thu khi tài khoản Owner mới chưa có sân. | Critical | **Đã khắc phục (Fixed)** ✅ |
| **BUG-S2-04** | Truy vấn bảng giao dịch (`transactions`) trong Dashboard doanh thu thiếu điều kiện lọc theo khoảng ngày `@startDate` – `@endDate`. | Medium | **Đã khắc phục (Fixed)** ✅ |
| **BUG-S2-05** | Ngưỡng cảnh báo khung giờ vắng khách trong `getOccupancyAnalytics` đặt `< 25%` thay vì `< 30%` theo đặc tả thẻ. | Low | **Đã khắc phục (Fixed)** ✅ |

---

## 4. Kết quả Kiểm thử Tự động Toàn diện 5 Chức năng Sprint 2 (`npm run test:luan`)

- **File kịch bản**: [`backend/src/scripts/test_luan_sprint2_all.js`](file:///d:/SportLink/QuanLySanTheThao/backend/src/scripts/test_luan_sprint2_all.js)

| Mã TC | Hạng mục WBS | Kịch bản kiểm thử tự động E2E | Trạng thái |
| :--- | :--- | :--- | :---: |
| **S2-05.1** | `[3.1] Lịch sân` | Lấy dữ liệu Lịch sân theo Ngày/Tuần/Tháng (13 sân, 2 cơ sở, chuẩn tiếng Việt UTF-8) | **PASS** ✅ |
| **S2-05.2** | `[3.1] Lịch sân` | Bộ lọc đa tầng theo Cơ sở (`facilityId`), Môn thể thao (`sportId`), Sân con (`courtId`), Trạng thái (`status`) | **PASS** ✅ |
| **S2-05.3** | `[3.1] Lịch sân` | Tạo đơn đặt sân tại quầy, chặn trùng giờ (`HTTP 409`), luồng `Check-in -> Hoàn thành` & thu đúng số tiền còn thiếu | **PASS** ✅ |
| **S2-05.4** | `[3.1] Lịch sân` | Khóa bảo trì sân, chặn đặt sân trùng giờ bảo trì (`HTTP 409`) và mở khóa bảo trì | **PASS** ✅ |
| **S2-06.1** | `[3.1] Khách hàng CRM` | Lấy danh sách khách hàng CRM kèm chỉ số ca đặt hôm nay (`todayActiveBookings`) & chờ thu cọc (`unpaidDepositBookings`) | **PASS** ✅ |
| **S2-06.2** | `[3.1] Khách hàng CRM` | Tra cứu lịch sử đặt sân chi tiết của khách hàng & đối soát `paidAmount` / `remainingAmount` | **PASS** ✅ |
| **S2-06.3** | `[3.1] Khách hàng CRM` | Cập nhật điểm uy tín, khóa khách hàng (`LOCKED`) chặn đặt sân mới (`HTTP 403`) & mở khóa lại | **PASS** ✅ |
| **S2-09.1** | `[3.3] Doanh thu` | Dashboard doanh thu hoạt động chính xác ở cả 4 chu kỳ: Ngày (`day`), Tuần (`week`), Tháng (`month`), Năm (`year`) | **PASS** ✅ |
| **S2-09.2** | `[3.3] Doanh thu` | Đối soát tổng doanh thu cộng theo từng sân con khớp 100% với tổng doanh thu toàn kỳ | **PASS** ✅ |
| **S2-10.1** | `[3.3] Tỷ lệ lấp đầy` | Thống kê tỷ lệ lấp đầy sân, ma trận Heatmap `8×7` và phát hiện khung giờ vắng `< 30%` kèm gợi ý khuyến mãi | **PASS** ✅ |
| **S2-12 (TC01)** | `[6.0] Giá động` | Tách bước nhảy 30 phút qua biên giờ thường/giờ vàng & nhận diện Cuối tuần/Ngày lễ (`02/09`) | **PASS** ✅ |
| **S2-12 (TC04)** | `[6.0] Phân quyền` | Chặn `STAFF` truy cập trang doanh thu (`HTTP 403`) & cô lập dữ liệu chéo giữa các Chủ sân | **PASS** ✅ |


