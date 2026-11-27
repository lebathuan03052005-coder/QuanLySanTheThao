import * as notificationService from './notification.service.js';

export async function getMyNotifications(req, res, next) {
  try {
    const data = await notificationService.getUserNotifications(req.user.id, req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const updated = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'Đã đánh dấu thông báo đã đọc.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);
    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const result = await notificationService.deleteNotification(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'Đã xóa thông báo.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
