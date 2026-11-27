import api from '../../shared/lib/axios';

export type NotificationType = 'BOOKING' | 'PAYMENT' | 'MATCH' | 'TEAM' | 'SYSTEM';

export interface NotificationItem {
  notification_id: number;
  user_id: number;
  title: string;
  content: string;
  type: NotificationType;
  link: string | null;
  is_read: boolean;
  created_at: string;
  seconds_ago?: number;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

/**
 * Lấy danh sách thông báo của người dùng đang đăng nhập.
 */
export async function fetchNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}): Promise<NotificationListResponse> {
  const res = await api.get('/notifications', { params });
  return res.data.data;
}

/**
 * Lấy nhanh số lượng thông báo chưa đọc.
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = await api.get('/notifications/unread-count');
  return Number(res.data?.data?.unreadCount || 0);
}

/**
 * Đánh dấu một thông báo là đã đọc.
 */
export async function markNotificationAsRead(notificationId: number): Promise<NotificationItem> {
  const res = await api.patch(`/notifications/${notificationId}/read`);
  return res.data.data;
}

/**
 * Đánh dấu tất cả thông báo là đã đọc.
 */
export async function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  const res = await api.patch('/notifications/read-all');
  return res.data.data;
}

/**
 * Xóa một thông báo.
 */
export async function deleteNotificationApi(notificationId: number): Promise<{ deletedId: number }> {
  const res = await api.delete(`/notifications/${notificationId}`);
  return res.data.data;
}

const PLAYER_BOOKINGS_PATH = '/bookings';
const OWNER_BOOKINGS_PATH = '/owner/bookings';
const STAFF_BOOKINGS_PATH = '/staff/bookings';
const PLAYER_MATCHES_PATH = '/matches';
const LIST_PATHS = [
  PLAYER_BOOKINGS_PATH,
  OWNER_BOOKINGS_PATH,
  STAFF_BOOKINGS_PATH,
  PLAYER_MATCHES_PATH,
];

const BOOKING_TITLE_HINTS = /(đặt sân|đơn đặt|thanh toán|hoàn tiền|check-?in|no-?show|xác nhận lịch)/i;
const MATCH_TITLE_HINTS = /(kèo|cáp kèo|trận đấu|đủ quân|tham gia)/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeUserRole(userRole?: string | null): 'player' | 'owner' | 'staff' {
  const role = String(userRole || '').trim().toLowerCase();
  if (role === 'owner') return 'owner';
  if (role === 'staff') return 'staff';
  return 'player';
}

/**
 * Tách link đã lưu trong DB thành path + query params (bỏ qua link ngoài hệ thống).
 */
function parseLinkTarget(rawLink?: string | null): { path: string; params: URLSearchParams } | null {
  const value = String(rawLink || '').trim();
  if (!value) return null;
  try {
    if (value.startsWith('/')) {
      const [path, queryString = ''] = value.split('?');
      return { path, params: new URLSearchParams(queryString) };
    }
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      return { path: url.pathname, params: url.searchParams };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Xác định thông báo thuộc luồng nào (đơn đặt sân / cáp kèo / khác).
 * Thông báo cũ có type = 'SYSTEM' và link = NULL sẽ được suy luận từ tiêu đề.
 */
function detectNotificationKind(
  item: Pick<NotificationItem, 'link' | 'title' | 'type'>,
  linkPath: string,
  linkParams: URLSearchParams
): 'booking' | 'match' | 'other' {
  const type = String(item.type || 'SYSTEM').toUpperCase();
  if (type === 'BOOKING' || type === 'PAYMENT') return 'booking';
  if (type === 'MATCH') return 'match';

  const title = item.title || '';
  if (/#SPL-/i.test(title) || linkParams.has('bookingId')) return 'booking';
  if (
    /#M-/i.test(title) ||
    linkParams.has('matchId') ||
    linkPath === PLAYER_MATCHES_PATH ||
    linkPath.startsWith(`${PLAYER_MATCHES_PATH}/`)
  ) {
    return 'match';
  }
  if (BOOKING_TITLE_HINTS.test(title)) return 'booking';
  if (MATCH_TITLE_HINTS.test(title)) return 'match';
  return 'other';
}

/**
 * Chuẩn hóa đường dẫn điều hướng khi người dùng bấm vào thông báo.
 * - Luôn đưa tới đúng trang danh sách theo vai trò (Player / Owner / Staff).
 * - Kèm ?bookingId=...&date=... hoặc ?matchId=... để trang đích mở đúng bản ghi.
 * - Suy luận được cả thông báo cũ (type = 'SYSTEM', link = NULL) từ tiêu đề (#SPL-ID / #M-ID).
 */
export function resolveNotificationLink(
  item: Pick<NotificationItem, 'link' | 'title' | 'type'>,
  userRole?: string | null
): string | null {
  const role = normalizeUserRole(userRole);
  const parsedLink = parseLinkTarget(item.link);
  const linkPath = parsedLink?.path || '';
  const linkParams = parsedLink?.params || new URLSearchParams();
  const title = item.title || '';

  const bookingHome =
    role === 'owner'
      ? OWNER_BOOKINGS_PATH
      : role === 'staff'
        ? STAFF_BOOKINGS_PATH
        : PLAYER_BOOKINGS_PATH;

  const bookingIdFromTitle = title.match(/#SPL-(\d+)/i)?.[1];
  const matchIdFromTitle = title.match(/#M-(\d+)/i)?.[1];
  const bookingId = Number(linkParams.get('bookingId') || bookingIdFromTitle || 0);
  const matchId = Number(linkParams.get('matchId') || matchIdFromTitle || 0);
  const rawDate = linkParams.get('date') || '';
  const dateParam = ISO_DATE_PATTERN.test(rawDate) ? rawDate : '';

  const kind = detectNotificationKind(item, linkPath, linkParams);

  // Thông báo trỏ tới một trang cụ thể khác (tin tức, cài đặt, báo cáo...): giữ nguyên
  const isListRoute =
    LIST_PATHS.includes(linkPath) || linkPath.startsWith(`${PLAYER_MATCHES_PATH}/`);
  if (linkPath && !isListRoute && kind === 'other') {
    if (role === 'player' && (linkPath.startsWith('/owner') || linkPath.startsWith('/staff'))) {
      return null;
    }
    const qs = linkParams.toString();
    return qs ? `${linkPath}?${qs}` : linkPath;
  }

  if (kind === 'match') {
    // Chủ sân & nhân viên không có trang Cáp kèo trong khu vực quản trị
    if (role !== 'player') return null;
    const pathMatchId = Number(linkPath.match(/^\/matches\/(\d+)/)?.[1] || 0);
    const finalMatchId = matchId || pathMatchId;
    return finalMatchId ? `${PLAYER_MATCHES_PATH}?matchId=${finalMatchId}` : PLAYER_MATCHES_PATH;
  }

  if (kind === 'booking') {
    const params = new URLSearchParams();
    if (bookingId > 0) params.set('bookingId', String(bookingId));
    if (dateParam) params.set('date', dateParam);
    const qs = params.toString();
    return qs ? `${bookingHome}?${qs}` : bookingHome;
  }

  return null;
}
