/**
 * Định dạng số tiền theo đơn vị VNĐ.
 * @param amount - Số tiền cần định dạng
 * @returns Chuỗi định dạng, ví dụ: "150.000 ₫"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Định dạng ngày giờ theo kiểu Việt Nam.
 * @param date - Ngày cần định dạng
 * @param includeTime - Có hiển thị giờ phút không (mặc định true)
 * @returns Chuỗi, ví dụ: "29/10/2026 17:00"
 */
export function formatDate(date: string | Date, includeTime = true): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  }).format(parsed);
}

/**
 * Tính số giờ giữa hai mốc thời gian.
 * @returns Số giờ (float), ví dụ: 1.5
 */
export function calcDurationHours(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

/**
 * Định dạng thời gian tương đối thân thiện cho thông báo (VD: "Vừa xong", "5 phút trước").
 */
export function formatNotificationTime(secondsAgo?: number, fallbackDate?: string | Date): string {
  if (typeof secondsAgo === 'number' && !Number.isNaN(secondsAgo)) {
    const s = Math.max(0, Math.floor(secondsAgo));
    if (s < 60) return 'Vừa xong';
    const mins = Math.floor(s / 60);
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
  }
  return fallbackDate ? formatDate(fallbackDate, true) : '';
}
