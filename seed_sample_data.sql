USE [sportlink_db]
GO

-- ===================================================================================
-- SPORTLINK - [2.2] SCRIPT DỮ LIỆU MẪU TOÀN HỆ THỐNG (SAMPLE SEED DATA)
-- Phụ trách: Đặng Quang Luân (S1-09)
-- Mô tả: Script nạp dữ liệu mẫu đầy đủ cho các bảng:
--   1. sports (6 môn thể thao mở rộng)
--   2. users (Admin, 2 Chủ sân, 2 Nhân viên, 6 Người chơi - Mật khẩu: password123)
--   3. courts, court_staff, court_prices, court_maintenances
--   4. bookings & transactions (Trải đều theo Ngày/Tuần/Tháng phục vụ Lịch sân & Dashboard)
--   5. teams, team_members, matches, match_participants, reviews, notifications
-- ===================================================================================

SET NOCOUNT ON;
PRINT N'🚀 Bắt đầu nạp dữ liệu mẫu cho hệ thống SportLink...';

-- -----------------------------------------------------------------------------------
-- 0. ĐẢM BẢO CÁC CỘT NÂNG CẤP TRONG BẢNG USERS & COURT_STAFF ĐÃ TỒN TẠI
-- -----------------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'avatar_url')
    ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'status')
    ALTER TABLE [dbo].[users] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'owner_id')
    ALTER TABLE [dbo].[users] ADD [owner_id] INT NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'job_title')
    ALTER TABLE [dbo].[users] ADD [job_title] NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[court_staff]'))
BEGIN
    CREATE TABLE [dbo].[court_staff] (
        [assignment_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [staff_id] INT NOT NULL,
        [court_id] INT NOT NULL,
        [assigned_by] INT NOT NULL,
        [assigned_at] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [unique_staff_court] UNIQUE NONCLUSTERED ([staff_id] ASC, [court_id] ASC)
    );
END
GO

-- Cập nhật check constraint role của users hỗ trợ ADMIN
DECLARE @chkRole NVARCHAR(256) = (
    SELECT name FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.users') AND definition LIKE '%role%'
);
IF @chkRole IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [dbo].[users] DROP CONSTRAINT ' + @chkRole);
    ALTER TABLE [dbo].[users] WITH CHECK ADD CHECK (([role]='PLAYER' OR [role]='STAFF' OR [role]='OWNER' OR [role]='ADMIN'));
END
GO

-- -----------------------------------------------------------------------------------
-- 1. DANH MỤC MÔN THỂ THAO (SPORTS)
-- -----------------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE [sport_name] = N'Bóng đá')
    INSERT INTO [dbo].[sports] ([sport_name], [description]) VALUES (N'Bóng đá', N'Sân bóng đá cỏ nhân tạo 5 người, 7 người và 11 người');
IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE [sport_name] = N'Cầu lông')
    INSERT INTO [dbo].[sports] ([sport_name], [description]) VALUES (N'Cầu lông', N'Sân cầu lông thảm PVC tiêu chuẩn thi đấu trong nhà');
IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE [sport_name] = N'Pickleball')
    INSERT INTO [dbo].[sports] ([sport_name], [description]) VALUES (N'Pickleball', N'Sân Pickleball mặt sơn Acrylic chống trượt có mái che');
IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE [sport_name] = N'Tennis')
    INSERT INTO [dbo].[sports] ([sport_name], [description]) VALUES (N'Tennis', N'Sân quần vợt tiêu chuẩn có hệ thống đèn chiếu sáng ban đêm');
IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE [sport_name] = N'Bóng rổ')
    INSERT INTO [dbo].[sports] ([sport_name], [description]) VALUES (N'Bóng rổ', N'Sân bóng rổ 3x3 và 5x5 mặt sàn gỗ/sơn chuyên dụng');
IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE [sport_name] = N'Bóng chuyền')
    INSERT INTO [dbo].[sports] ([sport_name], [description]) VALUES (N'Bóng chuyền', N'Sân bóng chuyền hơi và bóng chuyền da trong nhà');
PRINT N'✅ [1/7] Đã nạp danh mục 6 môn thể thao (sports).';
GO

-- -----------------------------------------------------------------------------------
-- 2. TÀI KHOẢN NGƯỜI DÙNG MẪU (USERS) - Mật khẩu chung: password123
-- -----------------------------------------------------------------------------------
DECLARE @pwd VARCHAR(255) = '$2b$12$owjterp9i3dfQG5lu2uHWuNZRARBDtUN9Wqga3tYwTi3fKjRFhzAS';

-- Admin
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'admin@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Nguyễn Quản Trị', '0901000001', 'admin@sportlink.vn', @pwd, 'ADMIN', 'ACTIVE', 5.0, DATEADD(DAY, -60, GETDATE()));

-- Owner 1 (Chủ sân chính)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Trần Chủ Sân', '0901000002', 'owner@sportlink.vn', @pwd, 'OWNER', 'ACTIVE', 5.0, DATEADD(DAY, -55, GETDATE()));

-- Owner 2 (Chủ sân thứ 2 - Phục vụ kiểm thử phân tách dữ liệu R03)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner2@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Lê Chủ Sân Khác', '0901000012', 'owner2@sportlink.vn', @pwd, 'OWNER', 'ACTIVE', 5.0, DATEADD(DAY, -50, GETDATE()));

DECLARE @owner1Id INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'owner@sportlink.vn');
DECLARE @owner2Id INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'owner2@sportlink.vn');

-- Staff 1 & 2 thuộc Owner 1
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'staff@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [owner_id], [job_title], [reputation_score], [created_at])
    VALUES (N'Lê Nhân Viên', '0901000003', 'staff@sportlink.vn', @pwd, 'STAFF', 'ACTIVE', @owner1Id, N'Nhân viên trực sân ca sáng', 5.0, DATEADD(DAY, -45, GETDATE()));
ELSE
    UPDATE [dbo].[users] SET [owner_id] = @owner1Id, [job_title] = N'Nhân viên trực sân ca sáng', [status] = 'ACTIVE' WHERE [email] = 'staff@sportlink.vn';

IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'staff2@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [owner_id], [job_title], [reputation_score], [created_at])
    VALUES (N'Võ Thu Ngân', '0901000013', 'staff2@sportlink.vn', @pwd, 'STAFF', 'ACTIVE', @owner1Id, N'Thu ngân & Check-in ca tối', 5.0, DATEADD(DAY, -30, GETDATE()));

-- Danh sách Khách hàng / Người chơi (Players)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'player@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Phạm Người Chơi', '0901000004', 'player@sportlink.vn', @pwd, 'PLAYER', 'ACTIVE', 4.9, DATEADD(DAY, -40, GETDATE()));

IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'luan.player@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Đặng Quang Luân', '0909111222', 'luan.player@sportlink.vn', @pwd, 'PLAYER', 'ACTIVE', 5.0, DATEADD(DAY, -38, GETDATE()));

IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'thuan.player@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Lê Bá Thuần', '0909222333', 'thuan.player@sportlink.vn', @pwd, 'PLAYER', 'ACTIVE', 4.8, DATEADD(DAY, -35, GETDATE()));

IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'huu.player@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Trần Lê Quang Hữu', '0909333444', 'huu.player@sportlink.vn', @pwd, 'PLAYER', 'ACTIVE', 4.7, DATEADD(DAY, -32, GETDATE()));

IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'minhkhoi@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Nguyễn Minh Khôi', '0909444555', 'minhkhoi@sportlink.vn', @pwd, 'PLAYER', 'ACTIVE', 4.5, DATEADD(DAY, -25, GETDATE()));

IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'hoangnam@sportlink.vn')
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [status], [reputation_score], [created_at])
    VALUES (N'Bùi Hoàng Nam', '0909555666', 'hoangnam@sportlink.vn', @pwd, 'PLAYER', 'ACTIVE', 3.6, DATEADD(DAY, -15, GETDATE()));

PRINT N'✅ [2/7] Đã nạp tài khoản người dùng mẫu (Admin, Owner, Staff, Players).';
GO

-- -----------------------------------------------------------------------------------
-- 3. DANH SÁCH SÂN THỂ THAO, PHÂN CÔNG NHÂN VIÊN, BẢNG GIÁ ĐỘNG & LỊCH BẢO TRÌ
-- -----------------------------------------------------------------------------------
DECLARE @owner1 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'owner@sportlink.vn');
DECLARE @owner2 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'owner2@sportlink.vn');
DECLARE @staff1 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'staff@sportlink.vn');
DECLARE @staff2 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'staff2@sportlink.vn');

DECLARE @sportFootball INT = (SELECT TOP 1 [sport_id] FROM [dbo].[sports] WHERE [sport_name] = N'Bóng đá');
DECLARE @sportBadminton INT = (SELECT TOP 1 [sport_id] FROM [dbo].[sports] WHERE [sport_name] = N'Cầu lông');
DECLARE @sportPickleball INT = (SELECT TOP 1 [sport_id] FROM [dbo].[sports] WHERE [sport_name] = N'Pickleball');
DECLARE @sportTennis INT = (SELECT TOP 1 [sport_id] FROM [dbo].[sports] WHERE [sport_name] = N'Tennis');

-- Các sân thuộc Owner 1
IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 5A')
    INSERT INTO [dbo].[courts] ([owner_id], [sport_id], [court_name], [address], [latitude], [longitude], [description], [utilities], [status])
    VALUES (@owner1, @sportFootball, N'Sân Bóng Đá SportLink Man Thiện - Sân 5A', N'97 Man Thiện, P. Hiệp Phú, TP. Thủ Đức', 10.84798000, 106.78655000, N'Sân cỏ nhân tạo chuẩn FIFA 5 người, đèn LED chống chói', N'Wifi miễn phí, Bãi giữ xe ô tô, Căn tin, Phòng thay đồ', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 7B')
    INSERT INTO [dbo].[courts] ([owner_id], [sport_id], [court_name], [address], [latitude], [longitude], [description], [utilities], [status])
    VALUES (@owner1, @sportFootball, N'Sân Bóng Đá SportLink Man Thiện - Sân 7B', N'97 Man Thiện, P. Hiệp Phú, TP. Thủ Đức', 10.84812000, 106.78670000, N'Sân bóng đá 7 người mặt cỏ mới thay năm 2026', N'Wifi miễn phí, Khán đài có mái che, Cho thuê giày & áo bib', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [court_name] = N'Sân Cầu Lông SportLink Arena - Sân VIP 1')
    INSERT INTO [dbo].[courts] ([owner_id], [sport_id], [court_name], [address], [latitude], [longitude], [description], [utilities], [status])
    VALUES (@owner1, @sportBadminton, N'Sân Cầu Lông SportLink Arena - Sân VIP 1', N'112 Lê Văn Việt, P. Tăng Nhơn Phú A, TP. Thủ Đức', 10.84452000, 106.78210000, N'Sân cầu lông thảm Yonex chuẩn thi đấu, trần cao 10m', N'Máy lạnh khu vực chờ, Cho thuê vợt, Bán ống cầu', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [court_name] = N'Sân Pickleball SportLink Club - Sân P1')
    INSERT INTO [dbo].[courts] ([owner_id], [sport_id], [court_name], [address], [latitude], [longitude], [description], [utilities], [status])
    VALUES (@owner1, @sportPickleball, N'Sân Pickleball SportLink Club - Sân P1', N'45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức', 10.85120000, 106.79130000, N'Sân Pickleball có mái che thoáng mát, mặt sân tiêu chuẩn USAPA', N'Cho thuê vợt Carbon, Nước giải khát, Phòng tắm nóng lạnh', 'ACTIVE');

IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [court_name] = N'Sân Tennis SportLink Central - Sân T1')
    INSERT INTO [dbo].[courts] ([owner_id], [sport_id], [court_name], [address], [latitude], [longitude], [description], [utilities], [status])
    VALUES (@owner1, @sportTennis, N'Sân Tennis SportLink Central - Sân T1', N'97 Man Thiện, P. Hiệp Phú, TP. Thủ Đức', 10.84830000, 106.78690000, N'Sân Tennis ngoài trời mặt cứng tiêu chuẩn ITF', N'Đèn pha cao áp, Ghế nghỉ trọng tài, Có người nhặt bóng', 'ACTIVE');

-- Sân thuộc Owner 2 (phục vụ test cô lập dữ liệu R03)
IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá Thủ Đức Star (Chủ sân 2)')
    INSERT INTO [dbo].[courts] ([owner_id], [sport_id], [court_name], [address], [latitude], [longitude], [description], [utilities], [status])
    VALUES (@owner2, @sportFootball, N'Sân Bóng Đá Thủ Đức Star (Chủ sân 2)', N'200 Võ Văn Ngân, P. Bình Thọ, TP. Thủ Đức', 10.85050000, 106.76200000, N'Sân thuộc chủ sân khác để kiểm thử phân quyền chéo', N'Bãi xe rộng, Nước uống', 'ACTIVE');

DECLARE @court1 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 5A');
DECLARE @court2 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 7B');
DECLARE @court3 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Cầu Lông SportLink Arena - Sân VIP 1');
DECLARE @court4 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Pickleball SportLink Club - Sân P1');
DECLARE @court5 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Tennis SportLink Central - Sân T1');

-- Phân công Staff vào các sân của Owner 1
IF @staff1 IS NOT NULL AND @court1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_staff] WHERE [staff_id] = @staff1 AND [court_id] = @court1)
    INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by]) VALUES (@staff1, @court1, @owner1);
IF @staff1 IS NOT NULL AND @court2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_staff] WHERE [staff_id] = @staff1 AND [court_id] = @court2)
    INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by]) VALUES (@staff1, @court2, @owner1);
IF @staff2 IS NOT NULL AND @court3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_staff] WHERE [staff_id] = @staff2 AND [court_id] = @court3)
    INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by]) VALUES (@staff2, @court3, @owner1);
IF @staff2 IS NOT NULL AND @court4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_staff] WHERE [staff_id] = @staff2 AND [court_id] = @court4)
    INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by]) VALUES (@staff2, @court4, @owner1);

-- Cấu hình Bảng giá động (court_prices) cho các sân
IF @court1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @court1)
BEGIN
    INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
    (@court1, 'WEEKDAY', '06:00:00', '16:00:00', 200000),
    (@court1, 'WEEKDAY', '16:00:00', '21:00:00', 350000),
    (@court1, 'WEEKDAY', '21:00:00', '23:00:00', 250000),
    (@court1, 'WEEKEND', '06:00:00', '16:00:00', 280000),
    (@court1, 'WEEKEND', '16:00:00', '22:00:00', 420000),
    (@court1, 'HOLIDAY', '06:00:00', '23:00:00', 450000);
END

IF @court2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @court2)
BEGIN
    INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
    (@court2, 'WEEKDAY', '06:00:00', '16:00:00', 350000),
    (@court2, 'WEEKDAY', '16:00:00', '21:00:00', 550000),
    (@court2, 'WEEKDAY', '21:00:00', '23:00:00', 400000),
    (@court2, 'WEEKEND', '06:00:00', '22:00:00', 600000);
END

IF @court3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @court3)
BEGIN
    INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
    (@court3, 'WEEKDAY', '06:00:00', '17:00:00', 80000),
    (@court3, 'WEEKDAY', '17:00:00', '22:00:00', 120000),
    (@court3, 'WEEKEND', '06:00:00', '22:00:00', 130000);
END

IF @court4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @court4)
BEGIN
    INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
    (@court4, 'WEEKDAY', '06:00:00', '16:00:00', 120000),
    (@court4, 'WEEKDAY', '16:00:00', '22:00:00', 180000),
    (@court4, 'WEEKEND', '06:00:00', '22:00:00', 200000);
END

IF @court5 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @court5)
BEGIN
    INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
    (@court5, 'WEEKDAY', '06:00:00', '16:00:00', 180000),
    (@court5, 'WEEKDAY', '16:00:00', '22:00:00', 260000),
    (@court5, 'WEEKEND', '06:00:00', '22:00:00', 300000);
END

-- Lịch bảo trì sân mẫu (court_maintenances)
IF @court2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[court_maintenances] WHERE [court_id] = @court2)
BEGIN
    INSERT INTO [dbo].[court_maintenances] ([court_id], [start_time], [end_time], [reason])
    VALUES (
        @court2,
        DATEADD(HOUR, 13, CAST(CAST(GETDATE() AS DATE) AS DATETIME)),
        DATEADD(HOUR, 15, CAST(CAST(GETDATE() AS DATE) AS DATETIME)),
        N'Bảo dưỡng hệ thống đèn chiếu sáng & chải hạt cao su mặt sân'
    );
END

PRINT N'✅ [3/7] Đã nạp danh sách sân, phân công nhân viên, bảng giá động và lịch bảo trì.';
GO

-- -----------------------------------------------------------------------------------
-- 4. ĐƠN ĐẶT SÂN (BOOKINGS) & GIAO DỊCH THANH TOÁN (TRANSACTIONS)
-- -----------------------------------------------------------------------------------
DECLARE @c1 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 5A');
DECLARE @c2 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 7B');
DECLARE @c3 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Cầu Lông SportLink Arena - Sân VIP 1');
DECLARE @c4 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Pickleball SportLink Club - Sân P1');
DECLARE @c5 INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Tennis SportLink Central - Sân T1');

DECLARE @p1 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'player@sportlink.vn');
DECLARE @p2 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'luan.player@sportlink.vn');
DECLARE @p3 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'thuan.player@sportlink.vn');
DECLARE @p4 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'huu.player@sportlink.vn');
DECLARE @p5 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'minhkhoi@sportlink.vn');
DECLARE @p6 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'hoangnam@sportlink.vn');

DECLARE @today DATE = CAST(GETDATE() AS DATE);

IF (SELECT COUNT(*) FROM [dbo].[bookings]) < 5
BEGIN
    -- Các đơn đặt trong ngày hôm nay (phục vụ Lịch Ngày)
    INSERT INTO [dbo].[bookings] ([court_id], [user_id], [booking_date], [start_time], [end_time], [total_price], [deposit_amount], [status], [created_at]) VALUES
    (@c1, @p2, @today, '07:00:00', '09:00:00', 400000, 400000, 'COMPLETED', DATEADD(DAY, -2, GETDATE())),
    (@c1, @p1, @today, '17:00:00', '19:00:00', 700000, 350000, 'CONFIRMED', DATEADD(DAY, -1, GETDATE())),
    (@c1, @p3, @today, '19:00:00', '21:00:00', 700000, 200000, 'PENDING', GETDATE()),
    (@c2, @p4, @today, '18:00:00', '20:00:00', 1100000, 550000, 'CHECKED-IN', DATEADD(DAY, -1, GETDATE())),
    (@c3, @p5, @today, '08:00:00', '10:00:00', 160000, 160000, 'COMPLETED', DATEADD(DAY, -1, GETDATE())),
    (@c3, @p2, @today, '18:00:00', '20:00:00', 240000, 120000, 'CONFIRMED', GETDATE()),
    (@c4, @p3, @today, '16:00:00', '18:00:00', 360000, 180000, 'CONFIRMED', GETDATE()),
    (@c5, @p1, @today, '06:00:00', '08:00:00', 360000, 360000, 'COMPLETED', DATEADD(DAY, -3, GETDATE())),

    -- Các đơn đặt ngày mai & trong tuần này (phục vụ Lịch Tuần)
    (@c1, @p2, DATEADD(DAY, 1, @today), '17:00:00', '19:00:00', 700000, 350000, 'CONFIRMED', GETDATE()),
    (@c2, @p3, DATEADD(DAY, 1, @today), '19:00:00', '21:00:00', 1100000, 500000, 'CONFIRMED', GETDATE()),
    (@c4, @p4, DATEADD(DAY, 2, @today), '17:00:00', '19:00:00', 360000, 180000, 'PENDING', GETDATE()),
    (@c3, @p5, DATEADD(DAY, 3, @today), '18:00:00', '20:00:00', 240000, 120000, 'CONFIRMED', GETDATE()),

    -- Các đơn đặt những ngày trước trong tuần & tháng (phục vụ Dashboard Doanh thu, Lấp đầy & Lịch sử khách hàng)
    (@c1, @p2, DATEADD(DAY, -1, @today), '17:00:00', '19:00:00', 700000, 700000, 'COMPLETED', DATEADD(DAY, -2, GETDATE())),
    (@c2, @p1, DATEADD(DAY, -1, @today), '19:00:00', '21:00:00', 1100000, 1100000, 'COMPLETED', DATEADD(DAY, -3, GETDATE())),
    (@c4, @p4, DATEADD(DAY, -2, @today), '18:00:00', '20:00:00', 360000, 360000, 'COMPLETED', DATEADD(DAY, -4, GETDATE())),
    (@c3, @p3, DATEADD(DAY, -2, @today), '17:00:00', '19:00:00', 240000, 240000, 'COMPLETED', DATEADD(DAY, -4, GETDATE())),
    (@c1, @p5, DATEADD(DAY, -3, @today), '18:00:00', '20:00:00', 700000, 700000, 'COMPLETED', DATEADD(DAY, -5, GETDATE())),
    (@c5, @p2, DATEADD(DAY, -4, @today), '16:00:00', '18:00:00', 520000, 520000, 'COMPLETED', DATEADD(DAY, -6, GETDATE())),
    (@c2, @p6, DATEADD(DAY, -4, @today), '17:00:00', '19:00:00', 1100000, 300000, 'NO-SHOW', DATEADD(DAY, -6, GETDATE())),
    (@c1, @p6, DATEADD(DAY, -5, @today), '19:00:00', '21:00:00', 700000, 200000, 'CANCELLED', DATEADD(DAY, -7, GETDATE())),
    (@c2, @p2, DATEADD(DAY, -7, @today), '18:00:00', '20:00:00', 1200000, 1200000, 'COMPLETED', DATEADD(DAY, -9, GETDATE())),
    (@c1, @p3, DATEADD(DAY, -10, @today), '17:00:00', '19:00:00', 700000, 700000, 'COMPLETED', DATEADD(DAY, -12, GETDATE())),
    (@c4, @p1, DATEADD(DAY, -14, @today), '18:00:00', '20:00:00', 400000, 400000, 'COMPLETED', DATEADD(DAY, -16, GETDATE())),
    (@c2, @p4, DATEADD(DAY, -20, @today), '17:00:00', '19:00:00', 1100000, 1100000, 'COMPLETED', DATEADD(DAY, -22, GETDATE()));

    -- Sinh giao dịch thanh toán (transactions) tương ứng cho các booking đã hoàn thành hoặc đặt cọc
    INSERT INTO [dbo].[transactions] ([booking_id], [user_id], [amount], [transaction_type], [payment_method], [status], [created_at])
    SELECT 
        b.[booking_id],
        b.[user_id],
        CASE 
            WHEN b.[status] = 'COMPLETED' THEN b.[total_price]
            ELSE ISNULL(b.[deposit_amount], b.[total_price] * 0.5)
        END,
        CASE 
            WHEN b.[status] = 'COMPLETED' THEN 'FULL_PAYMENT'
            WHEN b.[status] = 'CANCELLED' THEN 'REFUND'
            ELSE 'DEPOSIT'
        END,
        CASE (b.[booking_id] % 4)
            WHEN 0 THEN 'VNPAY'
            WHEN 1 THEN 'MOMO'
            WHEN 2 THEN 'BANK_TRANSFER'
            ELSE 'CASH'
        END,
        'SUCCESS',
        b.[created_at]
    FROM [dbo].[bookings] b
    WHERE NOT EXISTS (SELECT 1 FROM [dbo].[transactions] t WHERE t.[booking_id] = b.[booking_id]);
END
PRINT N'✅ [4/7] Đã nạp dữ liệu lịch đặt sân (bookings) và giao dịch thanh toán (transactions).';
GO

-- -----------------------------------------------------------------------------------
-- 5. ĐỘI BÓNG, CÁP KÈO, ĐÁNH GIÁ & THÔNG BÁO
-- -----------------------------------------------------------------------------------
DECLARE @sportFb INT = (SELECT TOP 1 [sport_id] FROM [dbo].[sports] WHERE [sport_name] = N'Bóng đá');
DECLARE @cap1 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'luan.player@sportlink.vn');
DECLARE @cap2 INT = (SELECT TOP 1 [user_id] FROM [dbo].[users] WHERE [email] = 'thuan.player@sportlink.vn');
DECLARE @courtFb INT = (SELECT TOP 1 [court_id] FROM [dbo].[courts] WHERE [court_name] = N'Sân Bóng Đá SportLink Man Thiện - Sân 5A');

IF @cap1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[teams] WHERE [team_name] = N'PTIT Storm FC')
BEGIN
    INSERT INTO [dbo].[teams] ([team_name], [sport_id], [captain_id], [level], [points], [matches_played], [wins], [losses], [draws], [invite_code])
    VALUES (N'PTIT Storm FC', @sportFb, @cap1, N'Bán chuyên', 1120, 8, 6, 1, 1, 'PTIT2026');
END

IF @cap2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[teams] WHERE [team_name] = N'Thủ Đức United')
BEGIN
    INSERT INTO [dbo].[teams] ([team_name], [sport_id], [captain_id], [level], [points], [matches_played], [wins], [losses], [draws], [invite_code])
    VALUES (N'Thủ Đức United', @sportFb, @cap2, N'Phong trào', 1045, 6, 3, 2, 1, 'TDU2026');
END

IF @cap1 IS NOT NULL AND @courtFb IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[matches] WHERE [creator_id] = @cap1)
BEGIN
    INSERT INTO [dbo].[matches] ([creator_id], [sport_id], [court_id], [match_type], [start_time], [end_time], [max_players], [current_players], [estimated_cost_per_person], [level], [status])
    VALUES (
        @cap1,
        @sportFb,
        @courtFb,
        'FIND_PLAYER',
        DATEADD(HOUR, 18, CAST(CAST(DATEADD(DAY, 1, GETDATE()) AS DATE) AS DATETIME)),
        DATEADD(HOUR, 20, CAST(CAST(DATEADD(DAY, 1, GETDATE()) AS DATE) AS DATETIME)),
        10,
        7,
        70000,
        N'Phong trào vui vẻ',
        'OPEN'
    );
END

PRINT N'✅ [5/7] Đã nạp dữ liệu đội bóng (teams) và cáp kèo (matches).';
PRINT N'🎉 HOÀN TẤT NẠP DỮ LIỆU MẪU HỆ THỐNG SPORTLINK!';
GO

