const {
  checkOverlappingPermission,
  createPermissionRequest,
  getPermissionRequestsByEmployee,
  getPermissionRequestById,
  cancelPermissionRequest
} = require('../models/permissionModel');
const { isValidDateFormat } = require('../utils/time');
const {
  notifyPermissionApplied,
  notifyPermissionCancelled
} = require('./notificationService');

/**
 * Standardize time string into HH:mm:ss
 */
const standardizeTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;

  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/**
 * Calculate total minutes between two standardized HH:mm:ss times
 */
const calculateMinutes = (fromTime, toTime) => {
  const [inH, inM] = fromTime.split(':').map(Number);
  const [outH, outM] = toTime.split(':').map(Number);

  const startMinutes = inH * 60 + inM;
  const endMinutes = outH * 60 + outM;

  return endMinutes - startMinutes;
};

/**
 * Apply for a short permission request
 */
const applyPermission = async (employeeId, { permissionDate, fromTime, toTime, reason }) => {
  // 1. Validation
  if (!permissionDate || !isValidDateFormat(permissionDate)) {
    const err = new Error('Valid permissionDate (YYYY-MM-DD) is required');
    err.status = 400;
    throw err;
  }

  const stdFromTime = standardizeTime(fromTime);
  const stdToTime = standardizeTime(toTime);

  if (!stdFromTime || !stdToTime) {
    const err = new Error('Invalid time format. Expected HH:mm or HH:mm:ss (24-hour)');
    err.status = 400;
    throw err;
  }

  if (stdFromTime >= stdToTime) {
    const err = new Error('from_time must be strictly before to_time');
    err.status = 400;
    throw err;
  }

  // 2. Server-side calculate total minutes
  const totalMinutes = calculateMinutes(stdFromTime, stdToTime);
  if (totalMinutes <= 0) {
    const err = new Error('Permission duration must be greater than 0 minutes');
    err.status = 400;
    throw err;
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    const err = new Error('Reason for permission is required');
    err.status = 400;
    throw err;
  }

  const trimmedReason = reason.trim();

  // 3. Prevent overlapping active (pending or approved) permission requests on the same date
  const overlapping = await checkOverlappingPermission(employeeId, permissionDate, stdFromTime, stdToTime);
  if (overlapping && overlapping.length > 0) {
    const err = new Error('An active or pending permission request already overlaps with this time range');
    err.status = 409;
    err.conflicts = overlapping;
    throw err;
  }

  // 4. Create request
  const newRequest = await createPermissionRequest({
    employeeId,
    permissionDate,
    fromTime: stdFromTime,
    toTime: stdToTime,
    totalMinutes,
    reason: trimmedReason
  });

  try {
    await notifyPermissionApplied(employeeId, {
      permissionDate,
      fromTime: stdFromTime,
      toTime: stdToTime,
      totalMinutes,
      requestId: newRequest.id
    });
  } catch (err) {
    console.warn('[Permission Notification Warning]', err.message);
  }

  return newRequest;
};

/**
 * Cancel a pending permission request
 */
const cancelPermission = async (employeeId, permissionId) => {
  const request = await getPermissionRequestById(permissionId, employeeId);

  if (!request) {
    const err = new Error('Permission request not found');
    err.status = 404;
    throw err;
  }

  if (request.status === 'cancelled') {
    const err = new Error('Permission request is already cancelled');
    err.status = 400;
    throw err;
  }

  if (request.status === 'rejected') {
    const err = new Error('Cannot cancel a rejected permission request');
    err.status = 400;
    throw err;
  }

  if (request.status === 'approved') {
    const err = new Error('Cannot cancel an already approved permission request. Please contact HR/Admin.');
    err.status = 400;
    throw err;
  }

  if (request.status !== 'pending') {
    const err = new Error(`Cannot cancel permission request with status: ${request.status}`);
    err.status = 400;
    throw err;
  }

  await cancelPermissionRequest(permissionId, employeeId);

  try {
    await notifyPermissionCancelled(employeeId, {
      permissionDate: request.permission_date,
      requestId: permissionId
    });
  } catch (err) {
    console.warn('[Permission Notification Warning]', err.message);
  }

  return {
    id: permissionId,
    status: 'cancelled'
  };
};

module.exports = {
  standardizeTime,
  calculateMinutes,
  applyPermission,
  cancelPermission,
  getPermissionRequestsByEmployee,
  getPermissionRequestById
};
