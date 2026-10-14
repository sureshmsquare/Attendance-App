require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { testConnection } = require('./src/config/database');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const server = http.createServer(app);

const startServer = async () => {
  // Test MySQL Database Connection
  await testConnection();

  // Start HTTP Server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` Attendance API Server Running Successfully `);
    console.log(` Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(` Port        : ${PORT}`);
    console.log(` Local URL   : http://localhost:${PORT}`);
    console.log(` Health API  : http://localhost:${PORT}/api/v1/health`);
    console.log(`===============================================`);
  });
};

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown if taking too long
  setTimeout(() => {
    console.error('Forcing shutdown due to timeout.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
