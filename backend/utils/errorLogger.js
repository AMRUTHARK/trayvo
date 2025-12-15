const pool = require('../config/database');
const { getClientIp } = require('./deviceInfo');

/**
 * Log an error to the error_logs table
 * 
 * @param {Object} errorInfo - Error information object
 * @param {string} errorInfo.error_type - Type of error (e.g., 'authentication', 'database', 'validation')
 * @param {string} errorInfo.error_level - Error level ('error', 'warning', 'critical', 'info')
 * @param {string} errorInfo.error_message - Error message
 * @param {string} errorInfo.error_stack - Error stack trace (optional)
 * @param {Object} errorInfo.request - Express request object (optional)
 * @param {number} errorInfo.status_code - HTTP status code (optional)
 * @param {number} errorInfo.response_time_ms - Response time in milliseconds (optional)
 * @param {Object} errorInfo.user - User object with id and shop_id (optional)
 * @param {string} errorInfo.notes - Additional notes (optional)
 */
async function logError({
  error_type = 'application',
  error_level = 'error',
  error_message,
  error_stack = null,
  request = null,
  status_code = null,
  response_time_ms = null,
  user = null,
  notes = null
}) {
  try {
    // Extract request information if provided
    let request_path = null;
    let request_method = null;
    let request_body = null;
    let request_query = null;
    let request_headers = null;
    let ip_address = null;
    let user_agent = null;
    let user_id = null;
    let shop_id = null;

    if (request) {
      request_path = request.path || request.url;
      request_method = request.method;
      
      // Safely extract request body (exclude sensitive fields like passwords)
      if (request.body) {
        const sanitizedBody = { ...request.body };
        if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
        if (sanitizedBody.password_hash) sanitizedBody.password_hash = '[REDACTED]';
        if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
        request_body = JSON.stringify(sanitizedBody);
      }
      
      if (request.query && Object.keys(request.query).length > 0) {
        request_query = JSON.stringify(request.query);
      }
      
      // Extract headers (exclude sensitive ones)
      if (request.headers) {
        const sanitizedHeaders = { ...request.headers };
        if (sanitizedHeaders.authorization) sanitizedHeaders.authorization = '[REDACTED]';
        if (sanitizedHeaders.cookie) sanitizedHeaders.cookie = '[REDACTED]';
        request_headers = JSON.stringify(sanitizedHeaders);
      }
      
      ip_address = getClientIp(request);
      user_agent = request.headers['user-agent'] || null;
    }

    // Extract user information if provided
    if (user) {
      user_id = user.id || user.userId || null;
      shop_id = user.shop_id || user.shopId || null;
    }

    // Truncate error_message and error_stack if too long (TEXT field can handle large data, but we'll limit for performance)
    const maxMessageLength = 5000;
    const maxStackLength = 10000;
    
    const truncatedMessage = error_message && error_message.length > maxMessageLength
      ? error_message.substring(0, maxMessageLength) + '... [truncated]'
      : error_message;
    
    const truncatedStack = error_stack && error_stack.length > maxStackLength
      ? error_stack.substring(0, maxStackLength) + '... [truncated]'
      : error_stack;

    await pool.execute(
      `INSERT INTO error_logs 
       (error_type, error_level, error_message, error_stack, request_path, request_method, 
        request_body, request_query, request_headers, user_id, shop_id, ip_address, 
        user_agent, status_code, response_time_ms, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        error_type,
        error_level,
        truncatedMessage,
        truncatedStack,
        request_path,
        request_method,
        request_body,
        request_query,
        request_headers,
        user_id,
        shop_id,
        ip_address,
        user_agent,
        status_code,
        response_time_ms,
        notes
      ]
    );
  } catch (logError) {
    // Don't throw - if error logging fails, just log to console
    // We don't want error logging to cause application failures
    console.error('Failed to log error to database:', logError);
    console.error('Original error that failed to log:', error_message);
  }
}

/**
 * Log authentication errors
 */
async function logAuthError(error, request, user = null) {
  await logError({
    error_type: 'authentication',
    error_level: 'error',
    error_message: error.message || String(error),
    error_stack: error.stack,
    request,
    status_code: 401,
    user
  });
}

/**
 * Log database errors
 */
async function logDatabaseError(error, request, user = null) {
  await logError({
    error_type: 'database',
    error_level: 'critical',
    error_message: error.message || String(error),
    error_stack: error.stack,
    request,
    status_code: 500,
    user
  });
}

/**
 * Log validation errors
 */
async function logValidationError(error, request, user = null) {
  await logError({
    error_type: 'validation',
    error_level: 'warning',
    error_message: error.message || String(error),
    error_stack: error.stack,
    request,
    status_code: 400,
    user
  });
}

/**
 * Log general application errors
 */
async function logApplicationError(error, request, user = null, statusCode = 500) {
  await logError({
    error_type: 'application',
    error_level: statusCode >= 500 ? 'critical' : 'error',
    error_message: error.message || String(error),
    error_stack: error.stack,
    request,
    status_code: statusCode,
    user
  });
}

module.exports = {
  logError,
  logAuthError,
  logDatabaseError,
  logValidationError,
  logApplicationError
};

