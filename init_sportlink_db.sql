-- ===================================================================================
-- SPORTLINK - FILE KHỞI TẠO CƠ SỞ DỮ LIỆU MẪU (FULL SCHEMA)
-- Mô tả: Dành cho thành viên mới clone dự án về máy chưa có sẵn database [sportlink_db].
-- Cách dùng:
--   1. Mở file này trong SQL Server Management Studio (SSMS) hoặc Azure Data Studio và chạy (Execute).
--   2. Tiếp theo vào thư mục backend chạy:
--        npm run db:migrate
--        npm run db:seed
--   3. (Tùy chọn) Chạy thêm sqlinport.sql để thêm 4 tài khoản mẫu (Admin, Owner, Staff, Player).
-- ===================================================================================

IF DB_ID(N'sportlink_db') IS NULL
BEGIN
    CREATE DATABASE [sportlink_db];
END
GO

USE [sportlink_db];
GO

SET NOCOUNT ON;
GO

-- 1. Bảng người dùng (users)
IF OBJECT_ID(N'[dbo].[users]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[users] (
        [user_id]          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [full_name]        NVARCHAR(100)     NOT NULL,
        [phone]            VARCHAR(20)       NOT NULL UNIQUE,
        [email]            VARCHAR(100)      NOT NULL UNIQUE,
        [password_hash]    VARCHAR(255)      NOT NULL,
        [role]             VARCHAR(20)       NOT NULL DEFAULT 'PLAYER'
            CHECK ([role] = 'PLAYER' OR [role] = 'STAFF' OR [role] = 'OWNER' OR [role] = 'ADMIN'),
        [reputation_score] FLOAT             NULL     DEFAULT (5.0),
        [created_at]       DATETIME          NULL     DEFAULT (GETDATE()),
        [avatar_url]       NVARCHAR(500)     NULL,
        [status]           VARCHAR(20)       NOT NULL DEFAULT 'ACTIVE',
        [owner_id]         INT               NULL,
        [job_title]        NVARCHAR(100)     NULL
    );
END
GO

-- 2. Bảng loại môn thể thao (sports)
IF OBJECT_ID(N'[dbo].[sports]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[sports] (
        [sport_id]    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [sport_name]  NVARCHAR(100)     NOT NULL,
        [description] NVARCHAR(MAX)     NULL,
        [status]      VARCHAR(20)       NOT NULL DEFAULT 'ACTIVE',
        [owner_id]    INT               NULL,
        [created_at]  DATETIME          NULL     DEFAULT (GETDATE()),
        [updated_at]  DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_sports_owner] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 3. Bảng cơ sở sân (facilities)
IF OBJECT_ID(N'[dbo].[facilities]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[facilities] (
        [facility_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [owner_id]    INT               NOT NULL,
        [name]        NVARCHAR(150)     NOT NULL,
        [address]     NVARCHAR(255)     NOT NULL,
        [phone]       VARCHAR(20)       NULL,
        [description] NVARCHAR(MAX)     NULL,
        [status]      VARCHAR(20)       NOT NULL DEFAULT 'ACTIVE',
        [created_at]  DATETIME          NULL     DEFAULT (GETDATE()),
        [updated_at]  DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_facilities_owner] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 4. Bảng cấu hình môn thể thao riêng theo từng Chủ sân (owner_sports)
IF OBJECT_ID(N'[dbo].[owner_sports]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[owner_sports] (
        [owner_id]           INT           NOT NULL,
        [sport_id]           INT           NOT NULL,
        [custom_name]        NVARCHAR(100) NULL,
        [custom_description] NVARCHAR(500) NULL,
        [status]             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
        [updated_at]         DATETIME      NULL     DEFAULT (GETDATE()),
        CONSTRAINT [pk_owner_sports]       PRIMARY KEY CLUSTERED ([owner_id] ASC, [sport_id] ASC),
        CONSTRAINT [fk_owner_sports_user]  FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_owner_sports_sport] FOREIGN KEY ([sport_id]) REFERENCES [dbo].[sports]([sport_id])
    );
END
GO

-- 5. Bảng sân con (courts)
IF OBJECT_ID(N'[dbo].[courts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[courts] (
        [court_id]    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [owner_id]    INT               NOT NULL,
        [sport_id]    INT               NOT NULL,
        [facility_id] INT               NULL,
        [court_name]  NVARCHAR(100)     NOT NULL,
        [address]     NVARCHAR(255)     NULL,
        [latitude]    DECIMAL(10, 8)    NULL,
        [longitude]   DECIMAL(11, 8)    NULL,
        [capacity]    INT               NULL,
        [description] NVARCHAR(MAX)     NULL,
        [utilities]   NVARCHAR(MAX)     NULL,
        [status]      VARCHAR(20)       NULL     DEFAULT 'ACTIVE'
            CHECK ([status] = 'ACTIVE' OR [status] = 'INACTIVE' OR [status] = 'CLOSED' OR [status] = 'MAINTENANCE'),
        [images]      NVARCHAR(MAX)     NULL,
        [created_at]  DATETIME          NULL     DEFAULT (GETDATE()),
        [updated_at]  DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_courts_owner]    FOREIGN KEY ([owner_id])    REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_courts_sport]    FOREIGN KEY ([sport_id])    REFERENCES [dbo].[sports]([sport_id]),
        CONSTRAINT [fk_courts_facility] FOREIGN KEY ([facility_id]) REFERENCES [dbo].[facilities]([facility_id])
    );
END
GO

-- 6. Bảng khung giá sân (court_prices)
IF OBJECT_ID(N'[dbo].[court_prices]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[court_prices] (
        [price_id]   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [court_id]   INT               NOT NULL,
        [day_type]   VARCHAR(20)       NOT NULL
            CHECK ([day_type] = 'HOLIDAY' OR [day_type] = 'WEEKEND' OR [day_type] = 'WEEKDAY'),
        [start_time] TIME              NOT NULL,
        [end_time]   TIME              NOT NULL,
        [price]      DECIMAL(10, 2)    NOT NULL,
        CONSTRAINT [fk_court_prices_court] FOREIGN KEY ([court_id]) REFERENCES [dbo].[courts]([court_id])
    );
END
GO

-- 7. Bảng lịch bảo trì sân (court_maintenances)
IF OBJECT_ID(N'[dbo].[court_maintenances]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[court_maintenances] (
        [maintenance_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [court_id]       INT               NOT NULL,
        [start_time]     DATETIME          NOT NULL,
        [end_time]       DATETIME          NOT NULL,
        [reason]         NVARCHAR(MAX)     NULL,
        CONSTRAINT [fk_court_maintenances_court] FOREIGN KEY ([court_id]) REFERENCES [dbo].[courts]([court_id])
    );
END
GO

-- 8. Bảng phân công nhân viên theo sân (court_staff)
IF OBJECT_ID(N'[dbo].[court_staff]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[court_staff] (
        [assignment_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [staff_id]      INT               NOT NULL,
        [court_id]      INT               NOT NULL,
        [assigned_by]   INT               NOT NULL,
        [assigned_at]   DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [unique_staff_court] UNIQUE NONCLUSTERED ([staff_id] ASC, [court_id] ASC)
    );
END
GO

-- 9. Bảng đội thể thao (teams)
IF OBJECT_ID(N'[dbo].[teams]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[teams] (
        [team_id]        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [team_name]      NVARCHAR(100)     NOT NULL,
        [sport_id]       INT               NOT NULL,
        [captain_id]     INT               NOT NULL,
        [level]          NVARCHAR(50)      NULL,
        [created_at]     DATETIME          NULL     DEFAULT (GETDATE()),
        [points]         INT               NULL     DEFAULT (1000),
        [matches_played] INT               NULL     DEFAULT (0),
        [wins]           INT               NULL     DEFAULT (0),
        [losses]         INT               NULL     DEFAULT (0),
        [draws]          INT               NULL     DEFAULT (0),
        [invite_code]    VARCHAR(32)       NULL,
        CONSTRAINT [fk_teams_sport]   FOREIGN KEY ([sport_id])   REFERENCES [dbo].[sports]([sport_id]),
        CONSTRAINT [fk_teams_captain] FOREIGN KEY ([captain_id]) REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 10. Bảng thành viên đội (team_members)
IF OBJECT_ID(N'[dbo].[team_members]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[team_members] (
        [team_id]   INT      NOT NULL,
        [user_id]   INT      NOT NULL,
        [joined_at] DATETIME NULL DEFAULT (GETDATE()),
        CONSTRAINT [pk_team_members] PRIMARY KEY CLUSTERED ([team_id] ASC, [user_id] ASC),
        CONSTRAINT [fk_team_members_team] FOREIGN KEY ([team_id]) REFERENCES [dbo].[teams]([team_id]),
        CONSTRAINT [fk_team_members_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 11. Bảng trận đấu / cáp kèo (matches)
IF OBJECT_ID(N'[dbo].[matches]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[matches] (
        [match_id]                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [creator_id]                INT               NOT NULL,
        [sport_id]                  INT               NOT NULL,
        [court_id]                  INT               NULL,
        [team_id]                   INT               NULL,
        [match_type]                VARCHAR(20)       NOT NULL
            CHECK ([match_type] = 'FIND_OPPONENT' OR [match_type] = 'FIND_PLAYER'),
        [start_time]                DATETIME          NOT NULL,
        [end_time]                  DATETIME          NOT NULL,
        [max_players]               INT               NOT NULL,
        [current_players]           INT               NULL     DEFAULT (1),
        [estimated_cost_per_person] DECIMAL(10, 2)    NULL,
        [level]                     NVARCHAR(50)      NULL,
        [status]                    VARCHAR(20)       NULL     DEFAULT 'OPEN'
            CHECK ([status] = 'CANCELLED' OR [status] = 'COMPLETED' OR [status] = 'CONFIRMED' OR [status] = 'FULL' OR [status] = 'OPEN'),
        [created_at]                DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_matches_creator] FOREIGN KEY ([creator_id]) REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_matches_sport]   FOREIGN KEY ([sport_id])   REFERENCES [dbo].[sports]([sport_id]),
        CONSTRAINT [fk_matches_court]   FOREIGN KEY ([court_id])   REFERENCES [dbo].[courts]([court_id]),
        CONSTRAINT [fk_matches_team]    FOREIGN KEY ([team_id])    REFERENCES [dbo].[teams]([team_id])
    );
END
GO

-- 12. Bảng người tham gia trận đấu (match_participants)
IF OBJECT_ID(N'[dbo].[match_participants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[match_participants] (
        [participant_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [match_id]       INT               NOT NULL,
        [user_id]        INT               NOT NULL,
        [team_side]      VARCHAR(20)       NULL
            CHECK ([team_side] IS NULL OR [team_side] = 'TEAM_B' OR [team_side] = 'TEAM_A'),
        [payment_status] VARCHAR(20)       NULL     DEFAULT 'PENDING'
            CHECK ([payment_status] = 'PAID' OR [payment_status] = 'PENDING'),
        [amount_to_pay]  DECIMAL(10, 2)    NULL     DEFAULT (0.00),
        [joined_at]      DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_match_participants_match] FOREIGN KEY ([match_id]) REFERENCES [dbo].[matches]([match_id]),
        CONSTRAINT [fk_match_participants_user]  FOREIGN KEY ([user_id])  REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 13. Bảng đặt sân (bookings)
IF OBJECT_ID(N'[dbo].[bookings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[bookings] (
        [booking_id]     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [court_id]       INT               NOT NULL,
        [user_id]        INT               NOT NULL,
        [match_id]       INT               NULL,
        [booking_date]   DATE              NOT NULL,
        [start_time]     TIME              NOT NULL,
        [end_time]       TIME              NOT NULL,
        [total_price]    DECIMAL(10, 2)    NOT NULL,
        [deposit_amount] DECIMAL(10, 2)    NULL     DEFAULT (0.00),
        [status]         VARCHAR(20)       NULL     DEFAULT 'PENDING'
            CHECK ([status] = 'NO-SHOW' OR [status] = 'CANCELLED' OR [status] = 'COMPLETED' OR [status] = 'CHECKED-IN' OR [status] = 'CONFIRMED' OR [status] = 'PENDING'),
        [created_at]     DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_bookings_court] FOREIGN KEY ([court_id]) REFERENCES [dbo].[courts]([court_id]),
        CONSTRAINT [fk_bookings_user]  FOREIGN KEY ([user_id])  REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_bookings_match] FOREIGN KEY ([match_id]) REFERENCES [dbo].[matches]([match_id])
    );
END
GO

-- 14. Bảng giao dịch thanh toán (transactions)
IF OBJECT_ID(N'[dbo].[transactions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[transactions] (
        [transaction_id]   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [booking_id]       INT               NULL,
        [user_id]          INT               NOT NULL,
        [amount]           DECIMAL(10, 2)    NOT NULL,
        [transaction_type] VARCHAR(20)       NOT NULL
            CHECK ([transaction_type] = 'REFUND' OR [transaction_type] = 'FULL_PAYMENT' OR [transaction_type] = 'DEPOSIT'),
        [payment_method]   VARCHAR(20)       NOT NULL
            CHECK ([payment_method] = 'BANK_TRANSFER' OR [payment_method] = 'CASH' OR [payment_method] = 'VNPAY' OR [payment_method] = 'MOMO'),
        [status]           VARCHAR(20)       NULL     DEFAULT 'PENDING'
            CHECK ([status] = 'FAILED' OR [status] = 'PENDING' OR [status] = 'SUCCESS'),
        [created_at]       DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_transactions_booking] FOREIGN KEY ([booking_id]) REFERENCES [dbo].[bookings]([booking_id]),
        CONSTRAINT [fk_transactions_user]    FOREIGN KEY ([user_id])    REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 15. Bảng đánh giá người chơi (reviews)
IF OBJECT_ID(N'[dbo].[reviews]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[reviews] (
        [review_id]       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [match_id]        INT               NOT NULL,
        [reviewer_id]     INT               NOT NULL,
        [target_user_id]  INT               NOT NULL,
        [rating_punctual] INT               NULL CHECK ([rating_punctual] IS NULL OR ([rating_punctual] >= 1 AND [rating_punctual] <= 5)),
        [rating_friendly] INT               NULL CHECK ([rating_friendly] IS NULL OR ([rating_friendly] >= 1 AND [rating_friendly] <= 5)),
        [rating_fairplay] INT               NULL CHECK ([rating_fairplay] IS NULL OR ([rating_fairplay] >= 1 AND [rating_fairplay] <= 5)),
        [rating_teamwork] INT               NULL CHECK ([rating_teamwork] IS NULL OR ([rating_teamwork] >= 1 AND [rating_teamwork] <= 5)),
        [comment]         NVARCHAR(MAX)     NULL,
        [created_at]      DATETIME          NULL DEFAULT (GETDATE()),
        CONSTRAINT [fk_reviews_match]       FOREIGN KEY ([match_id])       REFERENCES [dbo].[matches]([match_id]),
        CONSTRAINT [fk_reviews_reviewer]    FOREIGN KEY ([reviewer_id])    REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_reviews_target_user] FOREIGN KEY ([target_user_id]) REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 16. Bảng thông báo (notifications)
IF OBJECT_ID(N'[dbo].[notifications]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[notifications] (
        [notification_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [user_id]         INT               NOT NULL,
        [title]           NVARCHAR(255)     NOT NULL,
        [content]         NVARCHAR(MAX)     NOT NULL,
        [is_read]         BIT               NULL     DEFAULT (0),
        [created_at]      DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_notifications_user] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 17. Bảng hội thoại chat (conversations)
IF OBJECT_ID(N'[dbo].[conversations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[conversations] (
        [conversation_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [type]            VARCHAR(20)       NOT NULL
            CHECK ([type] = 'INTER_TEAM' OR [type] = 'MATCH_CHAT' OR [type] = 'TEAM_CHAT' OR [type] = 'PRIVATE'),
        [team_id]         INT               NULL,
        [match_id]        INT               NULL,
        [title]           NVARCHAR(150)     NULL,
        [created_at]      DATETIME          NULL     DEFAULT (GETDATE()),
        [updated_at]      DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_conversations_team]  FOREIGN KEY ([team_id])  REFERENCES [dbo].[teams]([team_id]),
        CONSTRAINT [fk_conversations_match] FOREIGN KEY ([match_id]) REFERENCES [dbo].[matches]([match_id])
    );
END
GO

-- 18. Bảng người tham gia hội thoại (conversation_participants)
IF OBJECT_ID(N'[dbo].[conversation_participants]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[conversation_participants] (
        [participant_id]  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [conversation_id] INT               NOT NULL,
        [user_id]         INT               NOT NULL,
        [joined_at]       DATETIME          NULL     DEFAULT (GETDATE()),
        [last_read_at]    DATETIME          NULL,
        CONSTRAINT [fk_conv_participants_conv] FOREIGN KEY ([conversation_id]) REFERENCES [dbo].[conversations]([conversation_id]),
        CONSTRAINT [fk_conv_participants_user] FOREIGN KEY ([user_id])         REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [unique_participant] UNIQUE NONCLUSTERED ([conversation_id] ASC, [user_id] ASC)
    );
END
GO

-- 19. Bảng tin nhắn (messages)
IF OBJECT_ID(N'[dbo].[messages]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[messages] (
        [message_id]      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [conversation_id] INT               NOT NULL,
        [sender_id]       INT               NOT NULL,
        [message_type]    VARCHAR(20)       NULL     DEFAULT 'TEXT'
            CHECK ([message_type] = 'PROPOSAL' OR [message_type] = 'SYSTEM' OR [message_type] = 'IMAGE' OR [message_type] = 'TEXT'),
        [content]         NVARCHAR(MAX)     NOT NULL,
        [created_at]      DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_messages_conversation] FOREIGN KEY ([conversation_id]) REFERENCES [dbo].[conversations]([conversation_id]),
        CONSTRAINT [fk_messages_sender]       FOREIGN KEY ([sender_id])       REFERENCES [dbo].[users]([user_id])
    );
END
GO

-- 20. Bảng thách đấu giữa các đội (team_challenges)
IF OBJECT_ID(N'[dbo].[team_challenges]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[team_challenges] (
        [challenge_id]              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [challenger_team_id]        INT               NOT NULL,
        [challenged_team_id]        INT               NOT NULL,
        [sport_id]                  INT               NOT NULL,
        [court_id]                  INT               NULL,
        [match_date]                DATE              NULL,
        [start_time]                VARCHAR(10)       NULL,
        [end_time]                  VARCHAR(10)       NULL,
        [status]                    VARCHAR(30)       NULL     DEFAULT 'NEGOTIATING',
        [winner_team_id]            INT               NULL,
        [score]                     VARCHAR(20)       NULL,
        [challenger_points_awarded] INT               NULL     DEFAULT (0),
        [challenged_points_awarded] INT               NULL     DEFAULT (0),
        [is_higher_rank_challenge]  BIT               NULL     DEFAULT (0),
        [confirmed_by_owner_id]     INT               NULL,
        [confirmed_at]              DATETIME          NULL,
        [conversation_id]           INT               NULL,
        [created_at]                DATETIME          NULL     DEFAULT (GETDATE()),
        CONSTRAINT [fk_challenges_challenger]  FOREIGN KEY ([challenger_team_id])    REFERENCES [dbo].[teams]([team_id]),
        CONSTRAINT [fk_challenges_challenged]  FOREIGN KEY ([challenged_team_id])    REFERENCES [dbo].[teams]([team_id]),
        CONSTRAINT [fk_challenges_sport]       FOREIGN KEY ([sport_id])              REFERENCES [dbo].[sports]([sport_id]),
        CONSTRAINT [fk_challenges_court]       FOREIGN KEY ([court_id])              REFERENCES [dbo].[courts]([court_id]),
        CONSTRAINT [fk_challenges_winner]      FOREIGN KEY ([winner_team_id])        REFERENCES [dbo].[teams]([team_id]),
        CONSTRAINT [fk_challenges_owner]       FOREIGN KEY ([confirmed_by_owner_id]) REFERENCES [dbo].[users]([user_id]),
        CONSTRAINT [fk_challenges_conv]        FOREIGN KEY ([conversation_id])       REFERENCES [dbo].[conversations]([conversation_id])
    );
END
GO

PRINT N'✅ Đã khởi tạo xong toàn bộ cấu trúc bảng cho database [sportlink_db]!';
GO
