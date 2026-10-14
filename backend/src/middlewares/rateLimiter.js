const { sendError } = require('../utils/response');

/**
 * In-Memory Sliding-Window Rate Limiter
 * Lightweight, zero-dependency, and fully production-safe for single-instance Node.js backends.
 */
const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100,
  message = 'Too many requests from this IP, please try again later.'
}) => {
  const ipRequests = new Map();

  // Periodically cleanup expired IP windows (every 5 minutes)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
      const active = timestamps.filter((time) => now - time < windowMs);
      if (active.length === 0) {
        ipRequests.delete(ip);
      } else {
        ipRequests.set(ip, active);
      }
    }
  }, 5 * 60 * 1000);

  // Unref timer so it does not keep node process open
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const limiterMiddleware = (req, res, next) => {
    // Skip if test flag explicitly disables rate limiting (for integration tests when needed)
    if (req.headers['x-skip-rate-limit'] === 'true' && process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const timestamps = ipRequests.get(ip) || [];
    const activeTimestamps = timestamps.filter((time) => now - time < windowMs);

    // Add current request timestamp
    activeTimestamps.push(now);
    ipRequests.set(ip, activeTimestamps);

    const remaining = Math.max(0, max - activeTimestamps.length);
    const resetTimeSeconds = Math.ceil((windowMs - (now - activeTimestamps[0])) / 1000);

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (activeTimestamps.length > max) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return sendError(res, message, 429);
    }

    next();
  };

  limiterMiddleware.reset = () => {
    ipRequests.clear();
  };

  return limiterMiddleware;
};

// 1. Strict Auth Limiter for sensitive login endpoints (15 attempts / 15 mins by default)
const authLimiter = createRateLimiter({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 15,
  message: 'Too many login attempts. Please try again after 15 minutes.'
});

// 2. General API Limiter for abuse prevention (500 requests / 15 mins by default)
const generalLimiter = createRateLimiter({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 500,
  message: 'API rate limit exceeded. Please throttle your requests.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  generalLimiter
};
