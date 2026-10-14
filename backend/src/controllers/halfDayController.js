const {
  applyHalfDay,
  cancelHalfDay,
  getHalfDayRequestsByEmployee,
  getHalfDayRequestById
} = require('../services/halfDayService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Apply for half-day
 * POST /api/v1/half-days
 */
const applyHalfDayController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const requestDate = req.body.requestDate || req.body.halfDayDate || req.body.request_date;
    const { session, reason } = req.body;

    const newRequest = await applyHalfDay(employeeId, {
      requestDate,
      session,
      reason
    });

    return sendSuccess(res, 'Half-day request submitted successfully', newRequest, 201);
  } catch (error) {
    if (error.status) {
      return sendError(res, error.message, error.status);
    }
    next(error);
  }
};

/**
 * Get half-day requests for employee
 * GET /api/v1/half-days
 */
const getHalfDayHistoryController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { status, page, limit } = req.query;

    const result = await getHalfDayRequestsByEmployee(employeeId, {
      status,
      page,
      limit
    });

    return sendSuccess(res, 'Half-day requests retrieved successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get half-day request details
 * GET /api/v1/half-days/:id
 */
const getHalfDayDetailsController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const halfDayId = parseInt(req.params.id, 10);

    if (isNaN(halfDayId)) {
      return sendError(res, 'Invalid half-day ID', 400);
    }

    const request = await getHalfDayRequestById(halfDayId, employeeId);
    if (!request) {
      return sendError(res, 'Half-day request not found', 404);
    }

    return sendSuccess(res, 'Half-day request details retrieved successfully', request, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a pending half-day request
 * PATCH /api/v1/half-days/:id/cancel
 */
const cancelHalfDayController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const halfDayId = parseInt(req.params.id, 10);

    if (isNaN(halfDayId)) {
      return sendError(res, 'Invalid half-day ID', 400);
    }

    const result = await cancelHalfDay(employeeId, halfDayId);

    return sendSuccess(res, 'Half-day request cancelled successfully', result, 200);
  } catch (error) {
    if (error.status) {
      return sendError(res, error.message, error.status);
    }
    next(error);
  }
};

module.exports = {
  applyHalfDayController,
  getHalfDayHistoryController,
  getHalfDayDetailsController,
  cancelHalfDayController
};
