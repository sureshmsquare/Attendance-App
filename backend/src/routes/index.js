const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const employeeRoutes = require('./employeeRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const halfDayRoutes = require('./halfDayRoutes');
const permissionRoutes = require('./permissionRoutes');
const notificationRoutes = require('./notificationRoutes');

// Health Check Route
router.use('/health', healthRoutes);

// Phase 2 Routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);

// Phase 3 & 4 Routes
router.use('/attendance', attendanceRoutes);

// Phase 5 Routes
router.use('/leaves', leaveRoutes);
router.use('/half-days', halfDayRoutes);
router.use('/permissions', permissionRoutes);

// Phase 6 Routes
router.use('/notifications', notificationRoutes);

module.exports = router;
