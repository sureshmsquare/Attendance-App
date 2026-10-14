const express = require('express');
const router = express.Router();
const { login, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate employee and return JWT token
 * @access  Public
 */
router.post('/login', authLimiter, login);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout employee session
 * @access  Public / Client
 */
router.post('/logout', logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get currently authenticated employee
 * @access  Private (JWT)
 */
router.get('/me', authenticate, getMe);

module.exports = router;
