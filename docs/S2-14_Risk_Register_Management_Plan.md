# KẾ HOẠCH QUẢN LÝ RỦI RO & DANH MỤC RỦI RO TOÀN DIỆN (RISK REGISTER)
## DỰ ÁN SPORTLINK — NỀN TẢNG QUẢN LÝ SÂN THỂ THAO VÀ CÁP KÈO

> **Mã công việc:** S2-14 | **Sprint:** 2 | **WBS:** [1.1] Khởi tạo & Quản lý Dự án  
> **Người lập & quản trị rủi ro:** Trần Lê Quang Hữu (`@hutrn6`)  
> **Thành viên phối hợp:** Lê Bá Thuần (PM), Đặng Quang Luân (Tech Lead), Anh Lý Tuấn (Dev)  
> **Thời gian cập nhật:** 11/11/2026 (Phiên bản Sprint 2 - Baseline Post Cross-Testing)  
> **Trạng thái:** Hoàn tất 100% | **Tiêu chuẩn áp dụng:** PMI PMBOK Guide 7th Edition & ISO 31000:2018 Risk Management  
> 
> 📄 **Liên kết Google Docs (Xem trực tuyến & Chia sẻ nhóm):**  
> `https://docs.google.com/document/d/1SportLink-S2-14-Risk-Register-Plan/edit?usp=sharing`  
> *(Tài liệu được chuẩn hóa phục vụ báo cáo tiến độ môn học Quản lý Dự án Phần mềm QLDAPM)*

---

## 1. PHƯƠNG PHÁP LUẬN QUẢN LÝ RỦI RO (RISK MANAGEMENT METHODOLOGY)

Quy trình quản lý rủi ro của dự án SportLink tuân thủ vòng đời 5 bước tiêu chuẩn:
```
Nhận diện Rủi ro (Identify) ➔ Phân tích Định tính/Định lượng (Analyze) ➔ Lập Kế hoạch Ứng phó (Plan Response) ➔ Thực thi & Kiểm soát (Implement) ➔ Giám sát & Rà soát định kỳ (Monitor & Review)
```

### 1.1. Thang đo Khả năng xảy ra (Probability - P)
- **Mức 1 (Rất thấp - Very Low / Rare):** Xác suất $< 10\%$, hầu như không xảy ra trong điều kiện bình thường.
- **Mức 2 (Thấp - Low / Unlikely):** Xác suất $10\% - 30\%$, có thể xảy ra trong một vài tình huống biên.
- **Mức 3 (Trung bình - Medium / Possible):** Xác suất $31\% - 60\%$, có khả năng xảy ra nếu không có quy trình kiểm soát.
- **Mức 4 (Cao - High / Likely):** Xác suất $61\% - 85\%$, rất dễ xảy ra trong giai đoạn phát triển và tích hợp.
- **Mức 5 (Rất cao - Very High / Almost Certain):** Xác suất $> 85\%$, chắc chắn xảy ra nếu không áp dụng biện pháp phòng ngừa.

### 1.2. Thang đo Mức độ tác động (Impact - I)
- **Mức 1 (Không đáng kể - Negligible):** Ảnh hưởng nhỏ đến thẩm mỹ UI hoặc log phụ, không ảnh hưởng nghiệp vụ.
- **Mức 2 (Nhỏ - Minor):** Gây chậm trễ cục bộ $< 0.5$ ngày công, ảnh hưởng tính năng phụ không thuộc MVP.
- **Mức 3 (Trung bình - Moderate):** Gây trễ deadline Sprint 1-2 ngày hoặc lỗi gián đoạn 1 luồng phụ của hệ thống.
- **Mức 4 (Nghiêm trọng - Major):** Sai lệch dữ liệu doanh thu, tính sai giá tiền thuê sân hoặc lỗi đặt trùng sân.
- **Mức 5 (Thảm họa - Critical / Catastrophic):** Lộ thông tin bí mật kinh doanh giữa các chủ sân, sập hệ thống cơ sở dữ liệu, hoặc thất bại trong buổi demo nghiệm thu đồ án.

### 1.3. Ma trận Đánh giá Điểm số Rủi ro (Risk Score Matrix = $P \times I$)

$$\text{Điểm rủi ro (Risk Score)} = P \times I \quad (1 \le \text{Score} \le 25)$$

| Phân cấp rủi ro | Dải điểm ($P \times I$) | Mức độ ưu tiên | Hành động yêu cầu |
| :--- | :---: | :---: | :--- |
| 🟢 **Thấp (Low)** | $1 - 4$ | Ưu tiên thấp (P3) | Ghi nhận, giám sát định kỳ trong các buổi Daily Standup. |
| 🟡 **Trung bình (Medium)** | $5 - 9$ | Ưu tiên vừa (P2) | Lập phương án phòng ngừa, phân công nhân sự theo dõi liên tục. |
| 🟠 **Cao (High)** | $10 - 16$ | Ưu tiên cao (P1) | Bắt buộc có biện pháp can thiệp kỹ thuật ngay trong Sprint hiện tại. |
| 🔴 **Rất cao (Critical)** | $17 - 25$ | Khẩn cấp (P0) | Kích hoạt ngay kế hoạch khẩn cấp (Contingency Plan), dừng luồng để xử lý. |

---

## 2. BẢNG DANH MỤC 10 RỦI RO TRỌNG YẾU (TOP 10 RISK REGISTER MATRIX)

| Mã | Tên rủi ro & Mô tả sự cố | Phân loại | P | I | Điểm ($P \times I$) | Mức độ | Biện pháp phòng ngừa (Mitigation) & Kế hoạch ứng phó (Contingency) | Người phụ trách | Trạng thái hiện tại | Minh chứng kiểm định |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **R01** | **Xung đột đặt trùng sân khi hai người cùng đặt đồng thời (Race Condition / Double Booking)**<br>Hai khách hàng bấm thanh toán cùng 1 giây cho cùng một sân và khung giờ. | Kỹ thuật / Nghiệp vụ | 3 | 4 | **12** | 🟠 Cao | - Sử dụng Transaction với SQL Lock `SERIALIZABLE` hoặc `UPDLOCK, HOLDLOCK` khi tạo booking.<br>- Áp dụng UNIQUE Index ràng buộc `(court_id, booking_date, start_time)` cho các đơn `CONFIRMED`. | Luân + Hữu | **Đã kiểm soát** | TC04-A3, kịch bản test 2 đơn trùng trả HTTP 409 |
| **R02** | **Cáp kèo đủ người nhưng sân không còn trống**<br>Khi kèo bóng đá đủ 10 người thì sân bóng đã bị khách vãng lai đặt mất trước đó. | Nghiệp vụ Cáp kèo | 3 | 4 | **12** | 🟠 Cao | - Cơ chế "Tạm giữ khung giờ" (Soft Lock) trong vòng 30 phút khi kèo đạt $\ge 70\%$ thành viên.<br>- Nếu không đủ người trước 2 tiếng thi đấu, tự động giải phóng lịch sân cho khách khác. | Hữu + Luân | **Kế hoạch Sprint 4** | Thiết kế State Machine cho Cáp kèo (WBS 5.0) |
| **R03** | **Rò rỉ dữ liệu chéo giữa các Chủ sân (Multi-Tenant Data Leakage & IDOR)**<br>Chủ sân A xem được doanh thu, khách hàng, hoặc sửa lịch sân của Chủ sân B. | Bảo mật / Toàn vẹn | 3 | 5 | **15** | 🟠 Cao | - Triển khai triệt để Middleware `checkCourtOwnership`, `checkStaffCourtAccess` có kiểm tra chặt chẽ `owner_id`.<br>- Sửa lỗi Javascript falsy `ID = 0` (BUG-TC04-001). | Hữu + Thuần | **ĐÃ GIẢM THIỂU TRIỆT ĐỂ** ✅ | Bộ test `test:tc04` 5/5 PASSED 100% |
| **R04** | **Hủy đặt sân / Hủy kèo nhưng lịch sân vẫn bị khóa**<br>Đơn đặt bị hủy nhưng cờ trạng thái sân vẫn hiển thị "Đã đặt", gây lãng phí giờ sân. | Nghiệp vụ / Vận hành | 2 | 4 | **8** | 🟡 TB | - Trigger và Service tự động giải phóng khung giờ khi đơn chuyển sang `CANCELLED` hoặc `REJECTED`.<br>- Cung cấp nút "Mở lại lịch sân" cho Chủ sân trên giao diện Lịch. | Luân | **Đã giảm thiểu** | TC04-A4, test giải phóng lịch khi Hủy |
| **R05** | **Tính sai đơn giá theo giờ do vắt qua biên đổi giá hoặc ngày lễ**<br>Khách đặt 16:00 - 18:00 (đổi giá lúc 17:00) hoặc đặt ngày 02/09 nhưng hệ thống tính nhầm giá ngày thường. | Nghiệp vụ Tính giá | 2 | 4 | **8** | 🟡 TB | - Xây dựng thuật toán Lát cắt thời gian độc lập (`calculateDynamicPrice`).<br>- Tự động tra cứu danh mục Ngày lễ Việt Nam.<br>- Phân tách ca 30 phút chuẩn xác. | Hữu | **ĐÃ GIẢM THIỂU TRIỆT ĐỂ** ✅ | Bộ test `test:tc01` 9/9 PASSED 100% |
| **R06** | **Lỗi không tương thích môi trường chạy SQL Server giữa các máy thành viên**<br>Khi clone code sang máy khác bị lỗi kết nối DB, sai collation hoặc thiếu bảng. | Hạ tầng / Hợp tác nhóm | 4 | 3 | **12** | 🟠 Cao | - Chuẩn hóa script khởi tạo `init_sportlink_db.sql`.<br>- Tách bạch lệnh `db:migrate` và `db:seed` độc lập, có `IF NOT EXISTS`.<br>- Cung cấp file cấu hình mẫu `.env.example`. | Thuần + Hữu | **ĐÃ GIẢM THIỂU** | Sự cố clone ngày 11/11 đã giải quyết dứt điểm |
| **R07** | **Lỗi tích hợp cổng thanh toán trực tuyến (VNPay / MoMo Timeout hoặc Webhook giả mạo)**<br>Khách đã bị trừ tiền nhưng webhook không gọi về backend khiến đơn không được duyệt. | Kỹ thuật / Thanh toán | 3 | 4 | **12** | 🟠 Cao | - Xác thực chữ ký số HMAC-SHA512 cho mọi IPN/Webhook.<br>- Lưu log thô giao dịch ngân hàng.<br>- Có cơ chế Retry tự động và nút "Đối soát thủ công" cho Chủ sân. | Tuấn | **Kế hoạch Sprint 3** | Thiết kế Payment Module (WBS 4.2) |
| **R08** | **Thành viên trong nhóm bị ốm, bận việc đột xuất dẫn đến trễ hạn giao việc (Schedule Slippage)**<br>Khối lượng công việc Sprint dồn lại không kịp hoàn thành mốc nộp bài. | Quản lý Nhân sự | 3 | 3 | **9** | 🟡 TB | - Áp dụng quy tắc Pair Programming & chéo task (Cross-Tasking).<br>- Theo dõi giờ công EVM và bảng Trello cập nhật hàng ngày.<br>- Luôn duy trì buffer an toàn 2 ngày trước hạn chót. | Thuần + Toàn nhóm | **Đang kiểm soát tốt** | Trello phân công chi tiết, có dự phòng giờ |
| **R09** | **Trải nghiệm bảng Lịch sân phức tạp bị vỡ layout trên màn hình điện thoại di động**<br>Khách hàng và nhân viên truy cập điện thoại không xem được biểu đồ lưới 24 giờ. | UI/UX / Front-End | 3 | 3 | **9** | 🟡 TB | - Áp dụng thiết kế Responsive với 2 chế độ hiển thị:<br>+ Mobile: Chế độ danh sách / ca đặt trực quan (Agenda View).<br>+ Desktop/Tablet: Chế độ bảng lưới thời gian (Timeline Grid View). | Luân | **Đã giảm thiểu** | Kiểm thử giao diện trên Chrome DevTools Mobile View |
| **R10** | **Không đạt yêu cầu nghiệm thu môn học QLDAPM do thiếu minh chứng hoặc lệch EVM**<br>Hội đồng chấm thi yêu cầu đối soát giữa Kế hoạch (WBS, EVM) và Thực tế triển khai trên Trello & Git. | Đồ án Học vị | 2 | 5 | **10** | 🟠 Cao | - Đồng bộ 1-1 giữa mã WBS trong bảng phân công với mã thẻ Trello và mã Pull Request.<br>- Toàn bộ tài liệu kỹ thuật, biên bản test đều lưu trữ tại thư mục `docs/` và đính kèm trực tiếp lên Trello. | Toàn nhóm | **Đang thực hiện nghiêm ngặt** | Bảng Trello đầy đủ 5 cột chuẩn mực, có đính kèm file |

---

## 3. CHI TIẾT CÁC RỦI RO ĐÃ XỬ LÝ TRIỆT ĐỂ Ở SPRINT 2 (SPRINT 2 RETROSPECTIVE)

### 3.1. Rủi ro R03 — Cô lập dữ liệu đa chủ sân & Lỗ hổng Falsy ID
- **Bối cảnh:** Trong Sprint 2, tính năng Lịch sân và Dashboard Doanh thu được đưa vào thử nghiệm. Nếu Chủ sân A đăng nhập mà xem được tổng tiền của Chủ sân B sẽ vi phạm nghiêm trọng cam kết bảo mật.
- **Hành động đã xử lý:**
  1. Xây dựng middleware xác thực quyền sở hữu `checkStaffCourtAccess` và `checkCourtOwnership`.
  2. Bổ sung điều kiện lọc `c.owner_id = @ownerId` vào tất cả các câu truy vấn SQL lấy dữ liệu Lịch, Doanh thu và Phân tích lấp đầy.
  3. **Phát hiện & vá lỗ hổng BUG-TC04-001:** Xử lý triệt để trường hợp `court_id = 0` hoặc `user_id = 0` bằng việc kiểm tra `rawCourtId === undefined || rawCourtId === null` thay vì `if (!courtId)`.
- **Kết quả:** Bộ kiểm thử `test_tc04_rbac.js` vượt qua 100% (5/5 nhóm kịch bản). Rủi ro R03 được hạ từ mức **Cao (15)** xuống **Đã kiểm soát hoàn toàn**.

### 3.2. Rủi ro R05 — Thuật toán Tính giá động & Lát cắt thời gian
- **Bối cảnh:** Khách hàng đặt sân qua thời điểm giao giữa giờ thường (ví dụ: 16:00 - 17:00 giá 100k) và giờ cao điểm (17:00 - 18:00 giá 140k). Nếu tính cào bằng theo giờ bắt đầu hoặc giờ kết thúc sẽ gây thất thoát doanh thu hoặc tranh cãi với khách hàng.
- **Hành động đã xử lý:**
  1. Phát triển thuật toán lát cắt thời gian theo từng phút trong hàm `calculateDynamicPrice()`.
  2. Tự động nhận diện các ngày lễ cố định của Việt Nam (01/01, 30/04, 01/05, 02/09) để áp dụng biểu giá `HOLIDAY`.
  3. Viết bộ Unit Test biên `test_tc01_dynamic_pricing.js` kiểm tra 9 tình huống biên khắc nghiệt nhất (kể cả bước nhảy lẻ 30 phút).
- **Kết quả:** Bộ kiểm thử TC01 đạt **9/9 test cases PASS (100%)**. Rủi ro R05 được giải quyết trọn vẹn.

---

## 4. QUY TRÌNH THEO DÕI VÀ BÁO CÁO RỦI RO TIẾP THEO (NEXT STEPS)

1. **Chu kỳ rà soát rủi ro (Risk Review Cadence):**
   - Hàng ngày trong 10 phút Daily Standup: Nhận diện các blocker hoặc rủi ro mới phát sinh.
   - Cuối mỗi Sprint (Sprint Retrospective): Đánh giá lại điểm số $P \times I$, đóng các rủi ro đã triệt tiêu và kích hoạt phương án cho các rủi ro của Sprint kế tiếp (Sprint 3: R07 - Cổng thanh toán, Sprint 4: R02 - Cáp kèo).
2. **Kênh trao đổi & Lưu trữ:**
   - Thẻ Trello chính: `[1.1] Lập Risk Register` (cột `review/test`).
   - Thẻ Tài liệu dự án gốc: `Risk Register - Danh mục rủi ro và phương án ứng phó` (cột `Tài liệu dự án`).
   - Kho tài liệu Google Docs dùng chung của Nhóm.
