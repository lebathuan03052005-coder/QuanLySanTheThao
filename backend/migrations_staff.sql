-- =====================================================================
-- BẢN NÂNG CẤP CƠ SỞ DỮ LIỆU: MODULE [3.X] QUẢN LÝ NHÂN VIÊN VÀ PHÂN QUYỀN
-- =====================================================================

-- 1. Bổ sung cột status vào bảng users (ACTIVE: Hoạt động, LOCKED: Bị khóa, INACTIVE: Ngừng hoạt động)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
    AND name = 'status'
)
BEGIN
    ALTER TABLE [dbo].[users] ADD [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
    PRINT 'Đã thêm cột status vào bảng users thành công.';
END
ELSE
BEGIN
    PRINT 'Cột status đã tồn tại trong bảng users.';
END
GO

-- 2. Bổ sung cột owner_id vào bảng users (Chủ sân quản lý nhân viên này, phục vụ Data Isolation)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
    AND name = 'owner_id'
)
BEGIN
    ALTER TABLE [dbo].[users] ADD [owner_id] INT NULL;
    PRINT 'Đã thêm cột owner_id vào bảng users thành công.';
END
ELSE
BEGIN
    PRINT 'Cột owner_id đã tồn tại trong bảng users.';
END
GO

-- 3. Bổ sung cột job_title vào bảng users (Chức danh công việc của nhân viên)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[users]') 
    AND name = 'job_title'
)
BEGIN
    ALTER TABLE [dbo].[users] ADD [job_title] NVARCHAR(100) NULL;
    PRINT 'Đã thêm cột job_title vào bảng users thành công.';
END
ELSE
BEGIN
    PRINT 'Cột job_title đã tồn tại trong bảng users.';
END
GO

-- 4. Tạo bảng liên kết phân công nhân viên vào các sân cụ thể (court_staff)
IF NOT EXISTS (
    SELECT * FROM sys.tables 
    WHERE object_id = OBJECT_ID(N'[dbo].[court_staff]')
)
BEGIN
    CREATE TABLE [dbo].[court_staff] (
        [assignment_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [staff_id] INT NOT NULL,
        [court_id] INT NOT NULL,
        [assigned_by] INT NOT NULL,
        [assigned_at] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [unique_staff_court] UNIQUE NONCLUSTERED ([staff_id] ASC, [court_id] ASC)
    );
    PRINT 'Đã tạo bảng court_staff thành công.';
END
ELSE
BEGIN
    PRINT 'Bảng court_staff đã tồn tại.';
END
GO
