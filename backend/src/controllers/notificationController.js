const {
  getNotificationsByEmployee,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead
} = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get paginated notifications for authenticated employee
 * GET /api/v1/notifications
 */
const getNotificationsController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { isRead, page, limit } = req.query;

    const parsedIsRead =
      isRead === 'true' ? true : isRead === 'false' ? false : null;

    const result = await getNotificationsByEmployee(employeeId, {
      isRead: parsedIsRead,
      page,
      limit
    });

    const unreadCount = await getUnreadCount(employeeId);

    return sendSuccess(res, 'Notifications retrieved successfully', {
      ...result,
      notifications: result.records,
      unreadCount
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 * GET /api/v1/notifications/unread-count
 */
const getUnreadCountController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const count = await getUnreadCount(employeeId);

    return sendSuccess(res, 'Unread notification count retrieved', {
      unreadCount: count
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 * PATCH /api/v1/notifications/:id/read
 */
const markAsReadController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId)) {
      return sendError(res, 'Invalid notification ID', 400);
    }

    const notification = await getNotificationById(notificationId, employeeId);
    if (!notification) {
      return sendError(res, 'Notification not found or access denied', 404);
    }

    await markAsRead(notificationId, employeeId);

    return sendSuccess(res, 'Notification marked as read', {
      id: notificationId,
      is_read: true
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for authenticated employee
 * PATCH /api/v1/notifications/read-all
 */
const markAllAsReadController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const updatedRows = await markAllAsRead(employeeId);

    return sendSuccess(res, 'All notifications marked as read', {
      markedCount: updatedRows
    }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotificationsController,
  getUnreadCountController,
  markAsReadController,
  markAllAsReadController
};
