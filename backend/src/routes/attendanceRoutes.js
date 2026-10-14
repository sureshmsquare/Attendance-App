const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getMonthlyAttendance,
  getAttendanceSummary
} = require('../controllers/attendanceController');
const { authenticate } = require('../middlewares/authMiddleware');

/**
 * @route   POST /api/v1/attendance/check-in
 * @desc    Record employee check-in within 10m radius
 * @access  Private (JWT)
 */
router.post('/check-in', authenticate, checkIn);

/**
 * @route   POST /api/v1/attendance/check-out
 * @desc    Record employee check-out within 10m radius
 * @access  Private (JWT)
 */
router.post('/check-out', authenticate, checkOut);

/**
 * @route   GET /api/v1/attendance/today
 * @desc    Get employee's attendance status for today
 * @access  Private (JWT)
 */
router.get('/today', authenticate, getTodayAttendance);

/**
 * @route   GET /api/v1/attendance/history
 * @desc    Get employee's attendance history with date/status filters and pagination
 * @access  Private (JWT)
 */
router.get('/history', authenticate, getAttendanceHistory);

/**
 * @route   GET /api/v1/attendance/monthly
 * @desc    Get employee's attendance records and summary for a specific month
 * @access  Private (JWT)
 */
router.get('/monthly', authenticate, getMonthlyAttendance);

/**
 * @route   GET /api/v1/attendance/summary
 * @desc    Get employee's attendance summary statistics
 * @access  Private (JWT)
 */
router.get('/summary', authenticate, getAttendanceSummary);

module.exports = router;
