const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendanceApp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Function to test and verify database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Connected to MySQL database "${process.env.DB_NAME || 'attendanceApp'}" successfully.`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MySQL database: ${error.message}`);
    return false;
  }
};

module.exports = {
  pool,
  testConnection
};
