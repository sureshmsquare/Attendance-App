const jwt = require('jsonwebtoken');
const { findById } = require('../models/employeeModel');
const { sendError } = require('../utils/response');

/**
 * Authentication Middleware
 * Protects endpoints by verifying JWT Bearer token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token missing or invalid format', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Authentication token required', 401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth Error] JWT_SECRET is not configured in environment variables');
      return sendError(res, 'Internal server authentication error', 500);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return sendError(res, 'Session expired. Please log in again.', 401);
      }
      return sendError(res, 'Invalid authentication token', 401);
    }

    if (!decoded || !decoded.id) {
      return sendError(res, 'Malformed authentication token', 401);
    }

    // Verify employee still exists and is active
    const employee = await findById(decoded.id);
    if (!employee) {
      return sendError(res, 'User account no longer exists', 401);
    }

    if (employee.status !== 'active') {
      return sendError(res, 'Account is deactivated. Please contact administrator.', 401);
    }

    // Attach sanitized employee info to request
    req.employee = employee;
    req.user = employee;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return sendError(res, 'Authentication verification failed', 500);
  }
};

module.exports = {
  authenticate
};
