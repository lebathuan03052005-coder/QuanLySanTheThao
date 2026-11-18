import { getPool } from '../core/config/db.js';
import { runSprint2Migration } from './migrate_sprint2.js';

/**
 * ============================================================================
 * SCRIPT SEED DỮ LIỆU MẪU SPRINT 2 (CHẠY THỦ CÔNG 1 LẦN KHI CẦN: `npm run db:seed`)
 * - Tuyệt đối KHÔNG ghi đè password_hash của tài khoản đã tồn tại.
 * - Tuyệt đối KHÔNG chạy UPDATE courts ... WHERE court_id = 0..8 để tránh làm hỏng
 *   dữ liệu hiện có hoặc quan hệ với bảng [court_staff] / [bookings].
 * - Chỉ chèn dữ liệu mới nếu chưa tồn tại (IF NOT EXISTS).
 * ============================================================================
 */

const DEFAULT_PASSWORD_HASH = '$2b$10$aDwmWQCA0.YZ3PiBtLyNhOwq7CUY6d0Gw09A3QQ6FOfR4KuXToNmi';

async function insertCourtIfNotExists(pool, ownerId, item) {
  const res = await pool.request()
    .input('facId', item.facId)
    .input('ownerId', ownerId)
    .input('sportId', item.sportId)
    .input('name', item.name)
    .input('addr', item.addr)
    .input('cap', item.cap)
    .input('desc', item.desc)
    .input('utils', item.utils)
    .input('status', item.status || 'ACTIVE')
    .query(`
      IF NOT EXISTS (SELECT 1 FROM [dbo].[courts] WHERE [owner_id] = @ownerId AND [court_name] = @name)
      BEGIN
        INSERT INTO [dbo].[courts] (
          [facility_id], [owner_id], [sport_id], [court_name], [address],
          [capacity], [description], [utilities], [status], [created_at], [updated_at]
        )
        OUTPUT INSERTED.court_id
        VALUES (
          @facId, @ownerId, @sportId, @name, @addr,
          @cap, @desc, @utils, @status, GETDATE(), GETDATE()
        );
      END
    `);

  const newCourtId = res.recordset?.[0]?.court_id;
  if (newCourtId) {
    try {
      await pool.request()
        .input('courtId', newCourtId)
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
      // Bỏ qua nếu bảng court_prices chưa có
    }
  }
}

export async function runSprint2Seed() {
  console.log('====================================================');
  console.log('SEED DỮ LIỆU MẪU SPRINT 2 (WBS 3.1 - CHẠY ĐỘC LẬP)');
  console.log('====================================================');

  await runSprint2Migration();
  const pool = await getPool();

  // 1. Khởi tạo 6 môn thể thao mặc định nếu chưa tồn tại (IF NOT EXISTS)
  const defaultSports = [
    { name: 'Bóng đá', desc: 'Sân bóng đá cỏ nhân tạo 5 người, 7 người và 11 người tiêu chuẩn thi đấu' },
    { name: 'Cầu lông', desc: 'Sân cầu lông thảm PVC tiêu chuẩn thi đấu trong nhà, ánh sáng chống lóa' },
    { name: 'Pickleball', desc: 'Sân Pickleball mặt sơn Acrylic chống trượt có mái che và ngoài trời' },
    { name: 'Tennis', desc: 'Sân quần vợt mặt cứng tiêu chuẩn có hệ thống đèn chiếu sáng ban đêm' },
    { name: 'Bóng rổ', desc: 'Sân bóng rổ 3x3 và 5x5 mặt sàn gỗ và sơn chuyên dụng tiêu chuẩn FIBA' },
    { name: 'Bóng chuyền', desc: 'Sân bóng chuyền hơi và bóng chuyền da tiêu chuẩn thi đấu trong nhà' },
  ];

  for (const sp of defaultSports) {
    await pool.request()
      .input('name', sp.name)
      .input('desc', sp.desc)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM [dbo].[sports] WHERE LOWER(LTRIM(RTRIM([sport_name]))) = LOWER(@name) AND [owner_id] IS NULL)
        BEGIN
          INSERT INTO [dbo].[sports] ([sport_name], [description], [status], [owner_id], [created_at], [updated_at])
          VALUES (@name, @desc, 'ACTIVE', NULL, GETDATE(), GETDATE());
        END
      `);
  }

  // 2. Chỉ thêm tài khoản mẫu nếu chưa tồn tại (KHÔNG ghi đè password_hash hay role của tài khoản đã có)
  await pool.request()
    .input('pwd', DEFAULT_PASSWORD_HASH)
    .query(`

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Trần Chủ Sân (Cụm Man Thiện & Arena)', '0901000002', 'owner@sportlink.vn', @pwd, 'OWNER', 5.0, 'ACTIVE', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner2@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Nguyễn Minh Hoàng (Chủ sân Khu CNC)', '0902000002', 'owner2@sportlink.vn', @pwd, 'OWNER', 5.0, 'ACTIVE', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'owner3@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Lê Hoàng Phúc (Chủ sân Làng Đại Học)', '0903000003', 'owner3@sportlink.vn', @pwd, 'OWNER', 5.0, 'ACTIVE', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'luan.owner@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Đặng Quang Luân (Chủ sân SportLink)', '0908888999', 'luan.owner@sportlink.vn', @pwd, 'OWNER', 5.0, 'ACTIVE', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'staff@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [job_title], [created_at])
        VALUES (N'Lê Văn Trực Sân (Nhân viên Ca Sáng/Tối)', '0904000001', 'staff@sportlink.vn', @pwd, 'STAFF', 5.0, 'ACTIVE', N'Nhân viên trực sân & thu ngân', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'staff2@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [job_title], [created_at])
        VALUES (N'Phạm Thị Thu Ngân (Nhân viên Cơ sở 2)', '0904000002', 'staff2@sportlink.vn', @pwd, 'STAFF', 5.0, 'ACTIVE', N'Nhân viên lễ tân & check-in', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'staff3@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [job_title], [created_at])
        VALUES (N'Hoàng Gia Bảo (Nhân viên Khu CNC)', '0904000003', 'staff3@sportlink.vn', @pwd, 'STAFF', 5.0, 'ACTIVE', N'Nhân viên vận hành sân', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'player@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Nguyễn Văn Cầu Thủ (Player 1)', '0905000001', 'player@sportlink.vn', @pwd, 'PLAYER', 5.0, 'ACTIVE', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'player2@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Trần Quốc Tuấn (Player 2)', '0905000002', 'player2@sportlink.vn', @pwd, 'PLAYER', 4.9, 'ACTIVE', GETDATE());
      END

      IF NOT EXISTS (SELECT 1 FROM [dbo].[users] WHERE [email] = 'player3@sportlink.vn')
      BEGIN
        INSERT INTO [dbo].[users] ([full_name], [phone], [email], [password_hash], [role], [reputation_score], [status], [created_at])
        VALUES (N'Lê Minh Khôi (Player 3)', '0905000003', 'player3@sportlink.vn', @pwd, 'PLAYER', 4.7, 'ACTIVE', GETDATE());
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

  const sportsRes = await pool.request().query('SELECT [sport_id], [sport_name] FROM [dbo].[sports] WHERE [owner_id] IS NULL');
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

  // 3. Seed cho Owner 1 (owner@sportlink.vn) - Chỉ chèn nếu chưa tồn tại, tuyệt đối không ghi đè sân đã có
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

    if (o1Fac1) {
      // Chỉ gắn facility_id cho các sân của chính Owner 1 đang bị NULL facility_id (không đổi tên, không đổi status hay owner_id)
      await pool.request()
        .input('owner1Id', owner1Id)
        .input('fac1', o1Fac1)
        .query(`
          UPDATE [dbo].[courts]
          SET [facility_id] = @fac1, [capacity] = ISNULL([capacity], 10)
          WHERE [owner_id] = @owner1Id AND [facility_id] IS NULL;
        `);

      const o1Courts = [
        { facId: o1Fac1, sportId: spFootball, name: 'Sân 3 - Bóng Đá Cỏ Nhân Tạo 5 Người (5C)', addr: 'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng đá 5 người mặt cỏ kim cương mới thay, thoát nước nhanh', utils: 'Đèn LED chống chói, Bãi giữ xe rộng, Nước uống miễn phí', status: 'ACTIVE' },
        { facId: o1Fac1, sportId: spPickleball, name: 'Sân 4 - Pickleball Mái Che Man Thiện (P1)', addr: 'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân Pickleball có mái che cao 8m, mặt sơn Acrylic 7 lớp chuẩn thi đấu', utils: 'Mái che mưa nắng, Cho thuê vợt Carbon, Khu chờ có quạt mát', status: 'ACTIVE' },
        { facId: o1Fac1, sportId: spTennis, name: 'Sân 6 - Quần Vợt Tennis Mặt Cứng (T1)', addr: 'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân Tennis mặt cứng Hard Court chuẩn ITF, hàng rào lưới cao 4.5m', utils: 'Ghế trọng tài, Khán đài 50 chỗ, Phòng thay đồ riêng', status: 'ACTIVE' },
        { facId: o1Fac1, sportId: spBasketball, name: 'Sân 8 - Bóng Rổ Ngoài Trời 3x3 (BR1)', addr: 'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', cap: 8, desc: 'Sân bóng rổ nửa sân 3x3 phong trào sinh viên, trụ rổ thủy lực chuẩn FIBA', utils: 'Trụ rổ kính cường lực, Đèn chiếu sáng ban đêm, Tủ khóa cá nhân', status: 'ACTIVE' },
        { facId: o1Fac1, sportId: spVolleyball, name: 'Sân 9 - Bóng Chuyền Ngoài Trời Tiêu Chuẩn (BC1)', addr: 'Số 106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền da 6x6 ngoài trời mặt sơn chống trơn trượt', utils: 'Lưới cáp thép tiêu chuẩn, Đèn pha cao áp, Chỗ đậu xe ô tô', status: 'ACTIVE' },
        { facId: o1Fac2, sportId: spBadminton, name: 'Sân 3 - Cầu Lông Thảm PVC Tiêu Chuẩn (VIP 3)', addr: 'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông thảm Yonex dày 5mm chống chấn thương cổ chân', utils: 'Thảm Yonex chuẩn BWF, Đèn LED chống lóa, Đan vợt lấy liền', status: 'ACTIVE' },
        { facId: o1Fac2, sportId: spVolleyball, name: 'Sân 8 - Bóng Chuyền Trong Nhà Thảm Taraflex (BC2)', addr: 'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM', cap: 14, desc: 'Sân bóng chuyền trong nhà lót thảm Taraflex tiêu chuẩn thi đấu giải phong trào', utils: 'Thảm Taraflex êm ái, Trần cao 12m, Hệ thống thông gió mát mẻ', status: 'ACTIVE' },
        { facId: o1Fac2, sportId: spVolleyball, name: 'Sân 9 - Bóng Chuyền Hơi & Da Đa Năng (BC3)', addr: 'Số 112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền đa năng điều chỉnh được độ cao lưới cho cả nam và nữ', utils: 'Trụ lưới nâng hạ tự động, Ghế nghỉ cầu thủ, Bãi xe miễn phí', status: 'ACTIVE' },
      ];

      for (const item of o1Courts) {
        await insertCourtIfNotExists(pool, owner1Id, item);
      }
    }
  }

  // 4. Seed cho Owner 2 (owner2@sportlink.vn) - Chỉ chèn mới bằng IF NOT EXISTS
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
            (@ownerId, N'Trung Tâm Pickleball & Tennis SportLink SHTP', N'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', '0902000002', N'Tổ hợp sân Pickleball, Tennis và Bóng đá tiêu chuẩn quốc tế tại Khu Công Nghệ Cao', 'ACTIVE', GETDATE(), GETDATE()),
            (@ownerId, N'Nhà Thi Đấu Đa Năng Đặng Văn Bi Thủ Đức', N'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', '0902000088', N'Nhà thi đấu Bóng rổ, Cầu lông và Bóng chuyền trong nhà hiện đại', 'ACTIVE', GETDATE(), GETDATE());
        `);
      o2Facs = await pool.request()
        .input('ownerId', owner2Id)
        .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');
    }

    const o2Fac1 = o2Facs.recordset[0]?.facility_id;
    const o2Fac2 = o2Facs.recordset[1]?.facility_id || o2Fac1;

    const o2Courts = [
      { facId: o2Fac1, sportId: spPickleball, name: 'Sân 1 - Pickleball Có Mái Che (Sân P1)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Cụm Pickleball ngoài trời có mái che cách nhiệt, mặt sơn chuẩn quốc tế', utils: 'Mái che cách nhiệt, Máy bắn bóng tự động, Khu cà phê giải khát', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spPickleball, name: 'Sân 2 - Pickleball Tiêu Chuẩn USAPA (Sân P2)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Tổ hợp sân thể thao tiêu chuẩn cao cấp nằm trong KCNC', utils: 'Mặt sân US Open, Phòng gym mini, Đèn LED chống chói', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spPickleball, name: 'Sân 3 - Pickleball Thi Đấu Quốc Tế (Sân P3)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân Pickleball trung tâm có khán đài theo dõi giải đấu', utils: 'Mái che cách nhiệt, Đèn LED chuẩn HD, Khu cà phê giải khát', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spTennis, name: 'Sân 4 - Quần Vợt Tennis Mặt Cứng (Sân T1)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân Tennis tiêu chuẩn ITF mặt cứng Hard Court', utils: 'Đèn LED 1000W, Ghế trọng tài, Phòng thay đồ VIP', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spTennis, name: 'Sân 5 - Quần Vợt Tennis Mặt Cứng (Sân T2)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân Tennis mặt sơn Plexipave 7 lớp giảm chấn bảo vệ khớp gối', utils: 'Đèn pha 1000W, Phòng tắm nóng lạnh, Có chỗ đậu ô tô', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spTennis, name: 'Sân 6 - Quần Vợt Tennis Khán Đài (Sân T3)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân Tennis tiêu chuẩn tổ chức giải doanh nghiệp Khu Công Nghệ Cao', utils: 'Khán đài có mái che, Máy bắn bóng tự động, Wifi miễn phí', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spFootball, name: 'Sân 7 - Bóng Đá Cỏ Nhân Tạo 5 Người (SHTP 1)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng đá 5 người phục vụ kỹ sư và nhân viên Khu Công Nghệ Cao', utils: 'Cỏ nhân tạo chuẩn FIFA, Đèn LED ban đêm, Cho thuê giày & áo bib', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spFootball, name: 'Sân 8 - Bóng Đá Cỏ Nhân Tạo 5 Người (SHTP 2)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng đá 5 người liền kề có thể ghép thành sân 7 người', utils: 'Hệ thống thoát nước nhanh, Bãi giữ xe rộng, Nước uống miễn phí', status: 'ACTIVE' },
      { facId: o2Fac1, sportId: spFootball, name: 'Sân 9 - Bóng Đá Cỏ Nhân Tạo 7 Người (SHTP 3)', addr: 'Số 45 Đường D2, Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM', cap: 14, desc: 'Sân bóng đá 7 người kích thước chuẩn 40x60m, lưới chắn cao 8m', utils: 'Khán đài 100 chỗ, Bảng tỷ số lật tay, Phòng thay đồ rộng', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spBasketball, name: 'Sân 1 - Bóng Rổ Sàn Gỗ 5x5 Trong Nhà', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng rổ nguyên sân 5x5 sàn gỗ tiêu chuẩn thi đấu', utils: 'Sàn gỗ giảm chấn, Bảng điểm 24s, Khán đài trong nhà', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spBasketball, name: 'Sân 2 - Bóng Rổ 3x3 Ngoài Trời', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 6, desc: 'Sân bóng rổ nửa sân 3x3 mặt sơn chống trượt chuyên nghiệp', utils: 'Đèn LED ban đêm, Cho thuê bóng, Tủ đồ cá nhân', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spBasketball, name: 'Sân 3 - Bóng Rổ Huấn Luyện Trẻ (Sân BR3)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng rổ trong nhà có trụ rổ điều chỉnh độ cao từ 2.6m đến 3.05m', utils: 'Sàn gỗ giảm chấn, Hệ thống quạt mát, Dụng cụ tập chiến thuật', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spBadminton, name: 'Sân 4 - Cầu Lông Thảm Yonex (Sân CL1)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông trong nhà trần cao 11m, hoàn toàn kín gió', utils: 'Thảm PVC chuẩn thi đấu, Đèn LED hai bên chống chói, Wifi miễn phí', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spBadminton, name: 'Sân 5 - Cầu Lông Thảm Yonex (Sân CL2)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông tiêu chuẩn câu lạc bộ, khoảng cách biên rộng rãi', utils: 'Ghế nghỉ bọc nệm, Bán ống cầu Hải Yến, Phòng tắm sạch sẽ', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spBadminton, name: 'Sân 6 - Cầu Lông Thảm Yonex (Sân CL3)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông tập luyện kết hợp máy bắn cầu tự động', utils: 'Cho thuê vợt Yonex, Nước giải khát, Bãi xe có bảo vệ', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spVolleyball, name: 'Sân 7 - Bóng Chuyền Thi Đấu Trong Nhà (Sân BC1)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền 6x6 trong nhà mặt thảm tổng hợp đàn hồi cao', utils: 'Lưới thi đấu chuẩn VFV, Khán đài 120 chỗ, Bảng điểm điện tử', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spVolleyball, name: 'Sân 8 - Bóng Chuyền Phong Trào (Sân BC2)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền phục vụ giao lưu các câu lạc bộ quận Thủ Đức', utils: 'Đèn chiếu sáng chuẩn, Cho thuê bóng Mikasa, Tủ khóa an toàn', status: 'ACTIVE' },
      { facId: o2Fac2, sportId: spVolleyball, name: 'Sân 9 - Bóng Chuyền Tập Luyện (Sân BC3)', addr: 'Số 88 Đặng Văn Bi, P. Bình Thọ, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền hơi và bóng chuyền da đa năng', utils: 'Trụ lưới di động, Phòng thay đồ nam nữ, Chỗ đậu xe rộng', status: 'INACTIVE' },
    ];

    for (const item of o2Courts) {
      await insertCourtIfNotExists(pool, owner2Id, item);
    }
  }

  // 5. Seed cho Owner 3 (owner3@sportlink.vn) - Chỉ chèn mới bằng IF NOT EXISTS
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
            (@ownerId, N'Tổ Hợp Thể Thao Làng Đại Học Thủ Đức - Khu A', N'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', '0903000003', N'Khu liên hợp thể thao đa năng phục vụ sinh viên Làng Đại học Quốc gia TP.HCM', 'ACTIVE', GETDATE(), GETDATE()),
            (@ownerId, N'Trung Tâm Thể Thao Sinh Viên ĐHQG - Khu B', N'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', '0903000004', N'Tổ hợp sân Pickleball, Tennis và Bóng rổ hiện đại ngay cạnh KTX Khu B ĐHQG', 'ACTIVE', GETDATE(), GETDATE());
        `);
      o3Facs = await pool.request()
        .input('ownerId', owner3Id)
        .query('SELECT [facility_id], [name] FROM [dbo].[facilities] WHERE [owner_id] = @ownerId ORDER BY [facility_id] ASC');
    }

    const o3Fac1 = o3Facs.recordset[0]?.facility_id;
    const o3Fac2 = o3Facs.recordset[1]?.facility_id || o3Fac1;

    const o3Courts = [
      { facId: o3Fac1, sportId: spFootball, name: 'Sân 1 - Bóng Đá Sinh Viên Làng Đại Học (7 Người)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 14, desc: 'Sân bóng đá 7 người tiêu chuẩn phục vụ giải sinh viên ĐHQG', utils: 'Đèn LED cao áp, Khán đài sinh viên, Bãi giữ xe rộng', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spFootball, name: 'Sân 2 - Bóng Đá Cỏ Nhân Tạo 5 Người (Khu A1)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng đá 5 người mặt cỏ dày, giá ưu đãi cho sinh viên ĐHQG', utils: 'Đèn LED chiếu sáng, Nước uống miễn phí, Bãi giữ xe rộng', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spFootball, name: 'Sân 3 - Bóng Đá Cỏ Nhân Tạo 5 Người (Khu A2)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 10, desc: 'Sân bóng đá 5 người tổ chức giải truyền thống các trường thành viên', utils: 'Cho thuê áo bib, Bảng điểm lật tay, Căng tin sinh viên', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spVolleyball, name: 'Sân 4 - Bóng Chuyền Trong Nhà Làng Đại Học', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền da và bóng chuyền hơi tiêu chuẩn thi đấu sinh viên', utils: 'Lưới thi đấu chuẩn, Khán đài 100 chỗ, Bãi giữ xe rộng', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spVolleyball, name: 'Sân 5 - Bóng Chuyền Ngoài Trời Khu A (BC2)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền ngoài trời thoáng mát, đèn pha sáng rõ ban đêm', utils: 'Đèn cao áp 4 góc, Cho thuê bóng Thăng Long, Ghế nghỉ đội bóng', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spVolleyball, name: 'Sân 6 - Bóng Chuyền Tập Luyện Khoa Thể Chất (BC3)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 12, desc: 'Sân bóng chuyền phục vụ học phần giáo dục thể chất và CLB', utils: 'Trụ lưới chuẩn quốc gia, Tủ gửi đồ, Wifi miễn phí', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spBadminton, name: 'Sân 7 - Cầu Lông Sinh Viên ĐHQG (CL1)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông trong nhà giá ưu đãi cho sinh viên', utils: 'Cho thuê vợt, Nước giải khát, Wifi miễn phí', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spBadminton, name: 'Sân 8 - Cầu Lông Thảm PVC Khu A (CL2)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông thảm nhám chống trơn, ánh sáng chuẩn không chói mắt', utils: 'Thảm PVC dày 4.5mm, Hệ thống quạt hút gió, Bán cầu thi đấu', status: 'ACTIVE' },
      { facId: o3Fac1, sportId: spBadminton, name: 'Sân 9 - Cầu Lông Đôi Thi Đấu CLB (CL3)', addr: 'Đường Tạ Quang Bửu, Khu Đô Thị ĐHQG, P. Linh Trung, TP. Thủ Đức, TP.HCM', cap: 4, desc: 'Sân cầu lông trung tâm dành cho giải đấu câu lạc bộ sinh viên', utils: 'Ghế trọng tài, Khán đài mini, Phòng thay đồ sạch sẽ', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spPickleball, name: 'Sân 1 - Pickleball Sinh Viên Khu B (P1)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 4, desc: 'Sân Pickleball có mái che mới khai trương cạnh KTX Khu B', utils: 'Mái che cao ráo, Cho thuê vợt & bóng miễn phí giờ thấp điểm', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spPickleball, name: 'Sân 2 - Pickleball Sinh Viên Khu B (P2)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 4, desc: 'Sân Pickleball mặt sơn Acrylic chống trượt chuẩn USAPA', utils: 'Đèn LED chống lóa, Khu ngồi chờ có ổ cắm sạc, Wifi miễn phí', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spPickleball, name: 'Sân 3 - Pickleball Giao Lưu CLB (P3)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 4, desc: 'Sân Pickleball phục vụ giải đấu phong trào sinh viên ĐHQG', utils: 'Mái che toàn phần, Nước uống miễn phí, Bãi xe KTX', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spTennis, name: 'Sân 4 - Quần Vợt Tennis ĐHQG (T1)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 4, desc: 'Sân Tennis mặt cứng tiêu chuẩn phục vụ giảng viên và sinh viên', utils: 'Hàng rào tiêu chuẩn, Đèn pha ban đêm, Cho thuê vợt Tennis', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spTennis, name: 'Sân 5 - Quần Vợt Tennis ĐHQG (T2)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 4, desc: 'Sân Tennis tập luyện có tường đánh bóng phản xạ hỗ trợ người mới', utils: 'Tường tập phản xạ, Máy bắn bóng, Phòng thay đồ', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spTennis, name: 'Sân 6 - Quần Vợt Tennis Thi Đấu (T3)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 4, desc: 'Sân Tennis có mái che nhẹ và khán đài 80 chỗ ngồi', utils: 'Khán đài có mái che, Ghế nghỉ vận động viên, Nước khoáng', status: 'INACTIVE' },
      { facId: o3Fac2, sportId: spBasketball, name: 'Sân 7 - Bóng Rổ Nhà Thi Đấu Khu B (5x5)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 12, desc: 'Sân bóng rổ 5x5 trong nhà tổ chức giải bóng rổ sinh viên RMIT & ĐHQG', utils: 'Sàn gỗ thi đấu, Bảng điểm điện tử, Khán đài 200 chỗ', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spBasketball, name: 'Sân 8 - Bóng Rổ Ngoài Trời KTX Khu B (3x3 A)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 6, desc: 'Sân bóng rổ 3x3 ngoài trời sôi động mỗi buổi chiều', utils: 'Trụ rổ chuẩn FIBA 3x3, Đèn LED sáng rõ, Cho thuê bóng', status: 'ACTIVE' },
      { facId: o3Fac2, sportId: spBasketball, name: 'Sân 9 - Bóng Rổ Ngoài Trời KTX Khu B (3x3 B)', addr: 'Đường Nguyễn Du, Khu Ký Túc Xá Khu B ĐHQG, P. Đông Hòa, Dĩ An', cap: 6, desc: 'Sân bóng rổ nửa sân tập ném rổ và đấu tập 3 đấu 3', utils: 'Mặt sơn Acrylic mới, Ghế nghỉ, Căng tin ngay sát sân', status: 'ACTIVE' },
    ];

    for (const item of o3Courts) {
      await insertCourtIfNotExists(pool, owner3Id, item);
    }

    // Cập nhật tọa độ GPS và đường dẫn ảnh đại diện cho các cơ sở sân mẹ
    try {
      await pool.request().query(`
        IF COL_LENGTH('dbo.facilities', 'lat') IS NOT NULL
        BEGIN
          UPDATE [dbo].[facilities] SET [lat] = 10.8495, [lng] = 106.7905, [images] = '/facilities/man-thien/thumb.jpg' WHERE [name] LIKE N'%Man Thiện%';
          UPDATE [dbo].[facilities] SET [lat] = 10.8490, [lng] = 106.7770, [images] = '/facilities/hiep-phu/thumb.jpg' WHERE [name] LIKE N'%Hiệp Phú%';
          UPDATE [dbo].[facilities] SET [lat] = 10.8540, [lng] = 106.7980, [images] = '/facilities/shtp/thumb.jpg' WHERE [name] LIKE N'%SHTP%';
          UPDATE [dbo].[facilities] SET [lat] = 10.8510, [lng] = 106.7620, [images] = '/facilities/dang-van-bi/thumb.jpg' WHERE [name] LIKE N'%Đặng Văn Bi%';
          UPDATE [dbo].[facilities] SET [lat] = 10.8750, [lng] = 106.8020, [images] = '/facilities/lang-dai-hoc-a/thumb.jpg' WHERE [name] LIKE N'%Khu A%';
          UPDATE [dbo].[facilities] SET [lat] = 10.8820, [lng] = 106.7820, [images] = '/facilities/lang-dai-hoc-b/thumb.jpg' WHERE [name] LIKE N'%Khu B%';
        END
      `);
    } catch {}
  }

  // 6. Seed bảng giá động (court_prices), khách hàng (customers), đơn đặt sân (bookings) và giao dịch (transactions) mẫu cho Owner 1 (IF NOT EXISTS)
  if (owner1Id !== undefined) {
    // 6.1 Seed court_prices mặc định cho các sân chưa có bảng giá
    const allCourtsRes = await pool.request().query(`
      SELECT c.[court_id], ISNULL(s.[sport_name], N'') AS [sport_name]
      FROM [dbo].[courts] c
      LEFT JOIN [dbo].[sports] s ON c.[sport_id] = s.[sport_id]
    `);

    for (const court of allCourtsRes.recordset) {
      const existingPrices = await pool.request()
        .input('courtId', court.court_id)
        .query('SELECT COUNT(1) AS cnt FROM [dbo].[court_prices] WHERE [court_id] = @courtId');

      if (Number(existingPrices.recordset[0]?.cnt || 0) === 0) {
        const isBadmintonOrPickle = court.sport_name.includes('Cầu lông') || court.sport_name.includes('Pickleball');
        const normalMorning = isBadmintonOrPickle ? 80000 : 200000;
        const normalAfternoon = isBadmintonOrPickle ? 100000 : 250000;
        const normalPrime = isBadmintonOrPickle ? 140000 : 380000;
        const normalLate = isBadmintonOrPickle ? 110000 : 280000;
        const weekendDay = isBadmintonOrPickle ? 120000 : 300000;
        const weekendPrime = isBadmintonOrPickle ? 160000 : 450000;
        const holidayAll = isBadmintonOrPickle ? 180000 : 500000;

        await pool.request()
          .input('courtId', court.court_id)
          .input('nm', normalMorning)
          .input('na', normalAfternoon)
          .input('np', normalPrime)
          .input('nl', normalLate)
          .input('wd', weekendDay)
          .input('wp', weekendPrime)
          .input('ha', holidayAll)
          .query(`
            INSERT INTO [dbo].[court_prices] ([court_id], [day_type], [start_time], [end_time], [price])
            VALUES
              (@courtId, 'NORMAL',  '06:00', '12:00', @nm),
              (@courtId, 'NORMAL',  '12:00', '17:00', @na),
              (@courtId, 'NORMAL',  '17:00', '21:00', @np),
              (@courtId, 'NORMAL',  '21:00', '23:00', @nl),
              (@courtId, 'WEEKEND', '06:00', '17:00', @wd),
              (@courtId, 'WEEKEND', '17:00', '23:00', @wp),
              (@courtId, 'HOLIDAY', '06:00', '23:00', @ha);
          `);
      }
    }

    // 6.2 Seed customers mẫu
    const sampleCustomers = [
      { fullName: 'Nguyễn Minh Quân', phone: '0909111222', email: 'minhquan@gmail.com', score: 4.9, status: 'ACTIVE', note: 'Đội trưởng FC Bưu Chính, đặt sân cố định tối Thứ 3 & Thứ 5' },
      { fullName: 'Trần Hoàng Bảo', phone: '0918222333', email: 'hoangbao@gmail.com', score: 4.8, status: 'ACTIVE', note: 'CLB Cầu lông Hiệp Phú, luôn thanh toán đúng giờ' },
      { fullName: 'Lê Thị Thu Hà', phone: '0933444555', email: 'thuha.pickle@gmail.com', score: 5.0, status: 'ACTIVE', note: 'Nhóm Pickleball nữ Thủ Đức' },
      { fullName: 'Phạm Quốc Đạt', phone: '0977666888', email: 'quocdat@gmail.com', score: 3.5, status: 'ACTIVE', note: 'Từng hủy sát giờ 1 lần' },
      { fullName: 'Võ Văn Hậu', phone: '0988999000', email: 'vanhau@gmail.com', score: 2.0, status: 'LOCKED', note: 'Bùng kèo không đến nhận sân 2 lần liên tiếp (No-show)' },
    ];

    for (const c of sampleCustomers) {
      await pool.request()
        .input('fullName', c.fullName)
        .input('phone', c.phone)
        .input('email', c.email)
        .input('score', c.score)
        .input('status', c.status)
        .input('note', c.note)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM [dbo].[customers] WHERE [phone] = @phone)
          BEGIN
            INSERT INTO [dbo].[customers] ([full_name], [phone], [email], [reputation_score], [status], [notes], [created_at], [updated_at])
            VALUES (@fullName, @phone, @email, @score, @status, @note, GETDATE(), GETDATE());
          END
        `);
    }

    // 6.3 Seed bookings & transactions mẫu cho Owner 1 nếu Owner 1 có ít hơn 5 booking
    const o1CourtsList = await pool.request()
      .input('owner1Id', owner1Id)
      .query('SELECT [court_id], [court_name] FROM [dbo].[courts] WHERE [owner_id] = @owner1Id ORDER BY [court_id] ASC');

    const o1BookingCountRes = await pool.request()
      .input('owner1Id', owner1Id)
      .query(`
        SELECT COUNT(1) AS cnt
        FROM [dbo].[bookings] b
        INNER JOIN [dbo].[courts] c ON b.[court_id] = c.[court_id]
        WHERE c.[owner_id] = @owner1Id
      `);

    if (o1CourtsList.recordset.length > 0 && Number(o1BookingCountRes.recordset[0]?.cnt || 0) < 5) {
      const custMapRes = await pool.request().query('SELECT [customer_id], [full_name], [phone] FROM [dbo].[customers]');
      const custByPhone = {};
      for (const row of custMapRes.recordset) {
        custByPhone[row.phone] = row;
      }

      const cIds = o1CourtsList.recordset.map((r) => r.court_id);
      const pickCourt = (idx) => cIds[idx % cIds.length];

      const sampleBookings = [
        { courtId: pickCourt(0), phone: '0909111222', dayOffset: 0, startTime: '17:00:00', endTime: '19:00:00', price: 760000, deposit: 250000, status: 'CONFIRMED', payType: 'DEPOSIT', payMethod: 'BANK_TRANSFER' },
        { courtId: pickCourt(1), phone: '0918222333', dayOffset: 0, startTime: '18:00:00', endTime: '20:00:00', price: 280000, deposit: 100000, status: 'CHECKED-IN', payType: 'DEPOSIT', payMethod: 'VNPAY' },
        { courtId: pickCourt(2), phone: '0933444555', dayOffset: 0, startTime: '08:00:00', endTime: '10:00:00', price: 160000, deposit: 160000, status: 'COMPLETED', payType: 'FULL_PAYMENT', payMethod: 'CASH' },
        { courtId: pickCourt(3), phone: '0977666888', dayOffset: 0, startTime: '19:00:00', endTime: '21:00:00', price: 760000, deposit: 0, status: 'PENDING', payType: null, payMethod: null },
        { courtId: pickCourt(0), phone: '0909111222', dayOffset: -1, startTime: '18:00:00', endTime: '20:00:00', price: 760000, deposit: 760000, status: 'COMPLETED', payType: 'FULL_PAYMENT', payMethod: 'BANK_TRANSFER' },
        { courtId: pickCourt(1), phone: '0918222333', dayOffset: -2, startTime: '17:00:00', endTime: '19:00:00', price: 280000, deposit: 280000, status: 'COMPLETED', payType: 'FULL_PAYMENT', payMethod: 'MOMO' },
        { courtId: pickCourt(4), phone: '0933444555', dayOffset: -3, startTime: '16:00:00', endTime: '18:00:00', price: 240000, deposit: 240000, status: 'COMPLETED', payType: 'FULL_PAYMENT', payMethod: 'VNPAY' },
        { courtId: pickCourt(2), phone: '0988999000', dayOffset: -4, startTime: '19:00:00', endTime: '21:00:00', price: 760000, deposit: 0, status: 'NO-SHOW', payType: null, payMethod: null },
        { courtId: pickCourt(5), phone: '0909111222', dayOffset: 1, startTime: '17:00:00', endTime: '19:00:00', price: 300000, deposit: 100000, status: 'CONFIRMED', payType: 'DEPOSIT', payMethod: 'BANK_TRANSFER' },
      ];

      for (const b of sampleBookings) {
        const cust = custByPhone[b.phone];
        if (!cust) continue;

        const insertRes = await pool.request()
          .input('courtId', b.courtId)
          .input('customerId', cust.customer_id)
          .input('dayOffset', b.dayOffset)
          .input('startTime', b.startTime)
          .input('endTime', b.endTime)
          .input('price', b.price)
          .input('deposit', b.deposit)
          .input('status', b.status)
          .query(`
            DECLARE @targetDate DATE = CAST(DATEADD(DAY, @dayOffset, GETDATE()) AS DATE);

            IF NOT EXISTS (
              SELECT 1 FROM [dbo].[bookings]
              WHERE [court_id] = @courtId AND [booking_date] = @targetDate AND [start_time] = CAST(@startTime AS TIME)
            )
            BEGIN
              INSERT INTO [dbo].[bookings]
                ([court_id], [customer_id], [booking_date], [start_time], [end_time], [total_price], [deposit_amount], [status], [created_at])
              OUTPUT INSERTED.[booking_id], INSERTED.[booking_date]
              VALUES
                (@courtId, @customerId, @targetDate, CAST(@startTime AS TIME), CAST(@endTime AS TIME), @price, @deposit, @status, DATEADD(DAY, @dayOffset, GETDATE()));
            END
          `);

        const insertedBooking = insertRes.recordset?.[0];
        if (insertedBooking && b.payType && b.deposit > 0) {
          await pool.request()
            .input('bookingId', insertedBooking.booking_id)
            .input('amount', b.payType === 'FULL_PAYMENT' ? b.price : b.deposit)
            .input('payMethod', b.payMethod)
            .input('payType', b.payType)
            .input('dayOffset', b.dayOffset)
            .query(`
              INSERT INTO [dbo].[transactions]
                ([booking_id], [amount], [transaction_type], [payment_method], [status], [created_at])
              VALUES
                (@bookingId, @amount, @payType, @payMethod, 'SUCCESS', DATEADD(DAY, @dayOffset, GETDATE()));
            `);
        }
      }
    }

    // 6.4 Phân công sân cho nhân viên trực sân (staff@sportlink.vn & staff2@sportlink.vn -> Owner 1, staff3@sportlink.vn -> Owner 2)
    await pool.request()
      .input('owner1Id', owner1Id)
      .query(`
        UPDATE [dbo].[users]
        SET [owner_id] = @owner1Id
        WHERE [email] IN ('staff@sportlink.vn', 'staff2@sportlink.vn') AND [owner_id] IS NULL;

        INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by], [assigned_at])
        SELECT u.[user_id], c.[court_id], @owner1Id, GETDATE()
        FROM [dbo].[users] u
        CROSS JOIN [dbo].[courts] c
        WHERE u.[email] = 'staff@sportlink.vn'
          AND c.[owner_id] = @owner1Id
          AND NOT EXISTS (
            SELECT 1 FROM [dbo].[court_staff] cs
            WHERE cs.[staff_id] = u.[user_id] AND cs.[court_id] = c.[court_id]
          );

        INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by], [assigned_at])
        SELECT u.[user_id], c.[court_id], @owner1Id, GETDATE()
        FROM [dbo].[users] u
        CROSS JOIN (
          SELECT TOP 6 [court_id] FROM [dbo].[courts] WHERE [owner_id] = @owner1Id ORDER BY [court_id] DESC
        ) c
        WHERE u.[email] = 'staff2@sportlink.vn'
          AND NOT EXISTS (
            SELECT 1 FROM [dbo].[court_staff] cs
            WHERE cs.[staff_id] = u.[user_id] AND cs.[court_id] = c.[court_id]
          );
      `);
  }

  if (owner2Id !== undefined) {
    await pool.request()
      .input('owner2Id', owner2Id)
      .query(`
        UPDATE [dbo].[users]
        SET [owner_id] = @owner2Id
        WHERE [email] = 'staff3@sportlink.vn' AND [owner_id] IS NULL;

        INSERT INTO [dbo].[court_staff] ([staff_id], [court_id], [assigned_by], [assigned_at])
        SELECT u.[user_id], c.[court_id], @owner2Id, GETDATE()
        FROM [dbo].[users] u
        CROSS JOIN (
          SELECT TOP 6 [court_id] FROM [dbo].[courts] WHERE [owner_id] = @owner2Id ORDER BY [court_id] ASC
        ) c
        WHERE u.[email] = 'staff3@sportlink.vn'
          AND NOT EXISTS (
            SELECT 1 FROM [dbo].[court_staff] cs
            WHERE cs.[staff_id] = u.[user_id] AND cs.[court_id] = c.[court_id]
          );
      `);
  }

  console.log('✅ Đã seed xong dữ liệu mẫu Sprint 2 (IF NOT EXISTS - Không ghi đè dữ liệu hiện có)!');
}

if (process.argv[1]?.endsWith('seed_sprint2.js') || process.argv[1]?.endsWith('seed_wbs31_data.js')) {
  runSprint2Seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Lỗi khi chạy seed_sprint2:', err);
      process.exit(1);
    });
}
