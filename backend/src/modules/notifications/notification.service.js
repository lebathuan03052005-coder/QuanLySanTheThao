import sql, { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';

export const NOTIFICATION_TYPES = ['BOOKING', 'PAYMENT', 'MATCH', 'TEAM', 'SYSTEM'];

function normalizeType(type) {
  const upper = String(type || 'SYSTEM').trim().toUpperCase();
  return NOTIFICATION_TYPES.includes(upper) ? upper : 'SYSTEM';
}

/**
 * Tạo một thông báo mới cho người dùng một cách an toàn (không làm gián đoạn luồng nghiệp vụ chính nếu có lỗi).
 * @param {import('mssql').ConnectionPool | null} poolOrNull
 * @param {{ userId: number, title: string, content: string, type?: string, link?: string | null }} payload
 */
export async function createNotificationSafe(poolOrNull, { userId, title, content, type = 'SYSTEM', link = null }) {
  const cleanUserId = Number(userId);
  if (!cleanUserId || Number.isNaN(cleanUserId)) return null;

  const cleanTitle = String(title || 'Thông báo hệ thống').trim().slice(0, 255);
  const cleanContent = String(content || '').trim();
  const cleanType = normalizeType(type);
  const cleanLink = link ? String(link).trim().slice(0, 255) : null;

  try {
    const pool = poolOrNull || (await getPool());
    const result = await pool
      .request()
      .input('userId', sql.Int, cleanUserId)
      .input('title', sql.NVarChar(255), cleanTitle)
      .input('content', sql.NVarChar(sql.MAX), cleanContent)
      .input('type', sql.VarChar(30), cleanType)
      .input('link', sql.NVarChar(255), cleanLink)
      .query(`
        INSERT INTO notifications (user_id, title, content, type, link, is_read, created_at)
        OUTPUT INSERTED.*
        VALUES (@userId, @title, @content, @type, @link, 0, GETDATE())
      `);
    return result.recordset[0] || null;
  } catch (err) {
    // Fallback nếu DB chưa chạy migration thêm cột type / link
    try {
      const pool = poolOrNull || (await getPool());
      const result = await pool
        .request()
        .input('userId', sql.Int, cleanUserId)
        .input('title', sql.NVarChar(255), cleanTitle)
        .input('content', sql.NVarChar(sql.MAX), cleanContent)
        .query(`
          INSERT INTO notifications (user_id, title, content, is_read, created_at)
          OUTPUT INSERTED.*
          VALUES (@userId, @title, @content, 0, GETDATE())
        `);
      return result.recordset[0] || null;
    } catch {
      return null;
    }
  }
}

/**
 * Gửi cùng một thông báo tới nhiều người dùng (loại bỏ trùng lặp và ID không hợp lệ).
 */
export async function createNotificationsForUsers(poolOrNull, userIds = [], payload) {
  const uniqueIds = [...new Set((userIds || []).map(Number).filter((id) => id > 0 && !Number.isNaN(id)))];
  if (uniqueIds.length === 0) return [];

  const results = [];
  for (const uid of uniqueIds) {
    const created = await createNotificationSafe(poolOrNull, { ...payload, userId: uid });
    if (created) results.push(created);
  }
  return results;
}

/**
 * Lấy danh sách user_id của chủ sân và các nhân viên đang hoạt động được phân công trực sân đó.
 */
export async function getCourtManagementRecipientIds(poolOrNull, courtId, excludeUserId = null) {
  const cleanCourtId = Number(courtId);
  if (!cleanCourtId || Number.isNaN(cleanCourtId)) return [];

  try {
    const pool = poolOrNull || (await getPool());
    const result = await pool
      .request()
      .input('courtId', sql.Int, cleanCourtId)
      .query(`
        SELECT c.owner_id AS user_id
        FROM courts c
        WHERE c.court_id = @courtId AND c.owner_id IS NOT NULL
        UNION
        SELECT cs.staff_id AS user_id
        FROM court_staff cs
        INNER JOIN users u ON cs.staff_id = u.user_id
        WHERE cs.court_id = @courtId
          AND UPPER(ISNULL(u.status, 'ACTIVE')) = 'ACTIVE'
      `);

    const excludeId = excludeUserId ? Number(excludeUserId) : null;
    return result.recordset
      .map((r) => Number(r.user_id))
      .filter((id) => id > 0 && id !== excludeId);
  } catch {
    return [];
  }
}

/**
 * Lấy danh sách thông báo của người dùng hiện tại (có phân trang & bộ lọc).
 */
export async function getUserNotifications(userId, query = {}) {
  const cleanUserId = Number(userId);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const unreadOnly = query.unreadOnly === true || query.unreadOnly === 'true' || query.unreadOnly === '1';
  const typeFilter = query.type ? normalizeType(query.type) : null;

  const pool = await getPool();

  const whereClauses = ['user_id = @userId'];
  if (unreadOnly) {
    whereClauses.push('ISNULL(is_read, 0) = 0');
  }
  if (typeFilter && query.type) {
    whereClauses.push('type = @type');
  }
  const whereSql = whereClauses.join(' AND ');

  const listReq = pool
    .request()
    .input('userId', sql.Int, cleanUserId)
    .input('offset', sql.Int, offset)
    .input('limit', sql.Int, limit);

  if (typeFilter && query.type) {
    listReq.input('type', sql.VarChar(30), typeFilter);
  }

  const listResult = await listReq.query(`
    SELECT
      notification_id,
      user_id,
      title,
      content,
      ISNULL(type, 'SYSTEM') AS type,
      link,
      CAST(ISNULL(is_read, 0) AS BIT) AS is_read,
      created_at,
      CASE
        WHEN DATEDIFF(SECOND, created_at, GETDATE()) < 0 THEN 0
        ELSE DATEDIFF(SECOND, created_at, GETDATE())
      END AS seconds_ago
    FROM notifications
    WHERE ${whereSql}
    ORDER BY created_at DESC, notification_id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const countReq = pool.request().input('userId', sql.Int, cleanUserId);
  if (typeFilter && query.type) {
    countReq.input('type', sql.VarChar(30), typeFilter);
  }

  const countResult = await countReq.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ISNULL(is_read, 0) = 0 THEN 1 ELSE 0 END) AS unread_total
    FROM notifications
    WHERE ${whereSql}
  `);

  const globalUnreadResult = await pool
    .request()
    .input('userId', sql.Int, cleanUserId)
    .query(`
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = @userId AND ISNULL(is_read, 0) = 0
    `);

  return {
    items: listResult.recordset,
    total: Number(countResult.recordset[0]?.total || 0),
    unreadCount: Number(globalUnreadResult.recordset[0]?.unread_count || 0),
    page,
    limit,
  };
}

/**
 * Đếm số lượng thông báo chưa đọc của người dùng.
 */
export async function getUnreadCount(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, Number(userId))
    .query(`
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE user_id = @userId AND ISNULL(is_read, 0) = 0
    `);
  return Number(result.recordset[0]?.unread_count || 0);
}

/**
 * Đánh dấu 1 thông báo là đã đọc (chỉ chủ sở hữu thông báo mới được thao tác).
 */
export async function markAsRead(notificationId, userId) {
  const cleanId = Number(notificationId);
  if (!cleanId || Number.isNaN(cleanId)) {
    throw new AppError('Mã thông báo không hợp lệ.', 400);
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, cleanId)
    .input('userId', sql.Int, Number(userId))
    .query(`
      UPDATE notifications
      SET is_read = 1
      OUTPUT INSERTED.*
      WHERE notification_id = @id AND user_id = @userId
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Không tìm thấy thông báo.', 404);
  }

  return result.recordset[0];
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc.
 */
export async function markAllAsRead(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, Number(userId))
    .query(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = @userId AND ISNULL(is_read, 0) = 0;
      SELECT @@ROWCOUNT AS updated_count;
    `);

  return {
    updatedCount: Number(result.recordset[0]?.updated_count || 0),
  };
}

/**
 * Xóa một thông báo của người dùng.
 */
export async function deleteNotification(notificationId, userId) {
  const cleanId = Number(notificationId);
  if (!cleanId || Number.isNaN(cleanId)) {
    throw new AppError('Mã thông báo không hợp lệ.', 400);
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, cleanId)
    .input('userId', sql.Int, Number(userId))
    .query(`
      DELETE FROM notifications
      OUTPUT DELETED.notification_id
      WHERE notification_id = @id AND user_id = @userId
    `);

  if (result.recordset.length === 0) {
    throw new AppError('Không tìm thấy thông báo.', 404);
  }

  return { deletedId: cleanId };
}
