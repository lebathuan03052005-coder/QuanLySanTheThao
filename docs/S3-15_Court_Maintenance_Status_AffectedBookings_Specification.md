# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & BÁO CÁO NGHIỆM THU: [WBS 3.1.4] TRẠNG THÁI SÂN HOẠT ĐỘNG/BẢO TRÌ: CHẶN ĐẶT SÂN & CẢNH BÁO ĐƠN BỊ ẢNH HƯỞNG (S3-15)

- **Dự án:** Hệ Thống Quản Lý và Đặt Sân Thể Thao Trực Tuyến — **SportLink**
- **Mã công việc (Task ID):** `S3-15`
- **Hạng mục WBS:** `[3.1] Quản lý sân & Lịch sân` (`3.1.4 Trạng thái sân Hoạt động/Bảo trì: chặn đặt sân của Người chơi và cảnh báo đơn bị ảnh hưởng`)
- **Sprint:** Sprint 3 — Tìm sân, Đặt sân, Thanh toán & Xử lý đơn đặt
- **Người phụ trách thực hiện:** Trần Lê Quang Hữu (`@hutrn6`)
- **Thời lượng ước tính:** 6 giờ
- **Hạn hoàn thành (Deadline):** 26/11/2026
- **Trạng thái:** Hoàn thành 100% (Đã kiểm thử E2E & Automated Test 100% PASS)

---

## 1. Mục tiêu & Phạm vi Chức năng

Hạng mục `S3-15` (`[3.1.4] Trạng thái sân Hoạt động/Bảo trì`) giải quyết bài toán vận hành thực tế khi Chủ sân cần đưa một sân con vào trạng thái **Bảo trì (`MAINTENANCE`)** nhưng trên sân đó đã có các đơn đặt trước của Người chơi:

1. **Quản lý 3 trạng thái vận hành của Sân con (`ACTIVE` / `MAINTENANCE` / `INACTIVE`):**
   - `ACTIVE` (**Đang mở đặt lịch**): Sân hoạt động bình thường, cho phép Người chơi tìm kiếm, báo giá và đặt sân.
   - `MAINTENANCE` (**🔧 Đang bảo trì**): Sân vẫn hiển thị trên trang Cơ sở và Danh sách sân với huy hiệu **"🔧 Đang bảo trì"**, nút đặt sân bị khóa và mọi yêu cầu tạo đơn đặt mới trên sân này đều bị chặn ở tầng Backend (`HTTP 400`).
   - `INACTIVE` (**Tạm đóng**): Ẩn khỏi danh sách đặt sân công khai và ngừng nhận lịch.

2. **Quét & Cảnh báo danh sách đơn đặt sân bị ảnh hưởng (`GET /api/facilities/courts/:courtId/affected-bookings`):**
   - Ngay khi Chủ sân nhấn nút **"🔧 Bảo trì"** hoặc **"Tạm đóng"** trên một sân con, hệ thống lập tức quét toàn bộ các đơn đặt sân đang hiệu lực (`PENDING`, `CONFIRMED`, `CHECKED-IN`) từ ngày hiện tại trở đi trên sân đó.
   - Hiển thị hộp cảnh báo đỏ trực quan liệt kê số lượng đơn bị ảnh hưởng, mã đơn, tên Người chơi, ngày/khung giờ và tổng tiền của từng đơn.

3. **Tự động Thông báo hoặc Hủy & Hoàn tiền 100% các đơn bị ảnh hưởng (`PATCH /api/facilities/courts/:courtId/status`):**
   - Chủ sân có thể nhập **Lý do bảo trì** và chọn 1 trong 2 phương án xử lý các đơn bị ảnh hưởng:
     - **Phương án 1 (Mặc định — Giữ đơn & Gửi cảnh báo):** Chuyển sân sang `MAINTENANCE` để chặn đặt mới, đồng thời tự động gửi thông báo cảnh báo bảo trì kèm lý do tới tất cả Người chơi có đơn sắp tới để chủ động liên hệ đổi giờ.
     - **Phương án 2 (Tự động hủy & Hoàn tiền 100% — `cancelAffected: true`):** Tự động hủy toàn bộ các đơn bị ảnh hưởng, hoàn lại 100% số tiền khách đã thanh toán/đặt cọc (`REFUNDED`) và gửi thông báo hoàn tiền tới từng Người chơi.

---

## 2. Thiết kế API Backend (`backend/src/modules/facilities/` & `bookings/`)

| Phương thức | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/facilities/courts/:courtId/affected-bookings` | Owner | Kiểm tra và trả về danh sách các đơn đặt sân sắp tới bị ảnh hưởng trên sân con. |
| `PATCH` | `/api/facilities/courts/:courtId/status` | Owner | Chuyển trạng thái sân (`ACTIVE`, `MAINTENANCE`, `INACTIVE`), gửi thông báo cảnh báo hoặc tự động hủy/hoàn tiền 100% các đơn bị ảnh hưởng. |
| `POST` | `/api/bookings` & `/api/bookings/quote` | Public / Auth | Tự động kiểm tra `court.status === 'MAINTENANCE'` để trả về `isAvailable: false` và chặn tạo đơn mới với mã lỗi `HTTP 400`. |

---

## 3. Giao diện Người dùng (Frontend)

1. **Phía Chủ sân (`app/src/features/facilities/FacilityManagementPage.tsx`):**
   - Bổ sung bộ lọc trạng thái `"Đang bảo trì (MAINTENANCE)"`, huy hiệu trạng thái màu vàng hổ phách **"🔧 Đang bảo trì"** và nút **"🔧 Bảo trì"** / **"✓ Mở hoạt động"** trên từng thẻ sân con.
   - Modal xác nhận chuyển trạng thái tự động tải và hiển thị danh sách các đơn đặt sân sắp tới bị ảnh hưởng, ô nhập lý do bảo trì và tùy chọn tự động hủy & hoàn tiền 100%.
2. **Phía Người chơi (`FacilityDetailPage.tsx` & `CourtListPage.tsx`):**
   - Các sân đang có trạng thái `MAINTENANCE` hiển thị rõ huy hiệu **"🔧 Đang bảo trì"** và vô hiệu hóa nút đặt sân để Người chơi nhận biết ngay từ danh sách sân.

---

## 4. Kết quả Kiểm thử Tự động (Automated Test Report)

| Mã Test | Nội dung kiểm thử | Kết quả |
| :--- | :--- | :---: |
| `S3-15.1` | Phát hiện chính xác danh sách đơn đặt sân sắp tới bị ảnh hưởng trước khi chuyển sân sang Bảo trì | **PASS** |
| `S3-15.2` | Chuyển trạng thái sân sang `MAINTENANCE` trả về cảnh báo đơn bị ảnh hưởng & gửi thông báo cho Người chơi | **PASS** |
| `S3-15.3` | API danh sách sân trả về trạng thái `MAINTENANCE` để giao diện hiển thị huy hiệu "🔧 Đang bảo trì" | **PASS** |
| `S3-15.4` | API Báo giá tự động báo sân không khả dụng (`isAvailable = false`) kèm lý do sân đang bảo trì | **PASS** |
| `S3-15.5` | Chặn hoàn toàn việc tạo đơn đặt sân mới khi sân đang ở trạng thái Bảo trì (`HTTP 400`) | **PASS** |
| `S3-15.6` | Khôi phục trạng thái sân về Hoạt động (`ACTIVE`) thành công | **PASS** |
