const bcrypt = (await import('bcrypt').catch(() => import('bcryptjs'))).default;
import jwt from 'jsonwebtoken';
import { getPool } from '../../core/config/db.js';
import { getJwtSecret } from '../../core/utils/crypto.js';
import { AppError } from '../../core/errors/AppError.js';

const SALT_ROUNDS = 12;

let profileColumnsEnsured = false;

/**
 * Tự động đảm bảo các cột mở rộng Sprint 3 cho bảng users (S3-01, S3-02)
 */
async function ensureUserProfileColumns(pool) {
  if (profileColumnsEnsured) return;
  try {
    await pool.request().query(`
      IF COL_LENGTH('dbo.users', 'gender') IS NULL
        ALTER TABLE [dbo].[users] ADD [gender] NVARCHAR(20) NULL;
      IF COL_LENGTH('dbo.users', 'dob') IS NULL
        ALTER TABLE [dbo].[users] ADD [dob] DATE NULL;
      IF COL_LENGTH('dbo.users', 'address') IS NULL
        ALTER TABLE [dbo].[users] ADD [address] NVARCHAR(255) NULL;
      IF COL_LENGTH('dbo.users', 'bio') IS NULL
        ALTER TABLE [dbo].[users] ADD [bio] NVARCHAR(500) NULL;
      IF COL_LENGTH('dbo.users', 'favorite_sports') IS NULL
        ALTER TABLE [dbo].[users] ADD [favorite_sports] NVARCHAR(255) NULL;
      IF COL_LENGTH('dbo.users', 'reset_otp') IS NULL
        ALTER TABLE [dbo].[users] ADD [reset_otp] VARCHAR(10) NULL;
      IF COL_LENGTH('dbo.users', 'reset_otp_expires') IS NULL
        ALTER TABLE [dbo].[users] ADD [reset_otp_expires] DATETIME NULL;
    `);
    profileColumnsEnsured = true;
  } catch {
    // ignore if concurrent DDL
  }
}

/**
 * Ghi thông báo an toàn cho người dùng
 */
async function createAuthNotificationSafe(pool, userId, title, content) {
  if (!userId) return;
  try {
    await pool
      .request()
      .input('userId', userId)
      .input('title', title)
      .input('content', content)
      .query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
        BEGIN
          INSERT INTO notifications (user_id, title, content, is_read, created_at)
          VALUES (@userId, @title, @content, 0, GETDATE())
        END
      `);
  } catch {
    // ignore notification error
  }
}

/**
 * [4.1 - S3-01] Đăng ký tài khoản người chơi mới (bảng users & đồng bộ bảng customers).
 * Tự động ký JWT Token để người chơi có thể đăng nhập ngay sau khi đăng ký.
 * @param {{ fullName: string, email: string, password: string, phone?: string }} data
 */
export async function register(data) {
  const { fullName, email, password, phone = '' } = data;

  if (!fullName || !fullName.trim()) {
    throw new AppError('Họ và tên không được để trống.', 400);
  }
  if (!email || !email.trim()) {
    throw new AppError('Địa chỉ email không được để trống.', 400);
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new AppError('Định dạng địa chỉ email không hợp lệ.', 400);
  }
  if (!password || password.length < 6) {
    throw new AppError('Mật khẩu phải có tối thiểu 6 ký tự.', 400);
  }

  const cleanPhone = phone ? phone.trim().replace(/\s+/g, '') : '';
  if (cleanPhone && !/^(0|\+84)[0-9]{8,10}$/.test(cleanPhone)) {
    throw new AppError('Số điện thoại không hợp lệ (vui lòng nhập 10 chữ số, ví dụ: 0912345678).', 400);
  }

  const pool = await getPool();
  await ensureUserProfileColumns(pool);

  // Kiểm tra email hoặc phone đã tồn tại chưa
  const existingUser = await pool
    .request()
    .input('email', cleanEmail)
    .input('phone', cleanPhone)
    .query(
      "SELECT user_id, email, phone FROM users WHERE LOWER(email) = @email OR (phone = @phone AND @phone <> '')"
    );

  if (existingUser.recordset.length > 0) {
    const conflict = existingUser.recordset[0];
    if ((conflict.email || '').toLowerCase() === cleanEmail) {
      throw new AppError('Địa chỉ email này đã được đăng ký tài khoản.', 409);
    }
    throw new AppError('Số điện thoại này đã được đăng ký tài khoản.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const finalPhone = cleanPhone || `09${Math.floor(10000000 + Math.random() * 90000000)}`;

  const result = await pool
    .request()
    .input('fullName', fullName.trim())
    .input('phone', finalPhone)
    .input('email', cleanEmail)
    .input('password', hashedPassword)
    .input('role', 'PLAYER')
    .query(`
      INSERT INTO users (full_name, phone, email, password_hash, role, reputation_score, status, created_at)
      OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.phone, INSERTED.email, INSERTED.role, INSERTED.reputation_score, INSERTED.created_at
      VALUES (@fullName, @phone, @email, @password, @role, 5.0, 'ACTIVE', GETDATE())
    `);

  const created = result.recordset[0];

  // Đồng bộ sang bảng customers (CRM) để Chủ sân quản lý lịch sử khách hàng
  try {
    await pool
      .request()
      .input('userId', created.user_id)
      .input('fullName', created.full_name)
      .input('phone', created.phone)
      .input('email', created.email)
      .query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
        BEGIN
          IF EXISTS (SELECT 1 FROM customers WHERE phone = @phone)
            UPDATE customers SET user_id = @userId, full_name = @fullName, email = @email, updated_at = GETDATE() WHERE phone = @phone;
          ELSE
            INSERT INTO customers (user_id, full_name, phone, email, reputation_score, status, created_at, updated_at)
            VALUES (@userId, @fullName, @phone, @email, 5.0, 'ACTIVE', GETDATE(), GETDATE());
        END
      `);
  } catch {
    // ignore customer sync error
  }

  await createAuthNotificationSafe(
    pool,
    created.user_id,
    'Chào mừng bạn đến với SportLink!',
    `Tài khoản người chơi "${created.full_name}" đã được kích hoạt thành công với 5.0★ điểm uy tín.`
  );

  const normalizedRole = (created.role || 'PLAYER').toLowerCase();
  const token = jwt.sign(
    {
      id: created.user_id,
      role: normalizedRole,
      email: created.email,
      fullName: created.full_name,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const userObj = {
    id: created.user_id,
    fullName: created.full_name,
    phone: created.phone,
    email: created.email,
    role: normalizedRole,
    reputationScore: Number(created.reputation_score ?? 5.0),
    avatarUrl: null,
    createdAt: created.created_at,
  };

  return {
    token,
    user: userObj,
    ...userObj,
  };
}

/**
 * Đăng nhập, kiểm tra thông tin tài khoản và mật khẩu theo schema bảng users.
 * Hỗ trợ đăng nhập bằng Email hoặc Số điện thoại.
 * @param {{ email: string, password: string }} data
 */
export async function login(data) {
  const { email, password } = data;

  if (!email || !email.trim()) {
    throw new AppError('Vui lòng nhập email hoặc số điện thoại.', 400);
  }
  if (!password) {
    throw new AppError('Vui lòng nhập mật khẩu.', 400);
  }

  const cleanInput = email.trim();
  const pool = await getPool();

  const result = await pool
    .request()
    .input('identifier', cleanInput)
    .query(`
      SELECT user_id, full_name, phone, email, password_hash, role, avatar_url, reputation_score, status, created_at
      FROM users
      WHERE LOWER(email) = LOWER(@identifier) OR phone = @identifier
    `);

  const user = result.recordset[0];
  if (!user) {
    throw new AppError('Sai mật khẩu hoặc không có tài khoản.', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Sai mật khẩu hoặc không có tài khoản.', 401);
  }

  const userStatus = (user.status || 'ACTIVE').toUpperCase();
  if (userStatus === 'LOCKED') {
    throw new AppError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ chủ sân để được hỗ trợ.', 403);
  }
  if (userStatus === 'INACTIVE') {
    throw new AppError('Tài khoản này đã ngừng hoạt động trong hệ thống.', 403);
  }

  const normalizedRole = (user.role || 'PLAYER').toLowerCase();

  const token = jwt.sign(
    {
      id: user.user_id,
      role: normalizedRole,
      email: user.email,
      fullName: user.full_name,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.user_id,
      fullName: user.full_name,
      phone: user.phone,
      email: user.email,
      role: normalizedRole,
      reputationScore: Number(user.reputation_score ?? 5.0),
      avatarUrl: user.avatar_url || null,
      createdAt: user.created_at,
    },
  };
}

/**
 * Đăng nhập và xác thực qua Google OAuth 2.0 (Google Identity Services).
 * Tự động tạo tài khoản PLAYER nếu người dùng đăng nhập lần đầu.
 * @param {string} credential - ID Token JWT do Google cấp
 */
export async function googleLogin(credential) {
  if (!credential) {
    throw new AppError('Mã xác thực Google (credential) không được để trống.', 400);
  }

  let payload = null;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!res.ok) {
      throw new AppError('Token Google không hợp lệ hoặc đã hết hạn.', 401);
    }
    payload = await res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Không thể xác thực token Google. Vui lòng thử lại.', 401);
  }

  if (!payload || !payload.email || String(payload.email_verified) !== 'true') {
    throw new AppError('Token Google không hợp lệ hoặc email chưa được xác minh.', 401);
  }

  const googleEmail = payload.email.trim().toLowerCase();
  const googleName = payload.name || payload.email.split('@')[0];
  const googleSub = payload.sub || Date.now().toString();
  const googlePicture = payload.picture || null;

  const pool = await getPool();

  const result = await pool
    .request()
    .input('email', googleEmail)
    .query(
      'SELECT user_id, full_name, phone, email, role, avatar_url, status, created_at FROM users WHERE LOWER(email) = @email'
    );

  let user = result.recordset[0];

  if (!user) {
    const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
    const placeholderPassword = `GOOGLE_AUTH_${googleSub}`;

    const insertResult = await pool
      .request()
      .input('fullName', googleName)
      .input('phone', randomPhone)
      .input('email', googleEmail)
      .input('password', placeholderPassword)
      .input('avatarUrl', googlePicture)
      .query(`
        INSERT INTO users (full_name, phone, email, password_hash, role, avatar_url, reputation_score, created_at)
        OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.phone, INSERTED.email, INSERTED.role, INSERTED.avatar_url, INSERTED.status, INSERTED.created_at
        VALUES (@fullName, @phone, @email, @password, 'PLAYER', @avatarUrl, 5.0, GETDATE())
      `);
    user = insertResult.recordset[0];
  } else if (!user.avatar_url && googlePicture) {
    try {
      await pool
        .request()
        .input('userId', user.user_id)
        .input('avatarUrl', googlePicture)
        .query('UPDATE users SET avatar_url = @avatarUrl WHERE user_id = @userId');
      user.avatar_url = googlePicture;
    } catch {
      // ignore
    }
  }

  const googleUserStatus = (user.status || 'ACTIVE').toUpperCase();
  if (googleUserStatus === 'LOCKED') {
    throw new AppError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ chủ sân để được hỗ trợ.', 403);
  }
  if (googleUserStatus === 'INACTIVE') {
    throw new AppError('Tài khoản này đã ngừng hoạt động trong hệ thống.', 403);
  }

  const normalizedRole = (user.role || 'PLAYER').toLowerCase();

  const token = jwt.sign(
    {
      id: user.user_id,
      role: normalizedRole,
      email: user.email,
      fullName: user.full_name,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.user_id,
      fullName: user.full_name,
      phone: user.phone,
      email: user.email,
      role: normalizedRole,
      avatarUrl: user.avatar_url || googlePicture || null,
      createdAt: user.created_at,
    },
  };
}

/**
 * [4.1 - S3-01] Yêu cầu khôi phục mật khẩu (Quên mật khẩu):
 * Sinh mã OTP 6 chữ số có hiệu lực 10 phút cho tài khoản theo Email hoặc Số điện thoại.
 */
export async function forgotPassword(data = {}) {
  const identifier = (data.identifier || data.email || data.phone || '').trim();
  if (!identifier) {
    throw new AppError('Vui lòng nhập Email hoặc Số điện thoại đã đăng ký.', 400);
  }

  const pool = await getPool();
  await ensureUserProfileColumns(pool);

  const userRes = await pool
    .request()
    .input('identifier', identifier)
    .query(`
      SELECT user_id, full_name, email, phone, status
      FROM users
      WHERE LOWER(email) = LOWER(@identifier) OR phone = @identifier
    `);

  const user = userRes.recordset[0];
  if (!user) {
    throw new AppError('Không tìm thấy tài khoản nào khớp với Email hoặc Số điện thoại này.', 404);
  }

  const status = (user.status || 'ACTIVE').toUpperCase();
  if (status === 'LOCKED' || status === 'INACTIVE') {
    throw new AppError('Tài khoản này đang bị khóa hoặc ngừng hoạt động.', 403);
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));

  await pool
    .request()
    .input('userId', user.user_id)
    .input('otp', otp)
    .query(`
      UPDATE users
      SET reset_otp = @otp,
          reset_otp_expires = DATEADD(MINUTE, 10, GETDATE())
      WHERE user_id = @userId
    `);

  await createAuthNotificationSafe(
    pool,
    user.user_id,
    'Mã OTP khôi phục mật khẩu SportLink',
    `Mã xác thực OTP khôi phục mật khẩu của bạn là: ${otp} (hiệu lực trong 10 phút).`
  );

  const maskedEmail = user.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    : '';

  return {
    identifier,
    maskedEmail,
    fullName: user.full_name,
    expiresInMinutes: 10,
    sandboxOtp: otp, // Hiển thị trên Sandbox UI để thuận tiện kiểm thử & demo
    message: `Đã gửi mã xác thực OTP 6 chữ số tới tài khoản ${maskedEmail || identifier}.`,
  };
}

/**
 * [4.1 - S3-01] Kiểm tra mã OTP khôi phục mật khẩu trước khi đặt mật khẩu mới.
 */
export async function verifyResetOtp(data = {}) {
  const identifier = (data.identifier || data.email || '').trim();
  const otp = String(data.otp || '').trim();

  if (!identifier || !otp) {
    throw new AppError('Vui lòng nhập đầy đủ thông tin tài khoản và mã xác thực OTP.', 400);
  }

  const pool = await getPool();
  await ensureUserProfileColumns(pool);

  const res = await pool
    .request()
    .input('identifier', identifier)
    .query(`
      SELECT user_id, reset_otp,
             CASE WHEN reset_otp_expires >= GETDATE() THEN 1 ELSE 0 END AS is_valid_time
      FROM users
      WHERE LOWER(email) = LOWER(@identifier) OR phone = @identifier
    `);

  const user = res.recordset[0];
  if (!user) {
    throw new AppError('Không tìm thấy tài khoản người dùng.', 404);
  }

  if (!user.reset_otp || String(user.reset_otp).trim() !== otp) {
    throw new AppError('Mã xác thực OTP không chính xác. Vui lòng kiểm tra lại.', 400);
  }

  if (!user.is_valid_time) {
    throw new AppError('Mã xác thực OTP đã hết hạn (quá 10 phút). Vui lòng yêu cầu mã mới.', 400);
  }

  return {
    valid: true,
    message: 'Xác thực mã OTP thành công. Vui lòng thiết lập mật khẩu mới.',
  };
}

/**
 * [4.1 - S3-01] Đặt lại mật khẩu mới sau khi xác thực OTP thành công.
 */
export async function resetPassword(data = {}) {
  const identifier = (data.identifier || data.email || '').trim();
  const otp = String(data.otp || '').trim();
  const newPassword = data.newPassword || data.password || '';

  if (!identifier || !otp) {
    throw new AppError('Thiếu thông tin tài khoản hoặc mã xác thực OTP.', 400);
  }
  if (!newPassword || newPassword.length < 6) {
    throw new AppError('Mật khẩu mới phải có tối thiểu 6 ký tự.', 400);
  }

  await verifyResetOtp({ identifier, otp });

  const pool = await getPool();
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const updateRes = await pool
    .request()
    .input('identifier', identifier)
    .input('password', hashedPassword)
    .query(`
      UPDATE users
      SET password_hash = @password,
          reset_otp = NULL,
          reset_otp_expires = NULL
      OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.email
      WHERE LOWER(email) = LOWER(@identifier) OR phone = @identifier
    `);

  const updated = updateRes.recordset[0];
  if (updated) {
    await createAuthNotificationSafe(
      pool,
      updated.user_id,
      'Mật khẩu đã được đặt lại thành công',
      'Mật khẩu tài khoản SportLink của bạn vừa được thay đổi thông qua quy trình khôi phục OTP.'
    );
  }

  return {
    success: true,
    message: 'Đặt lại mật khẩu mới thành công! Bạn có thể đăng nhập bằng mật khẩu mới.',
  };
}

/**
 * [4.1 - S3-02] Lấy thông tin hồ sơ người chơi theo user_id kèm thống kê hoạt động đặt sân.
 * @param {number} userId
 */
export async function getUserById(userId) {
  const pool = await getPool();
  await ensureUserProfileColumns(pool);

  const result = await pool
    .request()
    .input('id', userId)
    .query(`
      SELECT user_id, full_name, phone, email, role, avatar_url, reputation_score,
             status, gender, dob, address, bio, favorite_sports, created_at
      FROM users
      WHERE user_id = @id
    `);

  const user = result.recordset[0];
  if (!user) return null;

  // Thống kê hoạt động đặt sân của người chơi
  let stats = {
    totalBookings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalSpent: 0,
    memberTier: 'Thành viên Đồng',
  };

  try {
    const statRes = await pool
      .request()
      .input('uid', userId)
      .query(`
        SELECT
          COUNT(CASE WHEN status <> 'CANCELLED' THEN 1 END) AS total_bookings,
          COUNT(CASE WHEN status IN ('PENDING', 'CONFIRMED', 'CHECKED-IN') AND booking_date >= CAST(GETDATE() AS DATE) THEN 1 END) AS upcoming_bookings,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_bookings,
          COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_bookings,
          ISNULL(SUM(CASE WHEN status IN ('CONFIRMED', 'CHECKED-IN', 'COMPLETED') THEN total_price ELSE 0 END), 0) AS total_spent
        FROM bookings
        WHERE user_id = @uid
      `);

    const row = statRes.recordset[0];
    if (row) {
      const totalSpent = Number(row.total_spent || 0);
      const memberTier =
        totalSpent >= 5000000
          ? 'Hạng Kim Cương'
          : totalSpent >= 2000000
            ? 'Hạng Vàng'
            : totalSpent >= 500000
              ? 'Hạng Bạc'
              : 'Thành viên Thân thiết';

      stats = {
        totalBookings: Number(row.total_bookings || 0),
        upcomingBookings: Number(row.upcoming_bookings || 0),
        completedBookings: Number(row.completed_bookings || 0),
        cancelledBookings: Number(row.cancelled_bookings || 0),
        totalSpent,
        memberTier,
      };
    }
  } catch {
    // ignore if bookings table not ready
  }

  const dobStr = user.dob
    ? new Date(user.dob).toISOString().slice(0, 10)
    : null;

  return {
    id: user.user_id,
    fullName: user.full_name,
    phone: user.phone || '',
    email: user.email,
    role: (user.role || 'PLAYER').toLowerCase(),
    avatarUrl: user.avatar_url || null,
    reputationScore: Number(user.reputation_score ?? 5.0),
    status: user.status || 'ACTIVE',
    gender: user.gender || '',
    dob: dobStr,
    address: user.address || '',
    bio: user.bio || '',
    favoriteSports: user.favorite_sports
      ? String(user.favorite_sports)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : ['Bóng đá', 'Cầu lông', 'Pickleball'],
    createdAt: user.created_at,
    stats,
  };
}

/**
 * [4.1 - S3-02] Cập nhật thông tin hồ sơ cá nhân người chơi & đồng bộ sang bảng customers.
 * @param {number} userId
 * @param {{ fullName?: string, phone?: string, gender?: string, dob?: string, address?: string, bio?: string, favoriteSports?: string[] | string }} data
 */
export async function updateProfile(userId, data = {}) {
  const pool = await getPool();
  await ensureUserProfileColumns(pool);

  const current = await getUserById(userId);
  if (!current) {
    throw new AppError('Không tìm thấy tài khoản người dùng.', 404);
  }

  const fullName =
    data.fullName !== undefined ? String(data.fullName).trim() : current.fullName;
  if (!fullName) {
    throw new AppError('Họ và tên không được để trống.', 400);
  }

  const phone =
    data.phone !== undefined
      ? String(data.phone).trim().replace(/\s+/g, '')
      : current.phone;

  if (phone && !/^(0|\+84)[0-9]{8,10}$/.test(phone)) {
    throw new AppError('Số điện thoại không hợp lệ (cần 10 chữ số, ví dụ: 0912345678).', 400);
  }

  // Kiểm tra trùng số điện thoại với người dùng khác
  if (phone && phone !== current.phone) {
    const dupPhone = await pool
      .request()
      .input('phone', phone)
      .input('userId', userId)
      .query('SELECT user_id FROM users WHERE phone = @phone AND user_id <> @userId');
    if (dupPhone.recordset.length > 0) {
      throw new AppError('Số điện thoại này đã được sử dụng bởi một tài khoản khác.', 409);
    }
  }

  const gender = data.gender !== undefined ? String(data.gender).trim() : current.gender;
  const dob =
    data.dob !== undefined && String(data.dob).trim() !== ''
      ? String(data.dob).trim()
      : null;
  const address =
    data.address !== undefined ? String(data.address).trim() : current.address;
  const bio = data.bio !== undefined ? String(data.bio).trim() : current.bio;

  let favSportsStr = '';
  if (Array.isArray(data.favoriteSports)) {
    favSportsStr = data.favoriteSports.map((s) => String(s).trim()).filter(Boolean).join(', ');
  } else if (typeof data.favoriteSports === 'string') {
    favSportsStr = data.favoriteSports.trim();
  } else {
    favSportsStr = (current.favoriteSports || []).join(', ');
  }

  await pool
    .request()
    .input('userId', userId)
    .input('fullName', fullName)
    .input('phone', phone)
    .input('gender', gender || null)
    .input('dob', dob)
    .input('address', address || null)
    .input('bio', bio || null)
    .input('favoriteSports', favSportsStr || null)
    .query(`
      UPDATE users
      SET full_name = @fullName,
          phone = @phone,
          gender = @gender,
          dob = @dob,
          address = @address,
          bio = @bio,
          favorite_sports = @favoriteSports
      WHERE user_id = @userId
    `);

  // Đồng bộ Họ tên & SĐT sang bảng customers (CRM)
  try {
    await pool
      .request()
      .input('userId', userId)
      .input('fullName', fullName)
      .input('phone', phone)
      .query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
        BEGIN
          UPDATE customers
          SET full_name = @fullName,
              phone = CASE WHEN NOT EXISTS (SELECT 1 FROM customers WHERE phone = @phone AND user_id <> @userId) THEN @phone ELSE phone END,
              updated_at = GETDATE()
          WHERE user_id = @userId
        END
      `);
  } catch {
    // ignore customer sync conflict
  }

  return getUserById(userId);
}

/**
 * [4.1 - S3-02] Đổi mật khẩu trong trang Hồ sơ người chơi.
 */
export async function changePassword(userId, data = {}) {
  const { currentPassword, newPassword } = data;

  if (!newPassword || String(newPassword).length < 6) {
    throw new AppError('Mật khẩu mới phải có tối thiểu 6 ký tự.', 400);
  }

  const pool = await getPool();
  const res = await pool
    .request()
    .input('userId', userId)
    .query('SELECT user_id, password_hash FROM users WHERE user_id = @userId');

  const user = res.recordset[0];
  if (!user) {
    throw new AppError('Không tìm thấy tài khoản người dùng.', 404);
  }

  const isGooglePlaceholder = String(user.password_hash || '').startsWith('GOOGLE_AUTH_');
  if (!isGooglePlaceholder) {
    if (!currentPassword) {
      throw new AppError('Vui lòng nhập mật khẩu hiện tại.', 400);
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không chính xác.', 400);
    }
  }

  const hashedNew = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool
    .request()
    .input('userId', userId)
    .input('password', hashedNew)
    .query('UPDATE users SET password_hash = @password WHERE user_id = @userId');

  await createAuthNotificationSafe(
    pool,
    userId,
    'Đổi mật khẩu tài khoản thành công',
    'Mật khẩu đăng nhập SportLink của bạn đã được cập nhật thành công.'
  );

  return {
    success: true,
    message: 'Đổi mật khẩu thành công!',
  };
}

/**
 * Cập nhật đường dẫn ảnh đại diện cho người dùng trong cơ sở dữ liệu.
 * @param {number} userId
 * @param {string} avatarUrl
 */
export async function updateAvatar(userId, avatarUrl) {
  const pool = await getPool();
  await pool
    .request()
    .input('userId', userId)
    .input('avatarUrl', avatarUrl)
    .query('UPDATE users SET avatar_url = @avatarUrl WHERE user_id = @userId');

  return { avatarUrl };
}

/**
 * Lấy danh sách thông báo in-app của người dùng (phục vụ S3-14 & S3-15).
 */
export async function getUserNotifications(userId) {
  const pool = await getPool();
  try {
    const res = await pool
      .request()
      .input('userId', userId)
      .query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
        BEGIN
          SELECT TOP 25 notification_id, user_id, title, content, is_read, created_at
          FROM notifications
          WHERE user_id = @userId
          ORDER BY created_at DESC, notification_id DESC
        END
      `);
    const list = res.recordset || [];
    return {
      unreadCount: list.filter((n) => !n.is_read).length,
      notifications: list,
    };
  } catch {
    return { unreadCount: 0, notifications: [] };
  }
}

/**
 * Đánh dấu đã đọc toàn bộ thông báo của người dùng.
 */
export async function markNotificationsRead(userId) {
  const pool = await getPool();
  try {
    await pool
      .request()
      .input('userId', userId)
      .query(`
        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
        BEGIN
          UPDATE notifications SET is_read = 1 WHERE user_id = @userId AND is_read = 0
        END
      `);
  } catch {
    // ignore
  }
  return { success: true };
}
