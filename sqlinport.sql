USE [sportlink_db]
GO

-- ===================================================================================
-- SPORTLINK - SCRIPT THÊM TÀI KHOẢN MẪU KIỂM THỬ (TEST DATA)
-- Thư mục: /dulieu/insert_sample_users.sql
-- Mô tả: File này dùng cho toàn bộ thành viên trong nhóm để thêm sẵn 4 tài khoản mẫu
--        đại diện cho 4 vai trò (Admin, Owner, Staff, Player) vào SQL Server.
-- Mật khẩu chung: password123
-- ===================================================================================

SET NOCOUNT ON;

-- 1. Cập nhật check constraint để hỗ trợ đủ 4 vai trò: PLAYER, STAFF, OWNER, ADMIN
-- (Nếu constraint cũ chỉ mới có PLAYER, STAFF, OWNER thì lệnh này tự động cập nhật thêm ADMIN)
DECLARE @chkName NVARCHAR(256) = (
    SELECT name FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.users') AND definition LIKE '%role%'
);
IF @chkName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [dbo].[users] DROP CONSTRAINT ' + @chkName);
    ALTER TABLE [dbo].[users] WITH CHECK ADD CHECK (([role]='PLAYER' OR [role]='STAFF' OR [role]='OWNER' OR [role]='ADMIN'));
    PRINT N'✅ [1/2] Đã kiểm tra và cập nhật ràng buộc cột [role] hỗ trợ: PLAYER, STAFF, OWNER, ADMIN.';
END
ELSE
BEGIN
    PRINT N'✅ [1/2] Ràng buộc [role] hợp lệ.';
END
GO

-- 2. Thêm 4 tài khoản mẫu với mật khẩu đã hash bcrypt (password123)
-- Hash Bcrypt (Salt 12): $2b$12$owjterp9i3dfQG5lu2uHWuNZRARBDtUN9Wqga3tYwTi3fKjRFhzAS
DECLARE @passwordHash VARCHAR(255) = '$2b$12$owjterp9i3dfQG5lu2uHWuNZRARBDtUN9Wqga3tYwTi3fKjRFhzAS';

-- 2.1 Quản trị viên (ADMIN)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'admin@sportlink.vn' OR [phone] = '0901000001')
BEGIN
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
    VALUES (N'Nguyễn Quản Trị', '0901000001', 'admin@sportlink.vn', @passwordHash, 'ADMIN', 5.0, GETDATE());
    PRINT N'✨ Đã thêm: Admin (admin@sportlink.vn | SĐT: 0901000001 | Pass: password123)';
END
ELSE
BEGIN
    PRINT N'ℹ️ Tài khoản Admin (admin@sportlink.vn) đã tồn tại.';
END

-- 2.2 Chủ sân bóng (OWNER)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner@sportlink.vn' OR [phone] = '0901000002')
BEGIN
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
    VALUES (N'Trần Chủ Sân', '0901000002', 'owner@sportlink.vn', @passwordHash, 'OWNER', 5.0, GETDATE());
    PRINT N'✨ Đã thêm: Owner (owner@sportlink.vn | SĐT: 0901000002 | Pass: password123)';
END
ELSE
BEGIN
    PRINT N'ℹ️ Tài khoản Owner (owner@sportlink.vn) đã tồn tại.';
END

-- 2.3 Nhân viên vận hành (STAFF)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'staff@sportlink.vn' OR [phone] = '0901000003')
BEGIN
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
    VALUES (N'Lê Nhân Viên', '0901000003', 'staff@sportlink.vn', @passwordHash, 'STAFF', 5.0, GETDATE());
    PRINT N'✨ Đã thêm: Staff (staff@sportlink.vn | SĐT: 0901000003 | Pass: password123)';
END
ELSE
BEGIN
    PRINT N'ℹ️ Tài khoản Staff (staff@sportlink.vn) đã tồn tại.';
END

-- 2.4 Người chơi (PLAYER)
IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'player@sportlink.vn' OR [phone] = '0901000004')
BEGIN
    INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
    VALUES (N'Phạm Người Chơi', '0901000004', 'player@sportlink.vn', @passwordHash, 'PLAYER', 5.0, GETDATE());
    PRINT N'✨ Đã thêm: Player (player@sportlink.vn | SĐT: 0901000004 | Pass: password123)';
END
ELSE
BEGIN
    PRINT N'ℹ️ Tài khoản Player (player@sportlink.vn) đã tồn tại.';
END
GO

PRINT N'-----------------------------------------------------------------------------------';
PRINT N'🚀 [2/2] HOÀN TẤT! DANH SÁCH TÀI KHOẢN MẪU HIỆN CÓ TRONG HỆ THỐNG:';
PRINT N'-----------------------------------------------------------------------------------';

-- 3. Hiển thị bảng kết quả cho đồng đội kiểm tra ngay trên màn hình SQL Server
SELECT 
    [user_id]          AS [ID],
    [full_name]        AS [Họ và Tên],
    [role]             AS [Vai trò (RBAC)],
    [email]            AS [Email Đăng nhập],
    [phone]            AS [Số điện thoại],
    'password123'      AS [Mật khẩu kiểm thử],
    [created_at]       AS [Ngày tạo]
FROM [dbo].[users]
WHERE [email] IN ('admin@sportlink.vn', 'owner@sportlink.vn', 'staff@sportlink.vn', 'player@sportlink.vn')
ORDER BY [user_id] ASC;
GO
