import bcrypt from 'bcrypt';
import { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

const SALT_ROUNDS = 12;

/**
 * Lấy danh sách nhân viên thuộc quyền quản lý của chủ sân (owner).
 * Hỗ trợ tìm kiếm theo họ tên, email, sđt và lọc theo trạng thái.
 * @param {number} ownerId
 * @param {{ search?: string, status?: string }} query
 */
export async function getStaffList(ownerId, query = {}) {
  const { search = '', status = '' } = query;
  const pool = await getPool();

  let sqlQuery = `
    SELECT u.user_id, u.full_name, u.phone, u.email, u.role, u.status, u.job_title, u.avatar_url, u.created_at
    FROM users u
    WHERE u.role = 'STAFF' AND u.owner_id = @ownerId
  `;

  const request = pool.request().input('ownerId', ownerId);

  if (search && search.trim()) {
    request.input('search', `%${search.trim().toLowerCase()}%`);
    sqlQuery += ` AND (LOWER(u.full_name) LIKE @search OR LOWER(u.email) LIKE @search OR u.phone LIKE @search)`;
  }

  if (status && status.trim() && status !== 'ALL') {
    request.input('status', status.trim().toUpperCase());
    sqlQuery += ` AND UPPER(u.status) = @status`;
  }

  sqlQuery += ` ORDER BY u.created_at DESC`;

  const staffResult = await request.query(sqlQuery);
  const staffList = staffResult.recordset;

  // Lấy danh sách sân được phân công cho từng nhân viên
  const staffIds = staffList.map((s) => s.user_id);
  let assignmentsMap = {};

  if (staffIds.length > 0) {
    const assignmentsResult = await pool.request().query(`
      SELECT cs.staff_id, cs.court_id, c.court_name, c.sport_id, c.address
      FROM court_staff cs
      JOIN courts c ON cs.court_id = c.court_id
      WHERE cs.staff_id IN (${staffIds.join(',')})
    `);

    assignmentsResult.recordset.forEach((row) => {
      if (!assignmentsMap[row.staff_id]) {
        assignmentsMap[row.staff_id] = [];
      }
      assignmentsMap[row.staff_id].push({
        courtId: row.court_id,
        courtName: row.court_name,
        sportId: row.sport_id,
        address: row.address,
      });
    });
  }

  return staffList.map((s) => ({
    id: s.user_id,
    fullName: s.full_name,
    phone: s.phone,
    email: s.email,
    role: s.role.toLowerCase(),
    status: (s.status || 'ACTIVE').toUpperCase(),
    jobTitle: s.job_title || 'Nhân viên',
    avatarUrl: s.avatar_url || null,
    createdAt: s.created_at,
    assignedCourts: assignmentsMap[s.user_id] || [],
  }));
}

/**
 * Lấy thông tin chi tiết một nhân viên thuộc chủ sân quản lý.
 * @param {number} ownerId
 * @param {number} staffId
 */
export async function getStaffById(ownerId, staffId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('staffId', staffId)
    .query(`
      SELECT user_id, full_name, phone, email, role, status, job_title, avatar_url, created_at
      FROM users
      WHERE user_id = @staffId AND owner_id = @ownerId AND role = 'STAFF'
    `);

  const staff = result.recordset[0];
  if (!staff) {
    throw new AppError('Không tìm thấy thông tin nhân viên hoặc nhân viên không thuộc quyền quản lý của bạn.', 404);
  }

  // Lấy các sân được phân công
  const courtsResult = await pool.request()
    .input('staffId', staffId)
    .query(`
      SELECT cs.court_id, c.court_name, c.sport_id, c.address
      FROM court_staff cs
      JOIN courts c ON cs.court_id = c.court_id
      WHERE cs.staff_id = @staffId
    `);

  return {
    id: staff.user_id,
    fullName: staff.full_name,
    phone: staff.phone,
    email: staff.email,
    role: staff.role.toLowerCase(),
    status: (staff.status || 'ACTIVE').toUpperCase(),
    jobTitle: staff.job_title || 'Nhân viên',
    avatarUrl: staff.avatar_url || null,
    createdAt: staff.created_at,
    assignedCourts: courtsResult.recordset.map((r) => ({
      courtId: r.court_id,
      courtName: r.court_name,
      sportId: r.sport_id,
      address: r.address,
    })),
  };
}

/**
 * Tạo mới tài khoản nhân viên và phân công sân phụ trách.
 * @param {number} ownerId
 * @param {{ fullName: string, email: string, phone: string, password: string, jobTitle?: string, courtIds?: number[] }} data
 */
export async function createStaff(ownerId, data) {
  const { fullName, email, phone, password, jobTitle = 'Nhân viên', courtIds = [] } = data;

  if (!fullName || !fullName.trim()) {
    throw new AppError('Họ và tên nhân viên không được để trống.', 400);
  }
  if (!email || !email.trim()) {
    throw new AppError('Email đăng nhập của nhân viên không được để trống.', 400);
  }
  if (!phone || !phone.trim()) {
    throw new AppError('Số điện thoại không được để trống.', 400);
  }
  if (!password || password.length < 6) {
    throw new AppError('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự.', 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const pool = await getPool();

  // Kiểm tra email hoặc sđt đã tồn tại trong hệ thống chưa
  const existing = await pool.request()
    .input('email', cleanEmail)
    .input('phone', cleanPhone)
    .query('SELECT user_id FROM users WHERE LOWER(email) = @email OR phone = @phone');

  if (existing.recordset.length > 0) {
    throw new AppError('Email hoặc số điện thoại này đã được đăng ký tài khoản trong hệ thống.', 409);
  }

  // Mã hóa mật khẩu bằng bcrypt
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Tạo tài khoản với vai trò STAFF và gán owner_id
  const insertUserResult = await pool.request()
    .input('fullName', fullName.trim())
    .input('phone', cleanPhone)
    .input('email', cleanEmail)
    .input('password', hashedPassword)
    .input('ownerId', ownerId)
    .input('jobTitle', jobTitle.trim() || 'Nhân viên')
    .query(`
      INSERT INTO users (full_name, phone, email, password_hash, role, status, owner_id, job_title, reputation_score, created_at)
      OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.phone, INSERTED.email, INSERTED.role, INSERTED.status, INSERTED.job_title, INSERTED.created_at
      VALUES (@fullName, @phone, @email, @password, 'STAFF', 'ACTIVE', @ownerId, @jobTitle, 5.0, GETDATE())
    `);

  const createdUser = insertUserResult.recordset[0];
  const staffId = createdUser.user_id;

  // Phân công nhân viên vào các sân được chọn (chỉ những sân thuộc quyền sở hữu của ownerId)
  if (Array.isArray(courtIds) && courtIds.length > 0) {
    for (const cid of courtIds) {
      const validCourt = await pool.request()
        .input('courtId', cid)
        .input('ownerId', ownerId)
        .query('SELECT court_id FROM courts WHERE court_id = @courtId AND owner_id = @ownerId');

      if (validCourt.recordset.length > 0) {
        await pool.request()
          .input('staffId', staffId)
          .input('courtId', cid)
          .input('assignedBy', ownerId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM court_staff WHERE staff_id = @staffId AND court_id = @courtId)
            BEGIN
              INSERT INTO court_staff (staff_id, court_id, assigned_by, assigned_at)
              VALUES (@staffId, @courtId, @assignedBy, GETDATE())
            END
          `);
      }
    }
  }

  return await getStaffById(ownerId, staffId);
}

/**
 * Cập nhật thông tin nhân viên và danh sách sân phân công.
 * @param {number} ownerId
 * @param {number} staffId
 * @param {{ fullName?: string, phone?: string, jobTitle?: string, password?: string, courtIds?: number[] }} data
 */
export async function updateStaff(ownerId, staffId, data) {
  const { fullName, phone, jobTitle, password, courtIds } = data;
  const pool = await getPool();

  // Kiểm tra nhân viên có thuộc chủ sân này không
  const checkStaff = await pool.request()
    .input('ownerId', ownerId)
    .input('staffId', staffId)
    .query('SELECT user_id FROM users WHERE user_id = @staffId AND owner_id = @ownerId AND role = \'STAFF\'');

  if (checkStaff.recordset.length === 0) {
    throw new AppError('Nhân viên không tồn tại hoặc không thuộc quyền quản lý của bạn.', 404);
  }

  // Cập nhật thông tin cơ bản
  const request = pool.request()
    .input('staffId', staffId)
    .input('fullName', fullName ? fullName.trim() : null)
    .input('phone', phone ? phone.trim() : null)
    .input('jobTitle', jobTitle ? jobTitle.trim() : null);

  let updateFields = [];
  if (fullName) updateFields.push('full_name = @fullName');
  if (phone) updateFields.push('phone = @phone');
  if (jobTitle) updateFields.push('job_title = @jobTitle');

  if (password && password.trim().length >= 6) {
    const hashedPassword = await bcrypt.hash(password.trim(), SALT_ROUNDS);
    request.input('password', hashedPassword);
    updateFields.push('password_hash = @password');
  }

  if (updateFields.length > 0) {
    await request.query(`UPDATE users SET ${updateFields.join(', ')} WHERE user_id = @staffId`);
  }

  // Cập nhật danh sách phân công sân nếu có truyền courtIds
  if (Array.isArray(courtIds)) {
    // Xóa các phân công cũ đối với các sân thuộc chủ sân này
    await pool.request()
      .input('staffId', staffId)
      .input('ownerId', ownerId)
      .query(`
        DELETE FROM court_staff
        WHERE staff_id = @staffId
          AND court_id IN (SELECT court_id FROM courts WHERE owner_id = @ownerId)
      `);

    // Gán các sân mới
    for (const cid of courtIds) {
      const validCourt = await pool.request()
        .input('courtId', cid)
        .input('ownerId', ownerId)
        .query('SELECT court_id FROM courts WHERE court_id = @courtId AND owner_id = @ownerId');

      if (validCourt.recordset.length > 0) {
        await pool.request()
          .input('staffId', staffId)
          .input('courtId', cid)
          .input('assignedBy', ownerId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM court_staff WHERE staff_id = @staffId AND court_id = @courtId)
            BEGIN
              INSERT INTO court_staff (staff_id, court_id, assigned_by, assigned_at)
              VALUES (@staffId, @courtId, @assignedBy, GETDATE())
            END
          `);
      }
    }
  }

  return await getStaffById(ownerId, staffId);
}

/**
 * Cập nhật trạng thái tài khoản nhân viên (ACTIVE, LOCKED, INACTIVE).
 * @param {number} ownerId
 * @param {number} staffId
 * @param {'ACTIVE' | 'LOCKED' | 'INACTIVE'} status
 */
export async function updateStaffStatus(ownerId, staffId, status) {
  const cleanStatus = (status || '').toUpperCase();
  const validStatuses = ['ACTIVE', 'LOCKED', 'INACTIVE'];

  if (!validStatuses.includes(cleanStatus)) {
    throw new AppError('Trạng thái không hợp lệ. Chỉ chấp nhận ACTIVE, LOCKED hoặc INACTIVE.', 400);
  }

  const pool = await getPool();

  const result = await pool.request()
    .input('ownerId', ownerId)
    .input('staffId', staffId)
    .input('status', cleanStatus)
    .query(`
      UPDATE users 
      SET status = @status 
      OUTPUT INSERTED.user_id, INSERTED.full_name, INSERTED.status
      WHERE user_id = @staffId AND owner_id = @ownerId AND role = 'STAFF'
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Không tìm thấy nhân viên thuộc quyền quản lý của bạn.', 404);
  }

  return {
    id: result.recordset[0].user_id,
    fullName: result.recordset[0].full_name,
    status: result.recordset[0].status,
  };
}

/**
 * Lấy danh sách toàn bộ các sân do chủ sân sở hữu để phục vụ giao diện phân công.
 * @param {number} ownerId
 */
export async function getOwnerCourts(ownerId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('ownerId', ownerId)
    .query(`
      SELECT court_id, court_name, sport_id, address, status, images
      FROM courts
      WHERE owner_id = @ownerId
      ORDER BY court_name ASC
    `);

  return result.recordset.map((c) => ({
    courtId: c.court_id,
    courtName: c.court_name,
    sportId: c.sport_id,
    address: c.address,
    status: c.status,
    images: c.images,
  }));
}
