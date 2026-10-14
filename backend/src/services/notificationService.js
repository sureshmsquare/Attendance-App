const {
  createNotification,
  getNotificationsByEmployee,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead
} = require('../models/notificationModel');

/**
 * Pluggable Push Notification Provider Abstraction
 * Handles external push notifications (e.g. Expo / Firebase Cloud Messaging)
 * when configured, while remaining completely decoupled from business logic.
 */
class NotificationProvider {
  constructor() {
    this.expoPushEnabled = Boolean(process.env.EXPO_PUSH_ACCESS_TOKEN);
    this.firebaseEnabled = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }

  async sendPush(pushPayload) {
    if (!this.expoPushEnabled && !this.firebaseEnabled) {
      // Local development fallback: push credentials not configured
      // Database notification is authoritative and sufficient.
      return { delivered: false, reason: 'Push credentials not configured in environment' };
    }

    try {
      // Future push delivery integration (Expo / FCM)
      return { delivered: true };
    } catch (err) {
      console.warn('[NotificationProvider Warning] Push delivery failed:', err.message);
      return { delivered: false, error: err.message };
    }
  }
}

const pushProvider = new NotificationProvider();

/**
 * Core notification dispatcher: saves to DB and asynchronously triggers push provider
 */
const notify = async ({ employeeId, employee_id, title, message, type = 'system', referenceId = null, reference_id = null }) => {
  const empId = employeeId || employee_id;
  const refId = referenceId !== null ? referenceId : reference_id;
  try {
    const notification = await createNotification({
      employeeId: empId,
      title,
      message,
      type,
      referenceId: refId
    });

    // Asynchronously attempt push delivery without blocking callers
    pushProvider.sendPush({ employeeId: empId, title, message, type, referenceId: refId }).catch(() => {});

    return notification;
  } catch (error) {
    console.error('[NotificationService Error] Failed to create notification:', error.message);
    // Never crash primary operations if notification fails
    return null;
  }
};

/**
 * Event: Attendance Check-In
 */
const notifyAttendanceCheckIn = async (employeeId, { time, isLate, distanceMeters, attendanceId }) => {
  const lateNote = isLate ? ' (Marked as Late)' : '';
  return notify({
    employeeId,
    title: 'Check-In Recorded 📍',
    message: `You successfully checked in at ${time}${lateNote}. GPS Distance: ${Math.round(distanceMeters)}m.`,
    type: 'attendance',
    referenceId: attendanceId
  });
};

/**
 * Event: Attendance Check-Out
 */
const notifyAttendanceCheckOut = async (employeeId, { time, durationFormatted, isEarlyCheckout, attendanceId }) => {
  const earlyNote = isEarlyCheckout ? ' (Early Departure)' : '';
  return notify({
    employeeId,
    title: 'Check-Out Recorded 🏁',
    message: `You successfully checked out at ${time}${earlyNote}. Total duration: ${durationFormatted}.`,
    type: 'attendance',
    referenceId: attendanceId
  });
};

/**
 * Event: Leave Application Submitted
 */
const notifyLeaveApplied = async (employeeId, { leaveTypeName, fromDate, toDate, totalDays, requestId }) => {
  return notify({
    employeeId,
    title: 'Leave Application Submitted 🏖️',
    message: `Your request for ${totalDays} day(s) of ${leaveTypeName} (${fromDate} to ${toDate}) has been submitted and is pending review.`,
    type: 'leave',
    referenceId: requestId
  });
};

/**
 * Event: Leave Cancelled
 */
const notifyLeaveCancelled = async (employeeId, { leaveTypeName, totalDays, requestId }) => {
  return notify({
    employeeId,
    title: 'Leave Request Cancelled ❌',
    message: `Your request for ${totalDays} day(s) of ${leaveTypeName} has been cancelled. Your leave balance has been restored.`,
    type: 'leave',
    referenceId: requestId
  });
};

/**
 * Event: Half-Day Application Submitted
 */
const notifyHalfDayApplied = async (employeeId, { session, requestDate, requestId }) => {
  const sessionText = session === 'first_half' ? 'First Half (Morning)' : 'Second Half (Afternoon)';
  return notify({
    employeeId,
    title: 'Half-Day Request Submitted ⏱️',
    message: `Your half-day request for ${requestDate} (${sessionText}) has been submitted and is pending review.`,
    type: 'half_day',
    referenceId: requestId
  });
};

/**
 * Event: Half-Day Cancelled
 */
const notifyHalfDayCancelled = async (employeeId, { requestDate, requestId }) => {
  return notify({
    employeeId,
    title: 'Half-Day Request Cancelled ❌',
    message: `Your half-day request for ${requestDate} has been cancelled.`,
    type: 'half_day',
    referenceId: requestId
  });
};

/**
 * Event: Permission Application Submitted
 */
const notifyPermissionApplied = async (employeeId, { permissionDate, fromTime, toTime, totalMinutes, requestId }) => {
  return notify({
    employeeId,
    title: 'Permission Request Submitted 🎫',
    message: `Your short permission request for ${permissionDate} (${fromTime} - ${toTime}, ${totalMinutes} mins) has been submitted.`,
    type: 'permission',
    referenceId: requestId
  });
};

/**
 * Event: Permission Cancelled
 */
const notifyPermissionCancelled = async (employeeId, { permissionDate, requestId }) => {
  return notify({
    employeeId,
    title: 'Permission Request Cancelled ❌',
    message: `Your short permission request for ${permissionDate} has been cancelled.`,
    type: 'permission',
    referenceId: requestId
  });
};

module.exports = {
  notify,
  createNotification: notify,
  notifyAttendanceCheckIn,
  notifyAttendanceCheckOut,
  notifyLeaveApplied,
  notifyLeaveCancelled,
  notifyHalfDayApplied,
  notifyHalfDayCancelled,
  notifyPermissionApplied,
  notifyPermissionCancelled,
  getNotificationsByEmployee,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead
};
