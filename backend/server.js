const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy - required when running behind a reverse proxy (Render, Vercel, etc.)
// Trust only the first proxy hop (Render) to prevent IP spoofing
// This allows express-rate-limit to correctly identify client IPs from X-Forwarded-For header
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - separate limiters for different routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Allow 20 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  validate: {
    trustProxy: false, // Disable validation since we trust only first proxy
  },
});

const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for auth routes (they have their own limiter)
    return req.originalUrl.startsWith('/api/auth');
  },
  validate: {
    trustProxy: false, // Disable validation since we trust only first proxy
  },
});

// Apply general limiter (will skip auth routes)
app.use('/api/', generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/registration-tokens', require('./routes/registrationTokens'));
app.use('/api/login-history', require('./routes/loginHistory'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/hold-bills', require('./routes/holdBills'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/purchase-returns', require('./routes/purchaseReturns'));
app.use('/api/sales-returns', require('./routes/salesReturns'));
app.use('/api/error-logs', require('./routes/errorLogs'));
app.use('/api/invoice-templates', require('./routes/invoiceTemplates'));

// Error handling middleware (must be after all routes)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

