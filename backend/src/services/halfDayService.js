const {
  checkActiveHalfDayDuplicate,
  createHalfDayRequest,
  getHalfDayRequestsByEmployee,
  getHalfDayRequestById,
  cancelHalfDayRequest
} = require('../models/halfDayModel');
const { isValidDateFormat } = require('../utils/time');
const {
  notifyHalfDayApplied,
  notifyHalfDayCancelled
} = require('./notificationService');

const ALLOWED_SESSIONS = ['first_half', 'second_half'];

/**
 * Apply for a half-day request
 */
const applyHalfDay = async (employeeId, { requestDate, session, reason }) => {
  // 1. Validation
  if (!requestDate || !isValidDateFormat(requestDate)) {
    const err = new Error('Valid requestDate (YYYY-MM-DD) is required');
    err.status = 400;
    throw err;
  }

  if (!session || !ALLOWED_SESSIONS.includes(session)) {
    const err = new Error("Session must be either 'first_half' or 'second_half'");
    err.status = 400;
    throw err;
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    const err = new Error('Reason for half-day is required');
    err.status = 400;
    throw err;
  }

  const trimmedReason = reason.trim();

  // 2. Prevent duplicate active (pending or approved) half-day request for same employee/date/session
  const existingActive = await checkActiveHalfDayDuplicate(employeeId, requestDate, session);
  if (existingActive) {
    const err = new Error(
      `An active half-day request already exists for ${requestDate} (${session}) with status: ${existingActive.status}`
    );
    err.status = 409;
    throw err;
  }

  // 3. Create request
  const newRequest = await createHalfDayRequest({
    employeeId,
    requestDate,
    session,
    reason: trimmedReason
  });

  try {
    await notifyHalfDayApplied(employeeId, {
      session,
      requestDate,
      requestId: newRequest.id
    });
  } catch (err) {
    console.warn('[Half-Day Notification Warning]', err.message);
  }

  return newRequest;
};

/**
 * Cancel a pending half-day request
 */
const cancelHalfDay = async (employeeId, halfDayId) => {
  const request = await getHalfDayRequestById(halfDayId, employeeId);

  if (!request) {
    const err = new Error('Half-day request not found');
    err.status = 404;
    throw err;
  }

  if (request.status === 'cancelled') {
    const err = new Error('Half-day request is already cancelled');
    err.status = 400;
    throw err;
  }

  if (request.status === 'rejected') {
    const err = new Error('Cannot cancel a rejected half-day request');
    err.status = 400;
    throw err;
  }

  if (request.status === 'approved') {
    const err = new Error('Cannot cancel an already approved half-day request. Please contact HR/Admin.');
    err.status = 400;
    throw err;
  }

  if (request.status !== 'pending') {
    const err = new Error(`Cannot cancel half-day request with status: ${request.status}`);
    err.status = 400;
    throw err;
  }

  await cancelHalfDayRequest(halfDayId, employeeId);

  try {
    await notifyHalfDayCancelled(employeeId, {
      requestDate: request.request_date,
      requestId: halfDayId
    });
  } catch (err) {
    console.warn('[Half-Day Notification Warning]', err.message);
  }

  return {
    id: halfDayId,
    status: 'cancelled'
  };
};

module.exports = {
  applyHalfDay,
  cancelHalfDay,
  getHalfDayRequestsByEmployee,
  getHalfDayRequestById
};
