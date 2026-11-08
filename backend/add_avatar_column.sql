-- Thêm cột avatar_url vào bảng users nếu chưa tồn tại
USE [SportLink];
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
    AND name = 'avatar_url'
)
BEGIN
    ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
    PRINT 'Đã thêm cột avatar_url vào bảng users thành công.';
END
ELSE
BEGIN
    PRINT 'Cột avatar_url đã tồn tại trong bảng users.';
END
GO
