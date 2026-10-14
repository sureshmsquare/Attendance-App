const express = require('express');
const router = express.Router();
const { getMyProfile, updateMyProfile } = require('../controllers/employeeController');
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/v1/employees/me
 * @desc    Get currently logged-in employee profile
 * @access  Private (JWT)
 */
router.get('/me', authenticate, getMyProfile);

/**
 * @route   PUT /api/v1/employees/me
 * @desc    Update currently logged-in employee profile (safe fields only)
 * @access  Private (JWT)
 */
router.put('/me', authenticate, updateMyProfile);

module.exports = router;
