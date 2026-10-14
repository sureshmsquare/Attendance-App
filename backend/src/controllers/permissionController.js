const {
  applyPermission,
  cancelPermission,
  getPermissionRequestsByEmployee,
  getPermissionRequestById
} = require('../services/permissionService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Apply for permission
 * POST /api/v1/permissions
 */
const applyPermissionController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const permissionDate = req.body.permissionDate || req.body.permission_date;
    const fromTime = req.body.fromTime || req.body.from_time;
    const toTime = req.body.toTime || req.body.to_time;
    const { reason } = req.body;

    const newRequest = await applyPermission(employeeId, {
      permissionDate,
      fromTime,
      toTime,
      reason
    });

    return sendSuccess(res, 'Permission request submitted successfully', newRequest, 201);
  } catch (error) {
    if (error.status) {
      return sendError(res, error.message, error.status);
    }
    next(error);
  }
};

/**
 * Get permission requests for employee
 * GET /api/v1/permissions
 */
const getPermissionHistoryController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { status, page, limit } = req.query;

    const result = await getPermissionRequestsByEmployee(employeeId, {
      status,
      page,
      limit
    });

    return sendSuccess(res, 'Permission requests retrieved successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get permission request details
 * GET /api/v1/permissions/:id
 */
const getPermissionDetailsController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const permissionId = parseInt(req.params.id, 10);

    if (isNaN(permissionId)) {
      return sendError(res, 'Invalid permission ID', 400);
    }

    const request = await getPermissionRequestById(permissionId, employeeId);
    if (!request) {
      return sendError(res, 'Permission request not found', 404);
    }

    return sendSuccess(res, 'Permission request details retrieved successfully', request, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a pending permission request
 * PATCH /api/v1/permissions/:id/cancel
 */
const cancelPermissionController = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const permissionId = parseInt(req.params.id, 10);

    if (isNaN(permissionId)) {
      return sendError(res, 'Invalid permission ID', 400);
    }

    const result = await cancelPermission(employeeId, permissionId);

    return sendSuccess(res, 'Permission request cancelled successfully', result, 200);
  } catch (error) {
    if (error.status) {
      return sendError(res, error.message, error.status);
    }
    next(error);
  }
};

module.exports = {
  applyPermissionController,
  getPermissionHistoryController,
  getPermissionDetailsController,
  cancelPermissionController
};
