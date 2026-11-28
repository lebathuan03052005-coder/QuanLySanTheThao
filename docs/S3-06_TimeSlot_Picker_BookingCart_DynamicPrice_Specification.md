# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & BÁO CÁO NGHIỆM THU: [WBS 4.3.1 & 4.3.2] CHỌN KHUNG GIỜ VÀ GIỎ ĐẶT SÂN (TỰ ĐỘNG TÍNH TIỀN) (S3-06)

- **Dự án:** Hệ Thống Quản Lý và Đặt Sân Thể Thao Trực Tuyến — **SportLink**
- **Mã công việc (Task ID):** `S3-06`
- **Hạng mục WBS:** `[4.3] Đặt sân & Thanh toán` (`4.3.1 Chọn khung giờ đặt sân`, `4.3.2 Giỏ đặt sân đa khung giờ & tự động tính tiền theo bảng giá động`)
- **Sprint:** Sprint 3 — Tìm sân, Đặt sân, Thanh toán & Xử lý đơn đặt
- **Người phụ trách thực hiện:** Trần Lê Quang Hữu (`@hutrn6`)
- **Thời lượng ước tính:** 14 giờ
- **Hạn hoàn thành (Deadline):** 26/11/2026
- **Trạng thái:** Hoàn thành 100% (Đã kiểm thử E2E & Automated Test 100% PASS)

---

## 1. Mục tiêu & Phạm vi Chức năng

Hạng mục `S3-06` (`[4.3] Chọn khung giờ và giỏ đặt sân (tự động tính tiền)`) cho phép Người chơi chọn linh hoạt khung giờ đặt sân, xem bảng bóc tách giá động theo từng bước 30 phút và gom nhiều ca đặt sân (cùng sân hoặc khác sân/khác ngày) vào **Giỏ đặt sân (Multi-Slot Booking Cart)** để thanh toán một lần:

1. **Chọn khung giờ thông minh & Bóc tách giá động từng 30 phút (`POST /api/bookings/quote`):**
   - Hỗ trợ chọn ngày đặt sân, giờ bắt đầu, giờ kết thúc và các nút **Chọn nhanh thời lượng** (`1 giờ`, `1.5 giờ`, `2 giờ`, `3 giờ`).
   - Tự động ẩn/khóa các khung giờ đã qua trong ngày hiện tại và hiển thị trực quan các khung giờ đã có người đặt (`bookedSlots`) hoặc đang khóa bảo trì (`maintenanceSlots`).
   - Thuật toán tính giá động (`calculateDynamicPrice` & `slotBreakdown`) tự động nhận diện loại ngày (**Ngày thường `WEEKDAY`**, **Cuối tuần `WEEKEND`**, **Ngày lễ `HOLIDAY`**) và bóc tách từng khung 30 phút để cộng chính xác các ca giao thoa giữa **Giờ thường** và **Giờ cao điểm 🔥**.

2. **Giỏ đặt sân đa khung giờ (`useBookingCartStore` & `BookingCartDrawer.tsx`):**
   - Người chơi có thể nhấn **"🛒 Thêm vào giỏ"** từ trang Chi tiết cơ sở (`/facilities/:id`) hoặc trang Danh sách sân (`/courts`) để gom nhiều khung giờ đặt sân vào giỏ (lưu bền vững trong `localStorage`).
   - Chống trùng lắp ngay tại Client & Server: Nếu người chơi thêm một khung giờ bị chồng lấn với ca đã có của cùng sân và cùng ngày trong giỏ, hệ thống lập tức cảnh báo.

3. **Báo giá Giỏ đặt sân & Thanh toán hàng loạt (`POST /api/bookings/cart/quote` & `POST /api/bookings/cart/checkout`):**
   - API `/api/bookings/cart/quote` tính toán đồng thời toàn bộ các ca trong giỏ, trả về tổng thời lượng (`totalDurationHours`), tổng tiền tự động (`totalCartPrice`), tiền cọc đề xuất (`totalDepositSuggested`), chi tiết `slotBreakdown` của từng ca và trạng thái khả dụng (`allAvailable`, `conflictCount`).
   - API `/api/bookings/cart/checkout` thực hiện khóa chống đặt trùng (`withCourtLock` — Transaction Lock TC02) cho từng sân trong giỏ, khởi tạo đồng loạt các đơn đặt sân và mở ngay Cổng thanh toán trực tuyến (`VNPay Sandbox`, `MoMo Sandbox`, `VietQR Dự phòng`) hoặc giữ chỗ trả sau.

---

## 2. Thiết kế API Backend (`backend/src/modules/bookings/`)

| Phương thức | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bookings/availability` | Public | Lấy danh sách khung giờ đã đặt, lịch bảo trì và bảng giá của sân theo ngày. |
| `POST` | `/api/bookings/quote` | Public | Tính tiền tự động cho 1 ca đặt sân kèm mảng `slotBreakdown` (từng bước 30 phút) & kiểm tra trùng lịch / bảo trì. |
| `POST` | `/api/bookings/cart/quote` | Public | Tính tiền tự động cho toàn bộ Giỏ đặt sân đa khung giờ, kiểm tra trùng lịch DB và trùng chéo nội bộ giỏ. |
| `POST` | `/api/bookings/cart/checkout` | Authenticated | Đặt sân hàng loạt cho toàn bộ Giỏ đặt sân với cơ chế `withCourtLock` chống xung đột đồng thời. |

---

## 3. Giao diện Người dùng (Frontend)

- **`app/src/shared/stores/bookingCartStore.ts`**: Zustand store quản lý danh sách ca trong giỏ và kiểm tra chồng lấn khung giờ.
- **`app/src/features/booking/BookingCartDrawer.tsx`**: Ngăn kéo (Slide-over Drawer) Giỏ đặt sân hiển thị trên toàn hệ thống, tự động gọi API báo giá thời gian thực, hiển thị bóc tách từng ca 30 phút, chọn phương thức thanh toán và nút **"Đặt tất cả & Thanh toán"**.
- **`app/src/shared/components/PlayerNavbar.tsx`**: Nút **"🛒 Giỏ đặt sân"** kèm badge đếm số ca theo thời gian thực trên thanh điều hướng.
- **`app/src/features/facilities/FacilityDetailPage.tsx` & `app/src/features/courts/CourtListPage.tsx`**: Bổ sung thanh chọn nhanh thời lượng (`1h`, `1.5h`, `2h`, `3h`), bảng chi tiết giá từng khung 30 phút và nút **"🛒 Thêm vào giỏ"**.

---

## 4. Kết quả Kiểm thử Tự động (Automated Test Report)

| Mã Test | Nội dung kiểm thử | Kết quả |
| :--- | :--- | :---: |
| `S3-06.1` | Báo giá 1 ca tự động bóc tách chính xác từng khung 30 phút (`slotBreakdown`) giữa giờ thường & cao điểm | **PASS** |
| `S3-06.2` | Giỏ đặt sân đa khung giờ tự động cộng tổng tiền động và tổng số giờ của tất cả các ca trong giỏ | **PASS** |
| `S3-06.3` | Giỏ đặt sân tự động phát hiện và cảnh báo 2 khung giờ bị chồng lấn nhau trong cùng giỏ | **PASS** |
| `S3-06.4` | Đặt sân hàng loạt từ Giỏ đặt sân (`checkoutBookingCart`) với Transaction Lock thành công | **PASS** |
