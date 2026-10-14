const { sendError } = require('../utils/response');

/**
 * 404 Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  return sendError(res, `Cannot ${req.method} ${req.originalUrl} - Route not found`, 404);
};

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  // Safe logging: avoid logging headers with tokens or sensitive payload
  console.error(`[Error ${err.status || 500}] ${err.message || 'Unknown error'}`);

  // Handle Payload Too Large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return sendError(res, 'Request body is too large. Maximum allowed size is 100kb.', 413);
  }

  // Handle JSON parse error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'Malformed JSON in request body', 400);
  }

  // Handle MySQL duplicate key violation (e.g. duplicate email or employee_code)
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'A record with this identifier already exists', 409);
  }

  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, mask internal server 500 errors to prevent leaking database or path details
  const message =
    isProduction && statusCode === 500
      ? 'Internal server error. Please try again later.'
      : err.message || 'Internal Server Error';

  return sendError(res, message, statusCode);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
