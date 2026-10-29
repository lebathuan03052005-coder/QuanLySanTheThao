import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPool } from '../../core/config/db.js';

const SALT_ROUNDS = 12;

/**
 * Đăng ký tài khoản mới.
 * @param {{ fullName, email, password, role }} data
 */
export async function register(data) {
  const { fullName, email, password, role = 'player' } = data;
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const pool = await getPool();
  const result = await pool.request()
    .input('fullName', fullName)
    .input('email', email)
    .input('password', hashedPassword)
    .input('role', role)
    .query(`
      INSERT INTO Users (FullName, Email, Password, Role, CreatedAt)
      OUTPUT INSERTED.Id, INSERTED.FullName, INSERTED.Email, INSERTED.Role
      VALUES (@fullName, @email, @password, @role, GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Đăng nhập và trả về JWT.
 * @param {{ email, password }} data
 */
export async function login(data) {
  const { email, password } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('email', email)
    .query('SELECT * FROM Users WHERE Email = @email');

  const user = result.recordset[0];
  if (!user) throw new Error('Email hoặc mật khẩu không đúng.');

  const isMatch = await bcrypt.compare(password, user.Password);
  if (!isMatch) throw new Error('Email hoặc mật khẩu không đúng.');

  const token = jwt.sign(
    { id: user.Id, role: user.Role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { Password: _, ...safeUser } = user;
  return { token, user: safeUser };
}

/**
 * Lấy thông tin người dùng theo ID.
 * @param {number} userId
 */
export async function getUserById(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', userId)
    .query('SELECT Id, FullName, Email, Role, CreatedAt FROM Users WHERE Id = @id');
  return result.recordset[0] || null;
}
