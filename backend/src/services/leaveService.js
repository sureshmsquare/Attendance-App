const { pool } = require('../config/database');
const {
  getActiveLeaveTypes,
  getLeaveTypeById,
  getEmployeeBalances,
  getEmployeeBalanceByType,
  adjustLeaveBalance,
  checkOverlappingLeave,
  createLeaveRequest,
  getLeaveRequestsByEmployee,
  getLeaveRequestById,
  cancelLeaveRequest
} = require('../models/leaveModel');
const { isValidDateFormat } = require('../utils/time');
const {
  notifyLeaveApplied,
  notifyLeaveCancelled
} = require('./notificationService');

/**
 * Calculate total calendar days between two dates inclusive
 * @param {string} fromDate e.g. "2026-10-05"
 * @param {string} toDate e.g. "2026-10-07"
 * @returns {number}
 */
const calculateLeaveDays = (fromDate, toDate) => {
  const d1 = new Date(`${fromDate}T00:00:00Z`);
  const d2 = new Date(`${toDate}T00:00:00Z`);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
};

/**
 * Apply for a leave request
 */
const applyLeave = async (employeeId, { leaveTypeId, fromDate, toDate, reason }) => {
  // 1. Basic validation
  if (!leaveTypeId) {
    const err = new Error('Leave type is required');
    err.status = 400;
    throw err;
  }

  if (!fromDate || !isValidDateFormat(fromDate)) {
    const err = new Error('Valid fromDate (YYYY-MM-DD) is required');
    err.status = 400;
    throw err;
  }

  if (!toDate || !isValidDateFormat(toDate)) {
    const err = new Error('Valid toDate (YYYY-MM-DD) is required');
    err.status = 400;
    throw err;
  }

  if (fromDate > toDate) {
    const err = new Error('fromDate cannot be after toDate');
    err.status = 400;
    throw err;
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    const err = new Error('Reason for leave is required');
    err.status = 400;
    throw err;
  }

  const trimmedReason = reason.trim();

  // 2. Validate leave type
  const leaveType = await getLeaveTypeById(leaveTypeId);
  if (!leaveType || leaveType.status !== 'active') {
    const err = new Error('Invalid or inactive leave type');
    err.status = 400;
    throw err;
  }

  // 3. Server-side calculate total days (do NOT trust mobile)
  const totalDays = calculateLeaveDays(fromDate, toDate);
  if (totalDays <= 0) {
    const err = new Error('Calculated leave duration must be at least 1 day');
    err.status = 400;
    throw err;
  }

  // 4. Check for overlapping active leave requests (pending or approved)
  const overlapping = await checkOverlappingLeave(employeeId, fromDate, toDate);
  if (overlapping && overlapping.length > 0) {
    const err = new Error('An active or pending leave request already exists for this date range');
    err.status = 409;
    err.conflicts = overlapping;
    throw err;
  }

  // 5. Check leave balance for the year of fromDate
  const leaveYear = parseInt(fromDate.split('-')[0], 10);

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const balance = await getEmployeeBalanceByType(employeeId, leaveTypeId, leaveYear, connection);
    if (!balance) {
      const err = new Error(`No leave balance found for ${leaveType.name} in year ${leaveYear}`);
      err.status = 400;
      throw err;
    }

    const remaining = parseFloat(balance.remaining_days);
    if (remaining < totalDays) {
      const err = new Error(
        `Insufficient leave balance for ${leaveType.name}. Requested: ${totalDays} day(s), Available: ${remaining} day(s)`
      );
      err.status = 400;
      throw err;
    }

    // 6. Create leave request
    const newRequest = await createLeaveRequest(
      {
        employeeId,
        leaveTypeId,
        fromDate,
        toDate,
        totalDays,
        reason: trimmedReason
      },
      connection
    );

    // 7. Update leave balance: move days from remaining to pending
    await adjustLeaveBalance(
      {
        employeeId,
        leaveTypeId,
        year: leaveYear,
        pendingDelta: totalDays,
        remainingDelta: -totalDays,
        usedDelta: 0
      },
      connection
    );

    await connection.commit();

    try {
      await notifyLeaveApplied(employeeId, {
        leaveTypeName: leaveType.name,
        fromDate,
        toDate,
        totalDays,
        requestId: newRequest.id
      });
    } catch (err) {
      console.warn('[Leave Notification Warning]', err.message);
    }

    return newRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Cancel a pending leave request
 */
const cancelLeave = async (employeeId, leaveRequestId) => {
  const leaveRequest = await getLeaveRequestById(leaveRequestId, employeeId);

  if (!leaveRequest) {
    const err = new Error('Leave request not found');
    err.status = 404;
    throw err;
  }

  if (leaveRequest.status === 'cancelled') {
    const err = new Error('Leave request is already cancelled');
    err.status = 400;
    throw err;
  }

  if (leaveRequest.status === 'rejected') {
    const err = new Error('Cannot cancel a rejected leave request');
    err.status = 400;
    throw err;
  }

  if (leaveRequest.status === 'approved') {
    const err = new Error('Cannot cancel an already approved leave request. Please contact HR/Admin.');
    err.status = 400;
    throw err;
  }

  if (leaveRequest.status !== 'pending') {
    const err = new Error(`Cannot cancel leave request with status: ${leaveRequest.status}`);
    err.status = 400;
    throw err;
  }

  const leaveYear = leaveRequest.from_date instanceof Date
    ? leaveRequest.from_date.getFullYear()
    : parseInt(String(leaveRequest.from_date).slice(0, 4), 10);
  const totalDays = leaveRequest.total_days;

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    await cancelLeaveRequest(leaveRequestId, employeeId, connection);

    // Restore leave balance: decrease pending, restore remaining
    await adjustLeaveBalance(
      {
        employeeId,
        leaveTypeId: leaveRequest.leave_type_id,
        year: leaveYear,
        pendingDelta: -totalDays,
        remainingDelta: totalDays,
        usedDelta: 0
      },
      connection
    );

    await connection.commit();

    try {
      await notifyLeaveCancelled(employeeId, {
        leaveTypeName: leaveRequest.leave_type_name || 'Leave',
        totalDays,
        requestId: leaveRequestId
      });
    } catch (err) {
      console.warn('[Leave Notification Warning]', err.message);
    }

    return {
      id: leaveRequestId,
      status: 'cancelled',
      restoredDays: totalDays
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  calculateLeaveDays,
  applyLeave,
  cancelLeave,
  getActiveLeaveTypes,
  getEmployeeBalances,
  getLeaveRequestsByEmployee,
  getLeaveRequestById
};
