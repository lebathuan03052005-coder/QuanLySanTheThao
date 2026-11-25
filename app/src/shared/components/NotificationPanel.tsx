import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { formatNotificationTime } from '../utils/format';
import {
  resolveNotificationLink,
  type NotificationItem,
  type NotificationType,
} from '../../features/notifications/notification.api';

interface NotificationPanelProps {
  onClose?: () => void;
  variant?: 'light' | 'dark';
  className?: string;
}

function getTypeStyle(type: NotificationType, isDark: boolean) {
  switch (type) {
    case 'BOOKING':
      return {
        bg: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
            <path strokeWidth="2" strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        ),
      };
    case 'PAYMENT':
      return {
        bg: isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-600',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    case 'MATCH':
      return {
        bg: isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-600',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ),
      };
    case 'TEAM':
      return {
        bg: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        ),
      };
    default:
      return {
        bg: isDark ? 'bg-slate-600/40 text-slate-300' : 'bg-gray-100 text-gray-600',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        ),
      };
  }
}

export default function NotificationPanel({
  onClose,
  variant = 'light',
  className = '',
}: NotificationPanelProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification } =
    useNotificationStore();
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const isDark = variant === 'dark';
  const filteredList =
    filterMode === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  function handleItemClick(item: NotificationItem) {
    // Điều hướng ngay tới nơi phát sinh thông báo; việc đánh dấu đã đọc chạy nền
    const targetUrl = resolveNotificationLink(item, user?.role);
    onClose?.();
    if (!item.is_read) {
      void markAsRead(item.notification_id);
    }
    if (targetUrl) {
      navigate(targetUrl);
    }
  }

  return (
    <div
      className={`rounded-2xl shadow-2xl border overflow-hidden ${
        isDark
          ? 'bg-[#282a3c] border-slate-700/80 text-slate-100'
          : 'bg-white border-gray-100 text-gray-900'
      } ${className}`}
    >
      {/* Header */}
      <div
        className={`px-4 pt-3 pb-2.5 border-b ${
          isDark ? 'border-slate-700/60' : 'border-gray-100'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Thông báo</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className={`text-xs font-medium hover:underline cursor-pointer ${
                isDark ? 'text-blue-400' : 'text-blue-600'
              }`}
            >
              Đọc tất cả
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              filterMode === 'all'
                ? isDark
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-white'
                : isDark
                  ? 'text-slate-400 hover:bg-slate-700/60'
                  : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unread')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              filterMode === 'unread'
                ? isDark
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-white'
                : isDark
                  ? 'text-slate-400 hover:bg-slate-700/60'
                  : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>
      </div>

      {/* Body List */}
      <div
        className={`max-h-80 overflow-y-auto divide-y ${
          isDark ? 'divide-slate-700/50' : 'divide-gray-50'
        }`}
      >
        {loading && notifications.length === 0 ? (
          <div className={`p-6 text-center text-xs ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>
            Đang tải thông báo...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-6 text-center">
            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>
              {filterMode === 'unread'
                ? 'Không có thông báo chưa đọc.'
                : 'Bạn chưa có thông báo nào.'}
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const style = getTypeStyle(item.type, isDark);
            const targetUrl = resolveNotificationLink(item, user?.role);
            return (
              <div
                key={item.notification_id}
                onClick={() => handleItemClick(item)}
                title={targetUrl ? 'Bấm để mở nơi phát sinh thông báo' : undefined}
                className={`group relative p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                  !item.is_read
                    ? isDark
                      ? 'bg-blue-500/10 hover:bg-blue-500/15'
                      : 'bg-blue-50/50 hover:bg-blue-50'
                    : isDark
                      ? 'hover:bg-slate-700/40'
                      : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}
                >
                  {style.icon}
                </div>

                <div className="flex-1 min-w-0 pr-5">
                  <div className="flex items-center gap-1.5">
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <p
                      className={`text-xs leading-snug truncate ${
                        !item.is_read ? 'font-bold' : 'font-semibold'
                      } ${isDark ? 'text-slate-100' : 'text-gray-800'}`}
                    >
                      {item.title}
                    </p>
                  </div>
                  <p
                    className={`text-[11px] mt-0.5 line-clamp-2 ${
                      isDark ? 'text-slate-300' : 'text-gray-600'
                    }`}
                  >
                    {item.content}
                  </p>
                  <span
                    className={`text-[10px] mt-1 block ${
                      isDark ? 'text-slate-400' : 'text-gray-400'
                    }`}
                  >
                    {formatNotificationTime(item.seconds_ago, item.created_at)}
                  </span>
                </div>

                {/* Nút xóa thông báo */}
                <button
                  type="button"
                  title="Xóa thông báo"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(item.notification_id);
                  }}
                  className={`absolute top-2.5 right-2.5 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                    isDark
                      ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                      : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
