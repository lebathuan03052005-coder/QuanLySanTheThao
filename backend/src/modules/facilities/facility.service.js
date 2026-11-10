import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';
import { ensureSportSchema } from '../sports/sport.service.js';

/**
 * ============================================================================
 * SPORTLINK - FACILITY & SUB-COURT SERVICE
 * Đáp ứng đặc tả chức năng WBS 3.1 (S2-02): Quản lý cơ sở sân & danh sách sân con
 * - Mỗi tài khoản Chủ sân (OWNER) quản lý riêng các Cơ sở sân và Sân con của mình.
 * - Không ép tạo cơ sở mặc định rỗng cho mọi Owner; chỉ gom các sân mà Owner đó
 *   thực sự đang sở hữu trong bảng [courts].
 * - Khởi tạo sẵn 2 tài khoản Chủ sân mới (owner2@sportlink.vn, owner3@sportlink.vn)
 *   cùng bộ cơ sở & sân con riêng biệt để phục vụ kiểm thử phân tách dữ liệu.
 * ============================================================================
 */

let facilitySchemaReady = false;
let facilitySchemaInitPromise = null;

// Mật khẩu chuẩn 'password123' đã băm bcrypt chính xác
const DEFAULT_PASSWORD_HASH = '$2b$10$aDwmWQCA0.YZ3PiBtLyNhOwq7CUY6d0Gw09A3QQ6FOfR4KuXToNmi';

/**
 * Tự động đồng bộ cấu trúc bảng [facilities], [courts] và khởi tạo dữ liệu riêng biệt
 * cho từng tài khoản Chủ sân mẫu (owner, owner2, owner3).
 * @param {number} [ownerId]
 */
export async function ensureFacilitySchema(ownerId) {
  await ensureSportSchema();
  const pool = await getPool();

  if (!facilitySchemaReady) {
    if (!facilitySchemaInitPromise) {
      facilitySchemaInitPromise = (async () => {
        try {
          // 1. Tạo bảng facilities nếu chưa tồn tại
          await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'facilities')
            BEGIN
              CREATE TABLE [dbo].[facilities] (
                [facility_id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                [owner_id] INT NOT NULL,
                [name] NVARCHAR(150) NOT NULL,
                [address] NVARCHAR(255) NOT NULL,
                [phone] VARCHAR(20) NULL,
                [description] NVARCHAR(MAX) NULL,
                [status] VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                [created_at] DATETIME DEFAULT GETDATE(),
                [updated_at] DATETIME DEFAULT GETDATE(),
                CONSTRAINT [fk_facilities_owner] FOREIGN KEY ([owner_id]) REFERENCES [dbo].[users]([user_id])
              );
            END
          `);

          // 2. Đảm bảo bảng courts có đủ các cột mở rộng
          await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'facility_id')
            BEGIN
              ALTER TABLE [dbo].[courts] ADD [facility_id] INT NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'capacity')
            BEGIN
              ALTER TABLE [dbo].[courts] ADD [capacity] INT NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'images')
            BEGIN
              ALTER TABLE [dbo].[courts] ADD [images] NVARCHAR(MAX) NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'created_at')
            BEGIN
              ALTER TABLE [dbo].[courts] ADD [created_at] DATETIME DEFAULT GETDATE();
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[courts]') AND name = 'updated_at')
            BEGIN
              ALTER TABLE [dbo].[courts] ADD [updated_at] DATETIME DEFAULT GETDATE();
            END

            DECLARE @courtChkName NVARCHAR(256) = (
              SELECT TOP 1 name FROM sys.check_constraints 
              WHERE parent_object_id = OBJECT_ID('dbo.courts')
                AND definition LIKE '%status%'
                AND definition NOT LIKE '%MAINTENANCE%'
            );
            IF @courtChkName IS NOT NULL
            BEGIN
              EXEC('ALTER TABLE [dbo].[courts] DROP CONSTRAINT [' + @courtChkName + ']');
              ALTER TABLE [dbo].[courts] WITH CHECK ADD CHECK ([status]='ACTIVE' OR [status]='INACTIVE' OR [status]='CLOSED' OR [status]='MAINTENANCE');
            END
          `);

          // 3. Dọn dẹp dữ liệu test cũ bị lỗi mã hóa '?'
          await pool.request().query(`
            DELETE FROM [dbo].[courts]
            WHERE ([court_name] LIKE '%?%' OR [address] LIKE '%?%')
              AND [court_id] NOT IN (SELECT DISTINCT [court_id] FROM [dbo].[bookings] WHERE [court_id] IS NOT NULL);

            UPDATE [dbo].[courts]
            SET [facility_id] = NULL
            WHERE [facility_id] IN (
              SELECT [facility_id] FROM [dbo].[facilities]
              WHERE [name] LIKE '%?%' OR [address] LIKE '%?%'
            );

            DELETE FROM [dbo].[facilities]
            WHERE [name] LIKE '%?%' OR [address] LIKE '%?%';
          `);

          // 4. Đảm bảo có đủ 3 tài khoản Chủ sân (owner, owner2, owner3) để kiểm thử phân quyền & phân tách dữ liệu
          await seedDedicatedOwnersAndFacilities(pool);

          facilitySchemaReady = true;
        } catch (err) {
          console.error('Cảnh báo đồng bộ schema bảng facilities/courts:', err.message);
        } finally {
          facilitySchemaInitPromise = null;
        }
      })();
    }
    await facilitySchemaInitPromise;
  }

  // 5. Nếu một Owner có sẵn sân trong bảng [courts] mà chưa được gắn vào cơ sở nào (facility_id IS NULL),
  //    CHỈ gom những sân mà chính Owner đó đang sở hữu thành cơ sở của riêng Owner đó (không ép tạo cơ sở rỗng).
  if (ownerId !== undefined && ownerId !== null) {
    try {
      const orphanCourtsRes = await pool.request()
        .input('ownerId', ownerId)
        .query(`
          SELECT [court_id], [court_name], [address]
          FROM [dbo].[courts]
          WHERE [owner_id] = @ownerId
            AND ([facility_id] IS NULL OR [facility_id] NOT IN (SELECT [facility_id] FROM [dbo].[facilities]))
        `);

      const orphanCourts = orphanCourtsRes.recordset;
      if (orphanCourts.length > 0) {
        let ownerFacsRes = await pool.request()
          .input('ownerId', ownerId)
          .query('SELECT [facility_id], [name], [address] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');

        // Chỉ khi Owner thực sự đang có sân lẻ trong bảng courts mà chưa có cơ sở nào thì mới tạo cơ sở gom các sân đó lại
        if (ownerFacsRes.recordset.length === 0) {
          const firstAddress = orphanCourts[0].address || 'TP. Thủ Đức, TP.HCM';
          await pool.request()
            .input('ownerId', ownerId)
            .input('name', 'Cơ sở Sân Thể Thao Chính')
            .input('address', firstAddress)
            .query(`
              INSERT INTO [dbo].[facilities] ([owner_id], [name], [address], [phone], [description], [status], [created_at], [updated_at])
              VALUES (@ownerId, @name, @address, '0901234567', N'Cơ sở tự động gom các sân thể thao thuộc quyền sở hữu của chủ sân', 'ACTIVE', GETDATE(), GETDATE());
            `);

          ownerFacsRes = await pool.request()
            .input('ownerId', ownerId)
            .query('SELECT [facility_id], [name], [address] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');
        }

        const targetFacId = ownerFacsRes.recordset[0]?.facility_id;
        if (targetFacId) {
          for (const c of orphanCourts) {
            await pool.request()
              .input('facId', targetFacId)
              .input('courtId', c.court_id)
              .query(`
                UPDATE [dbo].[courts]
                SET [facility_id] = @facId,
                    [capacity] = ISNULL([capacity], 10),
                    [created_at] = ISNULL([created_at], GETDATE()),
                    [updated_at] = ISNULL([updated_at], GETDATE())
                WHERE [court_id] = @courtId
              `);
          }
        }
      }
    } catch (err) {
      console.error('Cảnh báo gom sân lẻ của chủ sân:', err.message);
    }
  }
}

/**
 * Khởi tạo 3 tài khoản Chủ sân độc lập (owner@sportlink.vn, owner2@sportlink.vn, owner3@sportlink.vn)
 * và phân bổ mỗi tài khoản quản lý các Cơ sở sân & Sân con riêng biệt.
 */
async function seedDedicatedOwnersAndFacilities(pool) {
  // 1. Tạo / lấy 3 tài khoản OWNER
  await pool.request()
    .input('pwd', DEFAULT_PASSWORD_HASH)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
        VALUES (N'Trần Chủ Sân (Cụm Man Thiện & Arena)', '0901000002', 'owner@sportlink.vn', @pwd, 'OWNER', 5.0, GETDATE());
      END
      ELSE
      BEGIN
        UPDATE [dbo].[users] SET [role] = 'OWNER', [password_hash] = @pwd WHERE [email] = 'owner@sportlink.vn';
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner2@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
        VALUES (N'Nguyễn Minh Hoàng (Chủ sân Khu CNC)', '0902000002', 'owner2@sportlink.vn', @pwd, 'OWNER', 5.0, GETDATE());
      END
      ELSE
      BEGIN
        UPDATE [dbo].[users] SET [role] = 'OWNER', [full_name] = N'Nguyễn Minh Hoàng (Chủ sân Khu CNC)', [password_hash] = @pwd WHERE [email] = 'owner2@sportlink.vn';
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner3@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [created_at])
        VALUES (N'Lê Quốc Bảo (Chủ sân Làng Đại Học)', '0903000003', 'owner3@sportlink.vn', @pwd, 'OWNER', 5.0, GETDATE());
      END
      ELSE
      BEGIN
        UPDATE [dbo].[users] SET [role] = 'OWNER', [full_name] = N'Lê Quốc Bảo (Chủ sân Làng Đại Học)', [password_hash] = @pwd WHERE [email] = 'owner3@sportlink.vn';
      END
    `);

  const ownersRes = await pool.request().query(`
    SELECT [user_id], [email] FROM [dbo].[users]
    WHERE [email] IN ('owner@sportlink.vn', 'owner2@sportlink.vn', 'owner3@sportlink.vn')
  `);
  const ownerMap = Object.fromEntries(ownersRes.recordset.map((u) => [u.email.toLowerCase(), u.user_id]));

  const owner1Id = ownerMap['owner@sportlink.vn'];
  const owner2Id = ownerMap['owner2@sportlink.vn'];
  const owner3Id = ownerMap['owner3@sportlink.vn'];

  // Lấy map sport_id theo tên môn
  const sportsRes = await pool.request().query('SELECT [sport_id], [sport_name] FROM [dbo].[sports]');
  const findSportId = (keyword) => {
    const found = sportsRes.recordset.find((s) => s.sport_name.toLowerCase().includes(keyword.toLowerCase()));
    return found ? found.sport_id : sportsRes.recordset[0]?.sport_id ?? 0;
  };

  const spFootball = findSportId('bóng đá');
  const spBadminton = findSportId('cầu lông');
  const spPickleball = findSportId('pickleball');
  const spTennis = findSportId('tennis');
  const spBasketball = findSportId('bóng rổ');
  const spVolleyball = findSportId('bóng chuyền');

  // Xóa các cơ sở mặc định rỗng bị sinh trùng lặp trước đây (không có sân con nào gắn vào)
  await pool.request().query(`
    DELETE FROM [dbo].[facilities]
    WHERE ([name] LIKE N'Cơ sở 1 - Cụm Sân Thể Thao%' OR [name] LIKE N'Cơ sở 2 - Tổ Hợp Thể Thao%')
      AND [facility_id] NOT IN (SELECT DISTINCT [facility_id] FROM [dbo].[courts] WHERE [facility_id] IS NOT NULL);

    -- Chuẩn hóa chuỗi tiện ích bị lưu dạng mảng JSON ["A", "B"] về chuỗi bersih "A, B"
    UPDATE [dbo].[courts]
    SET [utilities] = REPLACE(REPLACE(REPLACE([utilities], '[', ''), ']', ''), '"', '')
    WHERE [utilities] LIKE '[[]%' OR [utilities] LIKE '%"%';
  `);

  // --- A. Thiết lập Cơ sở & Sân con cho OWNER 1 (owner@sportlink.vn): Cụm Man Thiện & CLB Cầu Lông Arena ---
  if (owner1Id !== undefined) {
    let o1Facs = await pool.request()
      .input('ownerId', owner1Id)
      .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');

    if (o1Facs.recordset.length === 0) {
      await pool.request()
        .input('ownerId', owner1Id)
        .query(`
          INSERT INTO [dbo].[facilities] ([owner_id], [name], [address], [phone], [description], [status], [created_at], [updated_at])
          VALUES
            (@ownerId, N'Cụm Sân Bóng Đá SportLink Man Thiện', N'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', '0901234567', N'Tổ hợp sân bóng đá cỏ nhân tạo 5 người và 7 người gần Học viện Bưu Chính Viễn Thông (PTIT)', 'ACTIVE', GETDATE(), GETDATE()),
            (@ownerId, N'CLB Cầu Lông SportLink Arena Hiệp Phú', N'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM', '0901234568', N'Tổ hợp sân cầu lông trong nhà thảm PVC chuẩn thi đấu Yonex, có máy lạnh khu vực chờ', 'ACTIVE', GETDATE(), GETDATE());
        `);
      o1Facs = await pool.request()
        .input('ownerId', owner1Id)
        .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');
    }

    const o1Fac1 = o1Facs.recordset[0]?.facility_id;
    const o1Fac2 = o1Facs.recordset[1]?.facility_id || o1Fac1;

    if (o1Fac1 && o1Fac2) {
      await pool.request()
        .input('fac1', o1Fac1)
        .input('fac2', o1Fac2)
        .query(`
          UPDATE [dbo].[facilities]
          SET [name] = N'Cụm Sân Bóng Đá SportLink Man Thiện',
              [address] = N'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM',
              [description] = N'Tổ hợp sân bóng đá cỏ nhân tạo 5 người và 7 người gần Học viện Bưu Chính Viễn Thông (PTIT)'
          WHERE [facility_id] = @fac1 AND [name] LIKE N'Cơ sở 1 -%';

          UPDATE [dbo].[facilities]
          SET [name] = N'CLB Cầu Lông SportLink Arena Hiệp Phú',
              [address] = N'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM',
              [description] = N'Tổ hợp sân cầu lông trong nhà thảm PVC chuẩn thi đấu Yonex, có máy lạnh khu vực chờ'
          WHERE [facility_id] = @fac2 AND [name] LIKE N'Cơ sở 2 -%';
        `);
    }

    // Phân bổ lại các sân gốc (court_id 0, 1, 3, 4) cho Owner 1 với tên Sân 1, Sân 2 rõ ràng
    if (o1Fac1 && o1Fac2) {
      await pool.request()
        .input('owner1Id', owner1Id)
        .input('fac1', o1Fac1)
        .input('fac2', o1Fac2)
        .input('spFootball', spFootball)
        .input('spBadminton', spBadminton)
        .query(`
          UPDATE [dbo].[courts]
          SET [owner_id] = @owner1Id, [facility_id] = @fac1, [sport_id] = @spFootball,
              [court_name] = N'Sân 1 - Bóng Đá Cỏ Nhân Tạo 5 Người (5A)',
              [address] = N'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM',
              [capacity] = 10, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 0;

          UPDATE [dbo].[courts]
          SET [owner_id] = @owner1Id, [facility_id] = @fac1, [sport_id] = @spFootball,
              [court_name] = N'Sân 2 - Bóng Đá Cỏ Nhân Tạo 7 Người (7B)',
              [address] = N'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM',
              [capacity] = 14, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 3;

          UPDATE [dbo].[courts]
          SET [owner_id] = @owner1Id, [facility_id] = @fac2, [sport_id] = @spBadminton,
              [court_name] = N'Sân 1 - Cầu Lông Thảm PVC Tiêu Chuẩn (VIP 1)',
              [address] = N'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM',
              [capacity] = 4, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 1;

          UPDATE [dbo].[courts]
          SET [owner_id] = @owner1Id, [facility_id] = @fac2, [sport_id] = @spBadminton,
              [court_name] = N'Sân 2 - Cầu Lông Thảm PVC Tiêu Chuẩn (VIP 2)',
              [address] = N'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM',
              [capacity] = 4, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 4;
        `);
    }
  }

  // --- B. Thiết lập Cơ sở & Sân con riêng cho OWNER 2 (owner2@sportlink.vn): Khu Công Nghệ Cao & Đặng Văn Bi ---
  if (owner2Id !== undefined) {
    let o2Facs = await pool.request()
      .input('ownerId', owner2Id)
      .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');

    if (o2Facs.recordset.length === 0) {
      await pool.request()
        .input('ownerId', owner2Id)
        .query(`
          INSERT INTO [dbo].[facilities] ([owner_id], [name], [address], [phone], [description], [status], [created_at], [updated_at])
          VALUES
            (@ownerId, N'Trung Tâm Pickleball & Tennis SportLink SHTP', N'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', '0902000002', N'Tổ hợp sân Pickleball có mái che mặt sơn Acrylic 7 lớp và sân Quần vợt Tennis tiêu chuẩn quốc tế', 'ACTIVE', GETDATE(), GETDATE()),
            (@ownerId, N'Nhà Thi Đấu Bóng Rổ Đặng Văn Bi Thủ Đức', N'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', '0902000088', N'Nhà thi đấu bóng rổ sàn gỗ 5x5 và sân bóng rổ 3x3 ngoài trời có hệ thống đèn chiếu sáng LED', 'ACTIVE', GETDATE(), GETDATE());
        `);
      o2Facs = await pool.request()
        .input('ownerId', owner2Id)
        .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');
    }

    const o2Fac1 = o2Facs.recordset[0]?.facility_id;
    const o2Fac2 = o2Facs.recordset[1]?.facility_id || o2Fac1;

    if (o2Fac1 && o2Fac2) {
      // Chuyển các sân Pickleball, Tennis, Bóng rổ (court_id 2, 5, 7, 8) sang thuộc quyền sở hữu của Owner 2
      await pool.request()
        .input('owner2Id', owner2Id)
        .input('fac1', o2Fac1)
        .input('fac2', o2Fac2)
        .input('spPickleball', spPickleball)
        .input('spTennis', spTennis)
        .input('spBasketball', spBasketball)
        .query(`
          UPDATE [dbo].[courts]
          SET [owner_id] = @owner2Id, [facility_id] = @fac1, [sport_id] = @spPickleball,
              [court_name] = N'Sân 1 - Pickleball Có Mái Che (Sân P1)',
              [address] = N'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
              [capacity] = 4, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 2;

          UPDATE [dbo].[courts]
          SET [owner_id] = @owner2Id, [facility_id] = @fac1, [sport_id] = @spPickleball,
              [court_name] = N'Sân 2 - Pickleball Tiêu Chuẩn USAPA (Sân P2)',
              [address] = N'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
              [capacity] = 4, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 5;

          UPDATE [dbo].[courts]
          SET [owner_id] = @owner2Id, [facility_id] = @fac1, [sport_id] = @spTennis,
              [court_name] = N'Sân 3 - Quần Vợt Tennis Mặt Cứng (Sân T1)',
              [address] = N'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
              [capacity] = 4, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 8;

          UPDATE [dbo].[courts]
          SET [owner_id] = @owner2Id, [facility_id] = @fac2, [sport_id] = @spBasketball,
              [court_name] = N'Sân 1 - Bóng Rổ Sàn Gỗ 5x5 Trong Nhà',
              [address] = N'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM',
              [capacity] = 10, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 7;

          IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [facility_id] = @fac2 AND [court_name] LIKE N'Sân 2 - Bóng Rổ 3x3%')
          BEGIN
            INSERT INTO [dbo].[courts] ([facility_id], [owner_id], [sport_id], [court_name], [address], [capacity], [description], [utilities], [status], [created_at], [updated_at])
            VALUES (@fac2, @owner2Id, @spBasketball, N'Sân 2 - Bóng Rổ 3x3 Ngoài Trời', N'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', 6, N'Sân bóng rổ nửa sân 3x3 mặt sơn chống trượt', N'Đèn LED ban đêm, Cho thuê bóng, Tủ đồ cá nhân', 'ACTIVE', GETDATE(), GETDATE());
          END
        `);
    }
  }

  // --- C. Thiết lập Cơ sở & Sân con riêng cho OWNER 3 (owner3@sportlink.vn): Cụm Làng Đại Học Thủ Đức ---
  if (owner3Id !== undefined) {
    let o3Facs = await pool.request()
      .input('ownerId', owner3Id)
      .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');

    if (o3Facs.recordset.length === 0) {
      await pool.request()
        .input('ownerId', owner3Id)
        .query(`
          INSERT INTO [dbo].[facilities] ([owner_id], [name], [address], [phone], [description], [status], [created_at], [updated_at])
          VALUES
            (@ownerId, N'Tổ Hợp Thể Thao Làng Đại Học Thủ Đức', N'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', '0903000003', N'Khu liên hợp thể thao đa năng phục vụ sinh viên Làng Đại học Quốc gia TP.HCM (Bóng đá, Bóng chuyền, Cầu lông)', 'ACTIVE', GETDATE(), GETDATE());
        `);
      o3Facs = await pool.request()
        .input('ownerId', owner3Id)
        .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');
    }

    const o3Fac1 = o3Facs.recordset[0]?.facility_id;
    if (o3Fac1) {
      await pool.request()
        .input('owner3Id', owner3Id)
        .input('fac1', o3Fac1)
        .input('spFootball', spFootball)
        .input('spVolleyball', spVolleyball)
        .input('spBadminton', spBadminton)
        .query(`
          UPDATE [dbo].[courts]
          SET [owner_id] = @owner3Id, [facility_id] = @fac1, [sport_id] = @spFootball,
              [court_name] = N'Sân 1 - Bóng Đá Sinh Viên Làng Đại Học (7 Người)',
              [address] = N'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM',
              [capacity] = 14, [status] = 'ACTIVE', [updated_at] = GETDATE()
          WHERE [court_id] = 6;

          IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [facility_id] = @fac1 AND [sport_id] = @spVolleyball)
          BEGIN
            INSERT INTO [dbo].[courts] ([facility_id], [owner_id], [sport_id], [court_name], [address], [capacity], [description], [utilities], [status], [created_at], [updated_at])
            VALUES (@fac1, @owner3Id, @spVolleyball, N'Sân 2 - Bóng Chuyền Trong Nhà Làng Đại Học', N'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', 12, N'Sân bóng chuyền da và bóng chuyền hơi tiêu chuẩn thi đấu sinh viên', N'Lưới thi đấu chuẩn, Khán đài 100 chỗ, Bãi giữ xe rộng', 'ACTIVE', GETDATE(), GETDATE());
          END

          IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [facility_id] = @fac1 AND [sport_id] = @spBadminton)
          BEGIN
            INSERT INTO [dbo].[courts] ([facility_id], [owner_id], [sport_id], [court_name], [address], [capacity], [description], [utilities], [status], [created_at], [updated_at])
            VALUES (@fac1, @owner3Id, @spBadminton, N'Sân 3 - Cầu Lông Sinh Viên ĐHQG', N'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', 4, N'Sân cầu lông trong nhà giá ưu đãi cho sinh viên', N'Cho thuê vợt, Nước giải khát, Wifi miễn phí', 'ACTIVE', GETDATE(), GETDATE());
          END
        `);
    }
  }
}

/**
 * Lấy danh sách cơ sở thuộc quyền quản lý của OWNER hiện tại kèm danh sách tóm tắt các sân con bên trong.
 * @param {number} ownerId - ID chủ sân trích xuất từ JWT token
 * @param {{ search?: string, status?: string }} filters
 */
export async function getOwnerFacilities(ownerId, filters = {}) {
  await ensureFacilitySchema(ownerId);
  const pool = await getPool();
  const { search = '', status = 'ALL' } = filters;

  let query = `
    SELECT 
      f.facility_id,
      f.owner_id,
      f.name,
      f.address,
      f.phone,
      f.description,
      f.status,
      f.created_at,
      f.updated_at,
      COUNT(c.court_id) AS total_courts,
      SUM(CASE WHEN c.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_courts
    FROM facilities f
    LEFT JOIN courts c ON f.facility_id = c.facility_id
    WHERE f.owner_id = @ownerId
  `;

  if (status && status !== 'ALL') {
    query += ` AND f.status = @status`;
  }

  if (search && search.trim()) {
    query += ` AND (f.name LIKE @search OR f.address LIKE @search OR f.phone LIKE @search)`;
  }

  query += `
    GROUP BY 
      f.facility_id, f.owner_id, f.name, f.address, f.phone, 
      f.description, f.status, f.created_at, f.updated_at
    ORDER BY f.facility_id ASC
  `;

  const request = pool.request().input('ownerId', ownerId);

  if (status && status !== 'ALL') {
    request.input('status', status);
  }

  if (search && search.trim()) {
    request.input('search', `%${search.trim()}%`);
  }

  const result = await request.query(query);
  const facilities = result.recordset;

  // Lấy danh sách tóm tắt sân con của các cơ sở này để hiển thị trực quan trên thẻ Cơ sở
  const facIds = facilities.map((f) => f.facility_id);
  let courtsByFacMap = {};

  if (facIds.length > 0) {
    const courtsRes = await pool.request().query(`
      SELECT 
        c.court_id,
        c.facility_id,
        c.court_name,
        c.sport_id,
        ISNULL(s.sport_name, N'Thể thao') AS sport_name,
        ISNULL(c.capacity, 10) AS capacity,
        ISNULL(c.status, 'ACTIVE') AS status
      FROM courts c
      LEFT JOIN sports s ON c.sport_id = s.sport_id
      WHERE c.facility_id IN (${facIds.join(',')})
      ORDER BY c.court_id ASC
    `);

    for (const c of courtsRes.recordset) {
      if (!courtsByFacMap[c.facility_id]) {
        courtsByFacMap[c.facility_id] = [];
      }
      courtsByFacMap[c.facility_id].push(c);
    }
  }

  return facilities.map((f) => ({
    ...f,
    total_courts: Number(f.total_courts || 0),
    active_courts: Number(f.active_courts || 0),
    courts_preview: courtsByFacMap[f.facility_id] || [],
  }));
}

/**
 * Lấy chi tiết một cơ sở và xác thực quyền sở hữu của OWNER.
 * @param {number} facilityId
 * @param {number} ownerId
 */
export async function getFacilityById(facilityId, ownerId) {
  await ensureFacilitySchema(ownerId);
  const pool = await getPool();
  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .query(`
      SELECT 
        f.facility_id,
        f.owner_id,
        f.name,
        f.address,
        f.phone,
        f.description,
        f.status,
        f.created_at,
        f.updated_at,
        COUNT(c.court_id) AS total_courts,
        SUM(CASE WHEN c.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_courts
      FROM facilities f
      LEFT JOIN courts c ON f.facility_id = c.facility_id
      WHERE f.facility_id = @facilityId AND f.owner_id = @ownerId
      GROUP BY 
        f.facility_id, f.owner_id, f.name, f.address, f.phone, 
        f.description, f.status, f.created_at, f.updated_at
    `);

  const facility = result.recordset[0];
  if (!facility) {
    throw new AppError('Cơ sở không tồn tại hoặc bạn không có quyền truy cập.', 404);
  }
  return facility;
}

/**
 * Thêm cơ sở sân mới gắn với OWNER.
 * @param {number} ownerId
 * @param {{ name: string, address: string, phone?: string, description?: string }} data
 */
export async function createFacility(ownerId, data) {
  await ensureFacilitySchema(ownerId);
  const { name, address, phone = '', description = '' } = data;

  if (!name || !name.trim()) {
    throw new AppError('Tên cơ sở không được để trống.', 400);
  }
  if (!address || !address.trim()) {
    throw new AppError('Địa chỉ cơ sở không được để trống.', 400);
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('name', name.trim())
    .input('address', address.trim())
    .input('phone', phone.trim())
    .input('description', description.trim())
    .query(`
      INSERT INTO facilities (owner_id, name, address, phone, description, status, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (@ownerId, @name, @address, @phone, @description, 'ACTIVE', GETDATE(), GETDATE())
    `);

  return {
    ...result.recordset[0],
    total_courts: 0,
    active_courts: 0,
    courts_preview: [],
  };
}

/**
 * Cập nhật thông tin cơ sở sân.
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {{ name?: string, address?: string, phone?: string, description?: string }} data
 */
export async function updateFacility(facilityId, ownerId, data) {
  await ensureFacilitySchema(ownerId);
  const { name, address, phone, description } = data;

  await getFacilityById(facilityId, ownerId);

  if (name !== undefined && !name.trim()) {
    throw new AppError('Tên cơ sở không được để trống.', 400);
  }
  if (address !== undefined && !address.trim()) {
    throw new AppError('Địa chỉ cơ sở không được để trống.', 400);
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .input('name', name ? name.trim() : null)
    .input('address', address ? address.trim() : null)
    .input('phone', phone !== undefined ? phone.trim() : null)
    .input('description', description !== undefined ? description.trim() : null)
    .query(`
      UPDATE facilities
      SET 
        name = COALESCE(@name, name),
        address = COALESCE(@address, address),
        phone = COALESCE(@phone, phone),
        description = COALESCE(@description, description),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE facility_id = @facilityId AND owner_id = @ownerId
    `);

  // Đồng bộ địa chỉ mới của cơ sở xuống các sân con trực thuộc
  if (address && address.trim()) {
    await pool.request()
      .input('facilityId', facilityId)
      .input('address', address.trim())
      .query('UPDATE courts SET address = @address WHERE facility_id = @facilityId');
  }

  return result.recordset[0];
}

/**
 * Ngừng hoạt động hoặc kích hoạt lại cơ sở (Soft status change).
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {'ACTIVE' | 'INACTIVE'} status
 */
export async function updateFacilityStatus(facilityId, ownerId, status) {
  await ensureFacilitySchema(ownerId);
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  await getFacilityById(facilityId, ownerId);

  const pool = await getPool();
  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE facilities
      SET status = @status, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE facility_id = @facilityId AND owner_id = @ownerId
    `);

  return result.recordset[0];
}

/**
 * ============================================================================
 * QUẢN LÝ SÂN CON (COURTS TRỰC THUỘC CƠ SỞ)
 * ============================================================================
 */

/**
 * Lấy danh sách sân con thuộc một cơ sở.
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {{ status?: string, sportId?: number }} filters
 */
export async function getCourtsByFacility(facilityId, ownerId, filters = {}) {
  await getFacilityById(facilityId, ownerId);

  const pool = await getPool();
  const { status = 'ALL', sportId } = filters;

  let query = `
    SELECT 
      c.court_id,
      c.facility_id,
      f.name AS facility_name,
      c.owner_id,
      c.sport_id,
      s.sport_name,
      c.court_name,
      c.address,
      ISNULL(c.capacity, 10) AS capacity,
      c.description,
      c.utilities,
      c.status,
      c.images,
      c.created_at,
      c.updated_at
    FROM courts c
    LEFT JOIN facilities f ON c.facility_id = f.facility_id
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    WHERE c.facility_id = @facilityId
  `;

  if (status && status !== 'ALL') {
    query += ` AND c.status = @status`;
  }

  if (sportId) {
    query += ` AND c.sport_id = @sportId`;
  }

  query += ` ORDER BY c.court_id ASC`;

  const request = pool.request().input('facilityId', facilityId);

  if (status && status !== 'ALL') {
    request.input('status', status);
  }
  if (sportId) {
    request.input('sportId', parseInt(sportId));
  }

  const result = await request.query(query);
  return result.recordset;
}

/**
 * Thêm sân con vào cơ sở hợp lệ.
 * @param {number} facilityId
 * @param {number} ownerId
 * @param {{ courtName: string, sportId: number, capacity?: number, description?: string, utilities?: string, images?: string }} data
 */
export async function createCourtInFacility(facilityId, ownerId, data) {
  const facility = await getFacilityById(facilityId, ownerId);

  const { courtName, sportId, capacity = 10, description = '', utilities = '', images = '[]' } = data;

  if (!courtName || !courtName.trim()) {
    throw new AppError('Tên sân con không được để trống.', 400);
  }
  if (sportId === undefined || isNaN(Number(sportId))) {
    throw new AppError('Vui lòng chọn loại môn thể thao hợp lệ cho sân.', 400);
  }

  const pool = await getPool();

  const sportRes = await pool.request()
    .input('sportId', parseInt(sportId))
    .query('SELECT * FROM sports WHERE sport_id = @sportId');

  if (sportRes.recordset.length === 0) {
    throw new AppError('Môn thể thao được chọn không tồn tại trong hệ thống.', 404);
  }
  const sport = sportRes.recordset[0];
  if (sport.status && sport.status.toUpperCase() === 'INACTIVE') {
    throw new AppError('Không thể tạo sân cho môn thể thao đã ngừng hoạt động.', 400);
  }

  const result = await pool.request()
    .input('facilityId', facilityId)
    .input('ownerId', ownerId)
    .input('sportId', parseInt(sportId))
    .input('courtName', courtName.trim())
    .input('address', facility.address)
    .input('capacity', capacity ? parseInt(capacity) : 10)
    .input('description', description.trim())
    .input('utilities', typeof utilities === 'string' ? utilities : JSON.stringify(utilities))
    .input('images', typeof images === 'string' ? images : JSON.stringify(images))
    .query(`
      INSERT INTO courts (
        facility_id, owner_id, sport_id, court_name, address, 
        capacity, description, utilities, status, images, created_at, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @facilityId, @ownerId, @sportId, @courtName, @address, 
        @capacity, @description, @utilities, 'ACTIVE', @images, GETDATE(), GETDATE()
      )
    `);

  const createdCourt = result.recordset[0];

  // Tạo khung giá mặc định nếu bảng court_prices tồn tại
  if (createdCourt?.court_id) {
    try {
      await pool.request()
        .input('courtId', createdCourt.court_id)
        .query(`
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'court_prices')
          AND NOT EXISTS (SELECT 1 FROM [dbo].[court_prices] WHERE [court_id] = @courtId)
          BEGIN
            INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price]) VALUES
              (@courtId, 'WEEKDAY', '06:00:00', '16:00:00', 150000),
              (@courtId, 'WEEKDAY', '16:00:00', '22:00:00', 250000),
              (@courtId, 'WEEKEND', '06:00:00', '22:00:00', 300000);
          END
        `);
    } catch {
      // Bỏ qua nếu bảng court_prices chưa được tạo
    }
  }

  return createdCourt;
}

/**
 * Cập nhật thông tin sân con trực thuộc cơ sở.
 * @param {number} courtId
 * @param {number} ownerId
 * @param {{ courtName?: string, sportId?: number, capacity?: number, description?: string, utilities?: string, images?: string }} data
 */
export async function updateCourtInFacility(courtId, ownerId, data) {
  await ensureFacilitySchema(ownerId);
  const pool = await getPool();

  const checkCourt = await pool.request()
    .input('courtId', courtId)
    .query(`
      SELECT c.*, f.owner_id AS facility_owner_id 
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      WHERE c.court_id = @courtId
    `);

  const court = checkCourt.recordset[0];
  if (!court) {
    throw new AppError('Sân không tồn tại trong hệ thống.', 404);
  }

  if (court.owner_id !== ownerId && court.facility_owner_id !== ownerId) {
    throw new AppError('Bạn không có quyền chỉnh sửa sân bóng này.', 403);
  }

  const { courtName, sportId, capacity, description, utilities, images } = data;

  if (courtName !== undefined && !courtName.trim()) {
    throw new AppError('Tên sân không được để trống.', 400);
  }

  if (sportId !== undefined) {
    const sportRes = await pool.request()
      .input('sportId', parseInt(sportId))
      .query('SELECT * FROM sports WHERE sport_id = @sportId');
    if (sportRes.recordset.length === 0) {
      throw new AppError('Môn thể thao không tồn tại.', 404);
    }
  }

  const result = await pool.request()
    .input('courtId', courtId)
    .input('courtName', courtName ? courtName.trim() : null)
    .input('sportId', sportId !== undefined ? parseInt(sportId) : null)
    .input('capacity', capacity !== undefined ? parseInt(capacity) : null)
    .input('description', description !== undefined ? description.trim() : null)
    .input('utilities', utilities !== undefined ? (typeof utilities === 'string' ? utilities : JSON.stringify(utilities)) : null)
    .input('images', images !== undefined ? (typeof images === 'string' ? images : JSON.stringify(images)) : null)
    .query(`
      UPDATE courts
      SET 
        court_name = COALESCE(@courtName, court_name),
        sport_id = COALESCE(@sportId, sport_id),
        capacity = COALESCE(@capacity, capacity),
        description = COALESCE(@description, description),
        utilities = COALESCE(@utilities, utilities),
        images = COALESCE(@images, images),
        updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE court_id = @courtId
    `);

  return result.recordset[0];
}

/**
 * Ngừng hoạt động / kích hoạt lại sân con. Không xóa cứng lịch sử đặt sân.
 * @param {number} courtId
 * @param {number} ownerId
 * @param {'ACTIVE' | 'INACTIVE'} status
 */
export async function updateCourtStatus(courtId, ownerId, status) {
  await ensureFacilitySchema(ownerId);
  const normalizedStatus = (status || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
    throw new AppError("Trạng thái không hợp lệ. Chỉ chấp nhận 'ACTIVE' hoặc 'INACTIVE'.", 400);
  }

  const pool = await getPool();
  const checkCourt = await pool.request()
    .input('courtId', courtId)
    .query(`
      SELECT c.*, f.owner_id AS facility_owner_id 
      FROM courts c
      LEFT JOIN facilities f ON c.facility_id = f.facility_id
      WHERE c.court_id = @courtId
    `);

  const court = checkCourt.recordset[0];
  if (!court) {
    throw new AppError('Sân không tồn tại.', 404);
  }

  if (court.owner_id !== ownerId && court.facility_owner_id !== ownerId) {
    throw new AppError('Bạn không có quyền quản lý sân bóng này.', 403);
  }

  const result = await pool.request()
    .input('courtId', courtId)
    .input('status', normalizedStatus)
    .query(`
      UPDATE courts
      SET status = @status, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE court_id = @courtId
    `);

  return result.recordset[0];
}

// Tự động đồng bộ schema và khởi tạo 3 tài khoản Chủ sân mẫu ngay khi khởi động server
ensureFacilitySchema().catch(() => {});

