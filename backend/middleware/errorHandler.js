const { logApplicationError } = require('../utils/errorLogger');

/**
 * Global error handler middleware
 * This middleware catches all unhandled errors and logs them to the database
 */
const errorHandler = (err, req, res, next) => {
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Log the error to database
  logApplicationError(err, req, req.user || null, statusCode).catch(logErr => {
    // If error logging fails, just log to console
    console.error('Failed to log error:', logErr);
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

