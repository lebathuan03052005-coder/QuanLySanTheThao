import { create } from 'zustand';
import {
  deleteNotificationApi,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from '../../features/notifications/notification.api';

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
  loading: boolean;
  initialized: boolean;
  toastItem: NotificationItem | null;

  loadNotifications: (opts?: { unreadOnly?: boolean }) => Promise<void>;
  pollUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (notificationId: number) => Promise<void>;
  dismissToast: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  loading: false,
  initialized: false,
  toastItem: null,

  loadNotifications: async (opts) => {
    set({ loading: true });
    try {
      const res = await fetchNotifications({
        page: 1,
        limit: 25,
        unreadOnly: opts?.unreadOnly,
      });
      set({
        notifications: res.items || [],
        unreadCount: Number(res.unreadCount || 0),
        total: Number(res.total || 0),
        loading: false,
        initialized: true,
      });
    } catch {
      set({ loading: false });
    }
  },

  pollUnreadCount: async () => {
    try {
      const prevCount = get().unreadCount;
      const wasInitialized = get().initialized;
      const latestCount = await fetchUnreadNotificationCount();

      if (!wasInitialized || latestCount > prevCount) {
        const res = await fetchNotifications({ page: 1, limit: 25 });
        const items = res.items || [];
        const newestUnread = items.find((n) => !n.is_read) || null;
        set({
          notifications: items,
          unreadCount: Number(res.unreadCount || 0),
          total: Number(res.total || 0),
          initialized: true,
          ...(wasInitialized && latestCount > prevCount && newestUnread
            ? { toastItem: newestUnread }
            : {}),
        });
      } else if (latestCount !== prevCount) {
        set({ unreadCount: latestCount });
      }
    } catch {
      // Bỏ qua lỗi mạng khi polling ngầm
    }
  },

  markAsRead: async (notificationId: number) => {
    const target = get().notifications.find((n) => n.notification_id === notificationId);
    if (target && !target.is_read) {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    }
    try {
      await markNotificationAsRead(notificationId);
    } catch {
      await get().loadNotifications();
    }
  },

  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    try {
      await markAllNotificationsAsRead();
    } catch {
      await get().loadNotifications();
    }
  },

  removeNotification: async (notificationId: number) => {
    const target = get().notifications.find((n) => n.notification_id === notificationId);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.notification_id !== notificationId),
      total: Math.max(0, state.total - 1),
      unreadCount: target && !target.is_read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
    try {
      await deleteNotificationApi(notificationId);
    } catch {
      await get().loadNotifications();
    }
  },

  dismissToast: () => set({ toastItem: null }),

  reset: () =>
    set({
      notifications: [],
      unreadCount: 0,
      total: 0,
      loading: false,
      initialized: false,
      toastItem: null,
    }),
}));
