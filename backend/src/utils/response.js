/**
 * Standardized API Response Helpers
 */

const sendSuccess = (res, message = 'Success', data = null, statusCode = 200) => {
  const payload = {
    success: true,
    message
  };

  if (data !== null && data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const payload = {
    success: false,
    message
  };

  if (errors !== null && errors !== undefined) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError
};
