const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { parseUserAgent, getClientIp } = require('../utils/deviceInfo');

const router = express.Router();

// Rate limiting for auth routes - more lenient
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Allow 20 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Helper function to log login attempts
async function logLoginAttempt(userId, shopId, username, req, status, failureReason = null) {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceInfo = parseUserAgent(userAgent);

    await pool.execute(
      `INSERT INTO login_history 
       (user_id, shop_id, username, ip_address, user_agent, device_type, browser, os, login_status, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        shopId || null,
        username || 'Unknown',
        ipAddress,
        userAgent,
        deviceInfo.deviceType,
        deviceInfo.browser,
        deviceInfo.os,
        status,
        failureReason
      ]
    );
  } catch (error) {
    // Don't fail login if logging fails, just log the error
    console.error('Error logging login attempt:', error);
  }
}

// Register new user for existing shop (requires registration token)
router.post('/register', authLimiter, [
  body('registration_token').trim().notEmpty().withMessage('Registration token is required'),
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'cashier']).withMessage('Role must be admin or cashier')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { registration_token, full_name, email, phone, username, password, role } = req.body;

    // Validate registration token
    const [tokens] = await pool.execute(
      `SELECT rt.*, s.shop_name 
       FROM registration_tokens rt
       JOIN shops s ON rt.shop_id = s.id
       WHERE rt.token = ?`,
      [registration_token]
    );

    if (!tokens.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration token. Please use the link from your invitation email.'
      });
    }

    const tokenData = tokens[0];

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Registration token has expired. Please contact your system administrator for a new invitation.'
      });
    }

    // Check if token is already used
    if (tokenData.used_at) {
      return res.status(400).json({
        success: false,
        message: 'This registration token has already been used.'
      });
    }

    const shop_id = tokenData.shop_id;

    // Note: Email matching is not required - the token validates the shop
    // The invitation email is just for delivery, not a strict requirement
    // This allows shop owners to create additional users (cashiers) with different emails

    // Check if username already exists in this shop
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE shop_id = ? AND username = ?',
      [shop_id, username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists in this shop'
      });
    }

    // Check if email + role combination already exists for this shop
    // This allows the same email for different roles (e.g., admin@shop.com as "admin" and "cashier")
    // but prevents duplicate email + role combinations
    const [existingEmailRole] = await pool.execute(
      'SELECT id, role FROM users WHERE shop_id = ? AND email = ? AND role = ?',
      [shop_id, email, role]
    );

    if (existingEmailRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A ${role} user with this email already exists for this shop. Please use a different email or select a different role.`
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 10);
      await connection.execute(
        `INSERT INTO users (shop_id, username, email, password_hash, role, full_name, phone, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [shop_id, username, email, passwordHash, role, full_name, phone || null]
      );

      // Mark token as used
      await connection.execute(
        'UPDATE registration_tokens SET used_at = NOW() WHERE id = ?',
        [tokenData.id]
      );

      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        message: 'Account created successfully! You can now login.'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('shop_id')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      // Allow null/undefined for all users - shop_id is optional
      if (value === null || value === undefined || value === '') {
        return true;
      }
      const num = parseInt(value);
      return !isNaN(num) && num > 0;
    })
    .withMessage('Shop ID must be a number or null')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log failed login attempt (validation error)
      const { username, shop_id } = req.body;
      if (username) {
        await logLoginAttempt(null, shop_id || null, username, req, 'failed', 'Validation failed');
      }
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password, shop_id } = req.body;

    // Find user by username only (shop_id is optional for all roles)
    // Usernames are unique per shop, so this will find the correct user
    let query = `SELECT u.id, u.shop_id, u.username, u.email, u.password_hash, u.role, 
                        u.full_name, u.is_active, s.shop_name, s.gstin
                 FROM users u
                 LEFT JOIN shops s ON u.shop_id = s.id
                 WHERE u.username = ?`;
    let params = [username];

    // If shop_id is explicitly provided and not null, use it for additional validation
    // Otherwise, find user by username only (works for all roles: admin, cashier, super_admin)
    if (shop_id !== null && shop_id !== undefined && shop_id !== '') {
      // Optional: if shop_id is provided, validate it matches the user's shop
      query += ' AND u.shop_id = ?';
      params.push(parseInt(shop_id));
    }
    // If shop_id is not provided (null/undefined/empty), find user by username only
    // This works because usernames are unique per shop in the database

    const [users] = await pool.execute(query, params);

    if (!users.length) {
      // Log failed login attempt (user not found)
      await logLoginAttempt(null, shop_id || null, username, req, 'failed', 'User not found');
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      // Log failed login attempt (inactive account)
      await logLoginAttempt(user.id, user.shop_id, username, req, 'failed', 'Account is inactive');
      
      return res.status(401).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      // Log failed login attempt (wrong password)
      await logLoginAttempt(user.id, user.shop_id, username, req, 'failed', 'Invalid password');
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token (shop_id can be null for super admin)
    const token = jwt.sign(
      { userId: user.id, shopId: user.shop_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log successful login attempt
    await logLoginAttempt(user.id, user.shop_id, username, req, 'success', null);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          shop_id: user.shop_id,
          username: user.username,
          email: user.email,
          role: user.role,
          full_name: user.full_name,
          shop_name: user.shop_name || null,
          gstin: user.gstin || null
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.shop_id, u.username, u.email, u.role, u.full_name, 
              s.shop_name, s.owner_name, s.gstin, s.phone, s.address
       FROM users u
       JOIN shops s ON u.shop_id = s.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { current_password, new_password } = req.body;

    // Get current user password
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

