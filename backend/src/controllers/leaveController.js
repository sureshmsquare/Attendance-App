const {
  applyLeave,
  cancelLeave,
  getActiveLeaveTypes,
  getEmployeeBalances,
  getLeaveRequestsByEmployee,
  getLeaveRequestById
} = require('../services/leaveService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Apply for leave
 * POST /api/v1/leaves
 */
const applyLeaveController = async (req, res, next) => {
  try {
    // Strictly retrieve employeeId from authenticated JWT
    const employeeId = req.employee.id;
    const { leaveTypeId, fromDate, toDate, reason } = req.body;

    const newLeave = await applyLeave(employeeId, {
      leaveTypeId,
      fromDate,
      toDate,
      reason
    });

    return sendSuccess(res, 'Leave application submitted successfully', newLeave, 201);
  } catch (error) {
    if (error.status) {
      return sendError(res, error.message, error.status, error.conflicts || null);
    }
    next(error);
  }
};

/**
 * Get employee leave history
 * GET /api/v1/leaves
 */
const getLeaveHistoryController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { status, year, page, limit } = req.query;

    const result = await getLeaveRequestsByEmployee(employeeId, {
      status,
      year,
      page,
      limit
    });

    return sendSuccess(res, 'Leave requests retrieved successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get employee leave balances for a year
 * GET /api/v1/leaves/balance
 */
const getLeaveBalanceController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const currentYear = new Date().getFullYear();
    const year = parseInt(req.query.year, 10) || currentYear;

    const balances = await getEmployeeBalances(employeeId, year);

    return sendSuccess(res, 'Leave balances retrieved successfully', {
      year,
      balances
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get active leave types for selection
 * GET /api/v1/leaves/types
 */
const getLeaveTypesController = async (req, res, next) => {
  try {
    const leaveTypes = await getActiveLeaveTypes();
    return sendSuccess(res, 'Active leave types retrieved successfully', leaveTypes, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single leave request details
 * GET /api/v1/leaves/:id
 */
const getLeaveDetailsController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const leaveId = parseInt(req.params.id, 10);

    if (isNaN(leaveId)) {
      return sendError(res, 'Invalid leave ID', 400);
    }

    const leave = await getLeaveRequestById(leaveId, employeeId);
    if (!leave) {
      return sendError(res, 'Leave request not found', 404);
    }

    return sendSuccess(res, 'Leave request details retrieved successfully', leave, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a pending leave request
 * PATCH /api/v1/leaves/:id/cancel
 */
const cancelLeaveController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const leaveId = parseInt(req.params.id, 10);

    if (isNaN(leaveId)) {
      return sendError(res, 'Invalid leave ID', 400);
    }

    const result = await cancelLeave(employeeId, leaveId);

    return sendSuccess(res, 'Leave request cancelled successfully', result, 200);
  } catch (error) {
    if (error.status) {
      return sendError(res, error.message, error.status);
    }
    next(error);
  }
};

module.exports = {
  applyLeaveController,
  getLeaveHistoryController,
  getLeaveBalanceController,
  getLeaveTypesController,
  getLeaveDetailsController,
  cancelLeaveController
};
