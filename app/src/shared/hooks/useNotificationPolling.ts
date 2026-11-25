import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * Hook tự động đồng bộ thông báo cho người dùng đã đăng nhập (polling mỗi 20s & khi focus tab).
 */
export function useNotificationPolling() {
  const { user, token } = useAuthStore();
  const { pollUnreadCount, reset, toastItem, dismissToast } = useNotificationStore();

  useEffect(() => {
    if (!token || !user) {
      reset();
      return;
    }

    pollUnreadCount();

    const intervalId = window.setInterval(() => {
      pollUnreadCount();
    }, 20_000);

    const handleFocus = () => {
      pollUnreadCount();
    };
    const handleRefreshEvent = () => {
      pollUnreadCount();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('sportlink:refresh-notifications', handleRefreshEvent);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('sportlink:refresh-notifications', handleRefreshEvent);
    };
  }, [token, user?.id, pollUnreadCount, reset]);

  useEffect(() => {
    if (!toastItem) return;
    const timer = window.setTimeout(() => {
      dismissToast();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toastItem, dismissToast]);
}
