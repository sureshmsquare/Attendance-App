const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { generalLimiter } = require('./middlewares/rateLimiter');

const app = express();

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: false
}));

// CORS configuration - allow mobile and web clients in development
const corsOptions = {
  origin: process.env.CORS_ORIGIN || process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Skip-Rate-Limit'],
  credentials: true
};
app.use(cors(corsOptions));

// HTTP request logger
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsers with security size limit (100kb default)
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '100kb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Attendance Application API',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health'
    }
  });
});

// API versioning - Base API: /api/v1 with General Rate Limiting
app.use('/api/v1', generalLimiter, apiRoutes);

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
