# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & NGHIỆP VỤ — CẤU HÌNH KHUNG GIỜ & BIỂU PHÍ SÂN (WBS 3.2 - S2-07)
## DỰ ÁN SPORTLINK — NỀN TẢNG QUẢN LÝ SÂN THỂ THAO VÀ CÁP KÈO

> **Mã công việc:** S2-07 | **Sprint:** 2 | **WBS:** [3.2] Sân & Giá động  
> **Người thực hiện:** Trần Lê Quang Hữu (`@hutrn6`)  
> **Ngày lập:** 11/11/2026 | **Thời lượng ước tính:** 16 giờ | **Hạn hoàn thành:** 12/11/2026  
> **Trạng thái:** Đang thực hiện (`Doing`)  
> 
> 📄 **Liên kết Google Docs (Xem trực tuyến & Chia sẻ nhóm):**  
> `https://docs.google.com/document/d/1SportLink-S2-07-Pricing-Config-Specification/edit?usp=sharing`  
> *(Tài liệu được định dạng tương thích 100% chuẩn Google Docs / Word .docx phục vụ nghiệm thu học phần QLDAPM)*

---

## 1. TỔNG QUAN & BỐI CẢNH NGHIỆP VỤ (BUSINESS CONTEXT)
Trong mô hình kinh doanh cụm sân thể thao (Bóng đá, Cầu lông, Pickleball, Tennis, Bóng rổ, Bóng chuyền), nhu cầu thuê sân của khách hàng biến động rất lớn theo các thời điểm trong ngày và các ngày trong tuần:
- Khung giờ hành chính ban ngày (06:00 – 16:00/17:00 ngày thường) thường có nhu cầu thấp (giờ vắng / thấp điểm - **Off-Peak**).
- Khung giờ sau giờ làm việc (17:00 – 21:00 ngày thường) và toàn bộ các ngày cuối tuần (Thứ 7, Chủ Nhật), ngày lễ có nhu cầu tăng vọt (giờ vàng / cao điểm - **Peak Hour**).

Nhằm tối ưu hóa tỷ lệ lấp đầy sân (**Occupancy Rate**) và doanh thu (**Revenue Maximization**), hệ thống SportLink cung cấp tính năng **Dynamic Pricing Configuration** cho phép Chủ sân linh hoạt thiết lập biểu giá theo khung giờ và loại ngày.

---

## 2. CẤU TRÚC DỮ LIỆU & RÀNG BUỘC CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

### 2.1. Bảng `[dbo].[court_prices]`
```sql
CREATE TABLE [dbo].[court_prices] (
    [price_id]    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [court_id]    INT NOT NULL,
    [day_type]    VARCHAR(20) NOT NULL DEFAULT 'WEEKDAY',
    [start_time]  TIME NOT NULL,
    [end_time]    TIME NOT NULL,
    [price]       DECIMAL(18,2) NOT NULL DEFAULT 200000,
    CONSTRAINT [fk_court_prices_court] FOREIGN KEY ([court_id]) 
        REFERENCES [dbo].[courts]([court_id]) ON DELETE CASCADE,
    CONSTRAINT [chk_court_prices_day_type] CHECK (
        [day_type] IN ('WEEKDAY', 'NORMAL', 'WEEKEND', 'HOLIDAY')
    )
);
```

### 2.2. Ý nghĩa các trường dữ liệu
1. `price_id`: Khóa chính định danh duy nhất cho mỗi quy tắc giá.
2. `court_id`: Khóa ngoại tham chiếu đến sân con được cấu hình biểu giá. Mỗi sân có thể có biểu giá riêng (ví dụ sân VIP thảm Yonex giá cao hơn sân tiêu chuẩn).
3. `day_type`: Phân loại ngày áp dụng:
   - `WEEKDAY` / `NORMAL`: Áp dụng cho các ngày làm việc thông thường trong tuần (Thứ 2 đến Thứ 6).
   - `WEEKEND`: Áp dụng cho Thứ 7 và Chủ Nhật.
   - `HOLIDAY`: Áp dụng cho các ngày Lễ/Tết quốc gia.
4. `start_time` & `end_time`: Biên khung giờ hiệu lực trong ngày (theo định dạng `HH:mm:ss`).
5. `price`: Mức giá thuê sân theo giờ (VNĐ/giờ).

---

## 3. MA TRẬN KHUNG GIỜ TIÊU CHUẨN CỦA HỆ THỐNG
Hệ thống SportLink hoạt động liên tục trong khung giờ mở cửa chuẩn từ **06:00 đến 23:00** hàng ngày (tổng cộng 17 tiếng vận hành):

```
06:00         12:00         17:00         21:00         23:00
  |-------------|-------------|-------------|-------------|
     Ca Sáng       Ca Chiều      Ca Vàng       Ca Đêm
    (Off-peak)     (Thường)       (Peak)      (Hạ nhiệt)
```

### Biểu giá mẫu theo từng bộ môn:
1. **Sân Cầu lông & Pickleball (Trong nhà):**
   - Sáng ngày thường (`06:00 - 12:00`): **80.000 đ/h**
   - Chiều ngày thường (`12:00 - 17:00`): **100.000 đ/h**
   - Giờ vàng ngày thường (`17:00 - 21:00`): **140.000 đ/h**
   - Đêm ngày thường (`21:00 - 23:00`): **110.000 đ/h**
   - Cuối tuần ban ngày (`06:00 - 17:00`): **120.000 đ/h**
   - Cuối tuần giờ vàng (`17:00 - 23:00`): **160.000 đ/h**
   - Ngày lễ (`06:00 - 23:00`): **180.000 đ/h**

2. **Sân Bóng đá 7 người & Quần vợt Tennis:**
   - Sáng ngày thường (`06:00 - 12:00`): **200.000 đ/h**
   - Chiều ngày thường (`12:00 - 17:00`): **250.000 đ/h**
   - Giờ vàng ngày thường (`17:00 - 21:00`): **380.000 đ/h**
   - Đêm ngày thường (`21:00 - 23:00`): **280.000 đ/h**
   - Cuối tuần ban ngày (`06:00 - 17:00`): **300.000 đ/h**
   - Cuối tuần giờ vàng (`17:00 - 23:00`): **450.000 đ/h**
   - Ngày lễ (`06:00 - 23:00`): **500.000 đ/h**

---

## 4. ĐẶC TẢ GIAO TIẾP API (API SPECIFICATION)

### 4.1. Lấy bảng giá của sân con
- **Endpoint:** `GET /api/courts/:courtId/prices`
- **Xác thực:** Không bắt buộc (công khai cho Người chơi tra cứu biểu giá).
- **Phản hồi mẫu:**
```json
{
  "success": true,
  "data": [
    {
      "price_id": 1,
      "court_id": 1,
      "day_type": "WEEKDAY",
      "start_time": "06:00:00",
      "end_time": "16:00:00",
      "price": 200000
    },
    {
      "price_id": 2,
      "court_id": 1,
      "day_type": "WEEKDAY",
      "start_time": "16:00:00",
      "end_time": "21:00:00",
      "price": 350000
    }
  ]
}
```

### 4.2. Cập nhật / Thiết lập bảng giá cho sân con
- **Endpoint:** `PUT /api/courts/:courtId/prices`
- **Xác thực:** Bắt buộc (`verifyToken, authorize('owner', 'admin')`).
- **Kiểm tra quyền sở hữu:** Backend xác thực `court.owner_id === req.user.id`.
- **Payload:**
```json
{
  "prices": [
    { "dayType": "WEEKDAY", "startTime": "06:00", "endTime": "17:00", "price": 180000 },
    { "dayType": "WEEKDAY", "startTime": "17:00", "endTime": "23:00", "price": 320000 },
    { "dayType": "WEEKEND", "startTime": "06:00", "endTime": "23:00", "price": 350000 },
    { "dayType": "HOLIDAY", "startTime": "06:00", "endTime": "23:00", "price": 400000 }
  ]
}
```

---

## 5. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG (UI/UX)
- Tích hợp nút **"Cấu hình bảng giá"** trên từng thẻ Sân con tại trang **Quản lý Cơ sở & Sân con (`/owner/courts`)** và trang **Lịch đặt sân (`/owner/schedule`)**.
- Modal hiển thị trực quan các hàng khung giờ với thanh chọn thời gian (TimePicker), loại ngày và nhập giá tiền có format phân cách hàng nghìn (đ).
- Tự động kiểm tra tính hợp lệ (Validation): không để trống khung giờ, không để các khung giờ bị trùng lắp hoặc chồng chéo nhau.
