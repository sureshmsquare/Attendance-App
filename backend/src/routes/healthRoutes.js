const express = require('express');
const router = express.Router();
const { getHealth } = require('../controllers/healthController');

/**
 * @route   GET /api/v1/health
 * @desc    Get API health status and database connectivity
 * @access  Public
 */
router.get('/', getHealth);

module.exports = router;
