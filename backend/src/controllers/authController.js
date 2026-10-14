const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findByEmailWithPassword, sanitizeEmployee } = require('../models/employeeModel');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Employee Login
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const trimmedEmail = email.trim().toLowerCase();
    const employee = await findByEmailWithPassword(trimmedEmail);

    if (!employee) {
      return sendError(res, 'Invalid email or password', 401);
    }

    if (employee.status !== 'active') {
      return sendError(res, 'Account is deactivated. Please contact administrator.', 401);
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, employee.password_hash);
    if (!isPasswordValid) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

    if (!jwtSecret) {
      console.error('[Auth Error] JWT_SECRET is not configured');
      return sendError(res, 'Server authentication configuration error', 500);
    }

    const payload = {
      id: employee.id,
      employee_code: employee.employee_code,
      email: employee.email
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

    // Return sanitized employee details (no password_hash)
    const sanitizedEmployee = sanitizeEmployee(employee);

    return sendSuccess(res, 'Login successful', {
      token,
      employee: sanitizedEmployee
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Employee Logout
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    return sendSuccess(res, 'Logged out successfully', null, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated employee identity
 * GET /api/v1/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, 'Current employee retrieved successfully', {
      employee: req.employee
    }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getMe
};
