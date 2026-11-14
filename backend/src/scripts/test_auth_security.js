import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { getPool } from '../core/config/db.js';
import { register, googleLogin } from '../modules/auth/auth.service.js';

/**
 * ============================================================================
 * TEST BẢO MẬT XÁC THỰC (chạy: npm run test:auth)
 * - TC-AUTH-01/02: API đăng ký công khai bỏ qua `role` từ client, luôn tạo PLAYER
 * - TC-AUTH-03: CSDL từ chối bản ghi role ADMIN (CHECK constraint)
 * - TC-AUTH-04/05: Token Google giả bị từ chối (không còn fallback jwt.decode)
 * - TC-AUTH-06/07: Tài khoản LOCKED / INACTIVE không đăng nhập được bằng Google
 * - TC-AUTH-08: Token Google chưa xác minh email (email_verified != true) bị từ chối
 * ============================================================================
 */

const RUN = Date.now();
const PREFIX = `auth.sec.${RUN}`;
const emailOf = (name) => `${PREFIX}.${name}@sportlink.vn`;

let passed = 0;
let failed = 0;

function report(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`✅ [PASS] ${name}${detail ? ` -> ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`❌ [FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function expectAuthError(fn, expectedStatus) {
  try {
    await fn();
    throw new Error(`Mong đợi lỗi HTTP ${expectedStatus} nhưng thao tác lại thành công.`);
  } catch (err) {
    if (err.statusCode !== expectedStatus) {
      throw new Error(`Mong đợi HTTP ${expectedStatus}, nhận ${err.statusCode ?? 'undefined'}: ${err.message}`);
    }
    return err;
  }
}

/** Giả lập phản hồi Google tokeninfo để test nhánh xử lý phía server. */
async function withGooglePayload(payload, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => payload });
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function getDbRole(email) {
  const pool = await getPool();
  const res = await pool.request().input('email', email).query('SELECT role, status FROM users WHERE email = @email');
  return res.recordset[0] || null;
}

async function setStatus(email, status) {
  const pool = await getPool();
  await pool.request().input('email', email).input('status', status).query('UPDATE users SET status = @status WHERE email = @email');
}

async function cleanup() {
  const pool = await getPool();
  await pool
    .request()
    .input('like', `${PREFIX}%`)
    .query("DELETE FROM users WHERE email LIKE @like AND role = 'PLAYER'");
}

async function run() {
  console.log('===================================================================');
  console.log('🔐 CHẠY BỘ KIỂM THỬ BẢO MẬT XÁC THỰC (REGISTER ROLE / GOOGLE TOKEN)');
  console.log('===================================================================');

  const pool = await getPool();

  // ---------------------------------------------------------------- register
  const adminAttemptEmail = emailOf('admin');
  const adminAttempt = await register({
    fullName: 'Kẻ Tự Nâng Quyền',
    email: adminAttemptEmail,
    password: 'password123',
    phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: 'ADMIN',
  });
  const adminAttemptDb = await getDbRole(adminAttemptEmail);
  report(
    'TC-AUTH-01: Đăng ký với role=ADMIN vẫn tạo tài khoản PLAYER',
    adminAttempt.role === 'player' && (adminAttemptDb?.role || '').toUpperCase() === 'PLAYER',
    `API trả role=${adminAttempt.role}, DB role=${adminAttemptDb?.role}`
  );

  const ownerAttemptEmail = emailOf('owner');
  const ownerAttempt = await register({
    fullName: 'Kẻ Tự Nhận Chủ Sân',
    email: ownerAttemptEmail,
    password: 'password123',
    phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: 'owner',
  });
  const ownerAttemptDb = await getDbRole(ownerAttemptEmail);
  report(
    'TC-AUTH-02: Đăng ký với role=owner vẫn tạo tài khoản PLAYER',
    ownerAttempt.role === 'player' && (ownerAttemptDb?.role || '').toUpperCase() === 'PLAYER',
    `API trả role=${ownerAttempt.role}, DB role=${ownerAttemptDb?.role}`
  );

  // ------------------------------------------------------- CHECK constraint
  const directEmail = emailOf('direct');
  let constraintBlocked = false;
  try {
    await pool
      .request()
      .input('email', directEmail)
      .query(`
        INSERT INTO users (full_name, phone, email, password_hash, role, reputation_score, status, created_at)
        VALUES (N'Insert Trực Tiếp', '0999999999', @email, 'x', 'ADMIN', 5.0, 'ACTIVE', GETDATE())
      `);
  } catch (err) {
    constraintBlocked = err.number === 547;
  }
  await pool.request().input('email', directEmail).query('DELETE FROM users WHERE email = @email');
  report('TC-AUTH-03: CSDL từ chối insert trực tiếp role=ADMIN (CHECK constraint)', constraintBlocked);

  // ---------------------------------------------------------- forged token
  const forged = jwt.sign(
    { email: ownerAttemptEmail, email_verified: 'true', name: 'Forged', sub: 'forged-sub' },
    'khong-phai-khoa-cua-google'
  );
  let forgedRejected = false;
  try {
    await googleLogin(forged);
  } catch (err) {
    forgedRejected = err.statusCode === 401;
  }
  report('TC-AUTH-04: Token Google tự ký (chữ ký sai) bị từ chối 401', forgedRejected);

  const decodedOnly = Buffer.from(JSON.stringify({ email: `${PREFIX}.unsigned@sportlink.vn` })).toString('base64url');
  let unsignedRejected = false;
  try {
    await googleLogin(`eyJhbGciOiJub25lIn0.${decodedOnly}.`);
  } catch (err) {
    unsignedRejected = err.statusCode === 401;
  }
  const unsignedUser = await getDbRole(`${PREFIX}.unsigned@sportlink.vn`);
  report(
    'TC-AUTH-05: Token alg=none không tạo tài khoản mới và bị từ chối 401',
    unsignedRejected && unsignedUser === null,
    unsignedUser ? 'tài khoản đã bị tạo trái phép' : 'không tạo tài khoản'
  );

  // ------------------------------------------------------ LOCKED / INACTIVE
  await setStatus(adminAttemptEmail, 'LOCKED');
  const lockedPayload = { email: adminAttemptEmail, email_verified: 'true', name: 'Locked', sub: 'locked-sub' };
  const lockedErr = await withGooglePayload(lockedPayload, () =>
    expectAuthError(() => googleLogin('fake-credential'), 403)
  );
  report(
    'TC-AUTH-06: Tài khoản LOCKED không đăng nhập được bằng Google (403)',
    /khóa/i.test(lockedErr.message),
    lockedErr.message
  );

  await setStatus(ownerAttemptEmail, 'INACTIVE');
  const inactivePayload = { email: ownerAttemptEmail, email_verified: 'true', name: 'Inactive', sub: 'inactive-sub' };
  const inactiveErr = await withGooglePayload(inactivePayload, () =>
    expectAuthError(() => googleLogin('fake-credential'), 403)
  );
  report(
    'TC-AUTH-07: Tài khoản INACTIVE không đăng nhập được bằng Google (403)',
    /ngừng hoạt động/i.test(inactiveErr.message),
    inactiveErr.message
  );

  // ------------------------------------------------ email_verified != true
  const unverifiedPayload = {
    email: `${PREFIX}.unverified@sportlink.vn`,
    email_verified: 'false',
    name: 'Unverified',
    sub: 'unverified-sub',
  };
  const unverifiedErr = await withGooglePayload(unverifiedPayload, () =>
    expectAuthError(() => googleLogin('fake-credential'), 401)
  );
  report(
    'TC-AUTH-08: Email Google chưa xác minh bị từ chối 401',
    /chưa được xác minh/i.test(unverifiedErr.message),
    unverifiedErr.message
  );
}

try {
  await run();
} catch (err) {
  failed++;
  console.error('❌ Lỗi khi chạy bộ test:', err.message);
} finally {
  try {
    await cleanup();
  } catch (err) {
    console.error('⚠️  Không dọn được dữ liệu test:', err.message);
  }
}

console.log('-------------------------------------------------------------------');
console.log(`KẾT QUẢ KIỂM THỬ BẢO MẬT XÁC THỰC: ${passed} PASSED / ${failed} FAILED`);
console.log('===================================================================');
process.exit(failed === 0 ? 0 : 1);
