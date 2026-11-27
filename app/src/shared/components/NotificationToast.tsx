import { useNavigate } from 'react-router';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useNotificationPolling } from '../hooks/useNotificationPolling';
import { resolveNotificationLink } from '../../features/notifications/notification.api';

/**
 * Component hiển thị Toast thông báo nổi ở góc dưới bên phải khi có thông báo mới đến.
 * Đồng thời kích hoạt polling đồng bộ thông báo toàn cục khi người dùng đang đăng nhập.
 */
export default function NotificationToast() {
  useNotificationPolling();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toastItem, dismissToast, markAsRead } = useNotificationStore();

  if (!toastItem) return null;

  function handleClick() {
    if (!toastItem) return;
    const targetUrl = resolveNotificationLink(toastItem, user?.role);
    const notificationId = toastItem.notification_id;
    const isUnread = !toastItem.is_read;
    dismissToast();
    if (isUnread) {
      void markAsRead(notificationId);
    }
    if (targetUrl) {
      navigate(targetUrl);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] max-w-sm w-full sm:w-80 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div
        onClick={handleClick}
        className="bg-white border border-blue-100 rounded-2xl shadow-2xl p-3.5 flex items-start gap-3 cursor-pointer hover:border-blue-300 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900 truncate">{toastItem.title}</p>
          <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{toastItem.content}</p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissToast();
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-md shrink-0 cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
