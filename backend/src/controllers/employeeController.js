const { updateProfile } = require('../models/employeeModel');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get Authenticated Employee Profile
 * GET /api/v1/employees/me
 */
const getMyProfile = async (req, res, next) => {
  try {
    // req.employee is attached by authenticate middleware and already sanitized
    return sendSuccess(res, 'Employee profile fetched successfully', {
      employee: req.employee
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Update Authenticated Employee Profile
 * PUT /api/v1/employees/me
 * Only safe fields: first_name, last_name, phone, profile_image
 * Strictly forbids updating: employee_code, email, password, status, id
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const { employee_code, email, password, password_hash, status, id, ...allowedUpdates } = req.body;

    // Detect if user attempted to modify restricted fields
    if (employee_code !== undefined || email !== undefined || password !== undefined || password_hash !== undefined || status !== undefined || id !== undefined) {
      return sendError(res, 'Cannot modify restricted fields (employee_code, email, password, status)', 400);
    }

    const { first_name, last_name, phone, profile_image } = allowedUpdates;

    // Validation
    if (first_name !== undefined && (!first_name || !first_name.trim())) {
      return sendError(res, 'First name cannot be empty', 400);
    }
    if (last_name !== undefined && (!last_name || !last_name.trim())) {
      return sendError(res, 'Last name cannot be empty', 400);
    }
    if (phone !== undefined && phone !== null && phone.trim().length > 20) {
      return sendError(res, 'Phone number cannot exceed 20 characters', 400);
    }

    const updatedEmployee = await updateProfile(req.employee.id, {
      first_name,
      last_name,
      phone,
      profile_image
    });

    return sendSuccess(res, 'Profile updated successfully', {
      employee: updatedEmployee
    }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile
};
