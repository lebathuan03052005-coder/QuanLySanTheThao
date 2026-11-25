/**
 * SPORTLINK - MEDIA & IMAGE UTILITIES
 * Chuẩn hóa xử lý chuỗi ảnh, mảng ảnh JSON và đường dẫn ảnh tải lên từ backend.
 */

/**
 * Trợ giúp phân tích chuỗi images thành mảng URL sạch.
 * Hỗ trợ:
 * - Mảng JSON: '["/uploads/facilities/1.jpg", "/uploads/facilities/2.jpg"]'
 * - Chuỗi phân cách dấu phẩy: '/path/1.jpg, /path/2.jpg'
 * - Mảng string: ['/path/1.jpg']
 * - Chuỗi đơn lẻ: '/path/1.jpg'
 */
export function parseImages(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);

  const trimmed = String(raw).trim();
  if (!trimmed) return [];

  // Trường hợp chuỗi mảng JSON
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // Bỏ qua lỗi parse, thử tiếp split phẩy
    }
  }

  // Trường hợp phân cách dấu phẩy
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Chuẩn hóa URL ảnh (hỗ trợ cả ảnh tĩnh public và ảnh upload từ backend).
 */
export function getMediaUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    const backendBase = (
      import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
    ).replace(/\/api\/?$/, '');
    return `${backendBase}${trimmed}`;
  }

  return trimmed;
}

/**
 * Lấy URL ảnh đầu tiên từ chuỗi/mảng bất kỳ, đã được chuẩn hóa qua getMediaUrl.
 */
export function getFirstMediaUrl(
  raw?: string | string[] | null,
  fallback = '/nenHomePage.png'
): string {
  const list = parseImages(raw);
  if (list.length > 0 && list[0]) {
    return getMediaUrl(list[0]);
  }
  return fallback;
}
