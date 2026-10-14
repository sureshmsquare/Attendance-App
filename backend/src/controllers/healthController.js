const { pool } = require('../config/database');

/**
 * Health check controller
 * Checks backend API status and database connectivity
 */
const getHealth = async (req, res, next) => {
  try {
    let dbStatus = 'disconnected';
    try {
      const [rows] = await pool.query('SELECT 1 AS status');
      if (rows && rows.length > 0) {
        dbStatus = 'connected';
      }
    } catch (dbErr) {
      console.warn('[Database Health Warning]:', dbErr.message);
      dbStatus = 'error: ' + dbErr.message;
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance API is running',
      data: {
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        version: 'v1'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth
};
