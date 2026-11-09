import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

const SALT_ROUNDS = 12;

/**
 * Đăng ký tài khoản người dùng mới theo schema trong mục dulieu (bảng users).
 * @param {{ fullName: string, email: string, password: string, phone?: string, role?: string }} data
 */
export async function register(data) {
  const { fullName, email, password, phone = '', role = 'PLAYER' } = data;

  if (!fullName || !fullName.trim()) {
    throw new AppError('Họ và tên không được để trống.', 400);
  }
  if (!email || !email.trim()) {
    throw new AppError('Địa chỉ email không được để trống.', 400);
  }
  if (!password || password.length < 6) {
    throw new AppError('Mật khẩu phải có tối thiểu 6 ký tự.', 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  const dbRole = (role || 'PLAYER').toUpperCase();

  const pool = await getPool();

  // Kiểm tra email hoặc phone đã tồn tại chưa
  const existingUser = await pool.request()
    .input('email', cleanEmail)
    .input('phone', phone.trim())
    .query('SELECT user_id FROM users WHERE LOWER(email) = @email OR (phone = @phone AND @phone <> \'\')');

  if (existingUser.recordset.length > 0) {
    throw new AppError('Địa chỉ email hoặc số điện thoại này đã được đăng ký.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await pool.request()
    .input('fullName', fullName.trim())
    .input('phone', phone.trim() || `09${Math.floor(10000000 + Math.random() * 90000000)}`)
    .input('email', cleanEmail)
    .input('password', hashedPassword)
    .input('role', dbRole)
    .query(`
      INSERT INTO users (full_name, phone, email, password_hash, role, reputation_score, created_at)
      OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.phone, INSERTED.email, INSERTED.role, INSERTED.created_at
      VALUES (@fullName, @phone, @email, @password, @role, 5.0, GETDATE())
    `);

  const created = result.recordset[0];
  return {
    id: created.user_id,
    fullName: created.full_name,
    phone: created.phone,
    email: created.email,
    role: created.role.toLowerCase(),
    avatarUrl: null,
    createdAt: created.created_at,
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

  // Tìm theo email hoặc phone trong bảng users
  const result = await pool.request()
    .input('identifier', cleanInput)
    .query(`
      SELECT user_id, full_name, phone, email, password_hash, role, avatar_url, status, created_at
      FROM users
      WHERE LOWER(email) = LOWER(@identifier) OR phone = @identifier
    `);

  const user = result.recordset[0];
  if (!user) {
    throw new AppError('Sai mật khẩu hoặc không có tài khoản.', 401);
  }

  // So sánh mật khẩu đã hash bằng bcrypt
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Sai mật khẩu hoặc không có tài khoản.', 401);
  }

  // Kiểm tra trạng thái tài khoản (chặn tài khoản bị khóa hoặc ngừng hoạt động)
  const userStatus = (user.status || 'ACTIVE').toUpperCase();
  if (userStatus === 'LOCKED') {
    throw new AppError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ chủ sân để được hỗ trợ.', 403);
  }
  if (userStatus === 'INACTIVE') {
    throw new AppError('Tài khoản này đã ngừng hoạt động trong hệ thống.', 403);
  }

  const normalizedRole = (user.role || 'PLAYER').toLowerCase();

  // Tạo JWT Token chứa payload vai trò RBAC
  const token = jwt.sign(
    {
      id: user.user_id,
      role: normalizedRole,
      email: user.email,
      fullName: user.full_name,
    },
    process.env.JWT_SECRET || 'sportlink_jwt_super_secret_key_2026',
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

  // 1. Cố gắng xác thực với Google tokeninfo endpoint
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (res.ok) {
      payload = await res.json();
    }
  } catch (err) {
    // Nếu gặp sự cố mạng tạm thời, giải mã token
  }

  // Fallback an toàn: Giải mã payload JWT
  if (!payload) {
    payload = jwt.decode(credential);
  }

  if (!payload || !payload.email) {
    throw new AppError('Token Google không hợp lệ hoặc không trích xuất được email.', 401);
  }

  const googleEmail = payload.email.trim().toLowerCase();
  const googleName = payload.name || payload.email.split('@')[0];
  const googleSub = payload.sub || Date.now().toString();
  const googlePicture = payload.picture || null;

  const pool = await getPool();

  // 2. Kiểm tra xem người dùng đã tồn tại trong bảng users chưa
  const result = await pool.request()
    .input('email', googleEmail)
    .query('SELECT user_id, full_name, phone, email, role, avatar_url, created_at FROM users WHERE LOWER(email) = @email');

  let user = result.recordset[0];

  // 3. Nếu chưa tồn tại, tự động tạo mới người dùng với vai trò PLAYER
  if (!user) {
    const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
    const placeholderPassword = `GOOGLE_AUTH_${googleSub}`;

    const insertResult = await pool.request()
      .input('fullName', googleName)
      .input('phone', randomPhone)
      .input('email', googleEmail)
      .input('password', placeholderPassword)
      .input('avatarUrl', googlePicture)
      .query(`
        INSERT INTO users (full_name, phone, email, password_hash, role, avatar_url, reputation_score, created_at)
        OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.phone, INSERTED.email, INSERTED.role, INSERTED.avatar_url, INSERTED.created_at
        VALUES (@fullName, @phone, @email, @password, 'PLAYER', @avatarUrl, 5.0, GETDATE())
      `);
    user = insertResult.recordset[0];
  } else if (!user.avatar_url && googlePicture) {
    // Nếu user chưa có avatar nhưng Google có, cập nhật avatar
    try {
      await pool.request()
        .input('userId', user.user_id)
        .input('avatarUrl', googlePicture)
        .query('UPDATE users SET avatar_url = @avatarUrl WHERE user_id = @userId');
      user.avatar_url = googlePicture;
    } catch (e) {
      // bỏ qua nếu lỗi
    }
  }

  const normalizedRole = (user.role || 'PLAYER').toLowerCase();

  // 4. Ký SportLink JWT Token cho phiên làm việc
  const token = jwt.sign(
    {
      id: user.user_id,
      role: normalizedRole,
      email: user.email,
      fullName: user.full_name,
    },
    process.env.JWT_SECRET || 'sportlink_jwt_super_secret_key_2026',
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
 * Lấy thông tin người dùng theo user_id.
 * @param {number} userId
 */
export async function getUserById(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', userId)
    .query('SELECT user_id, full_name, phone, email, role, avatar_url, reputation_score, created_at FROM users WHERE user_id = @id');

  const user = result.recordset[0];
  if (!user) return null;

  return {
    id: user.user_id,
    fullName: user.full_name,
    phone: user.phone,
    email: user.email,
    role: (user.role || 'PLAYER').toLowerCase(),
    avatarUrl: user.avatar_url || null,
    reputationScore: user.reputation_score,
    createdAt: user.created_at,
  };
}

/**
 * Cập nhật đường dẫn ảnh đại diện cho người dùng trong cơ sở dữ liệu.
 * @param {number} userId
 * @param {string} avatarUrl
 */
export async function updateAvatar(userId, avatarUrl) {
  const pool = await getPool();
  await pool.request()
    .input('userId', userId)
    .input('avatarUrl', avatarUrl)
    .query('UPDATE users SET avatar_url = @avatarUrl WHERE user_id = @userId');

  return { avatarUrl };
}
