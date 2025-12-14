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
  // Role is now server-enforced to 'admin' only - removed from validation but kept for backward compatibility
  body('role').optional().custom((value) => {
    // If role is provided, it must be 'admin' - cashier is not allowed via registration
    if (value && value !== 'admin') {
      throw new Error('Only shop admin can be created via registration. Cashiers must be created by shop admin after registration.');
    }
    return true;
  }),
  body('gst_rates').optional().isArray().withMessage('GST rates must be an array'),
  body('gstin').optional().trim().isLength({ max: 15 }).withMessage('GSTIN must be at most 15 characters')
    .custom((value) => {
      if (!value || value.trim() === '') return true; // Optional field
      // GSTIN format: 15 alphanumeric characters
      // Pattern: [0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}
      const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinPattern.test(value)) {
        throw new Error('GSTIN must be in valid format (15 alphanumeric characters, e.g., 22AAAAA0000A1Z5)');
      }
      return true;
    })
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

    const { registration_token, full_name, email, phone, username, password, role, gst_rates, gstin } = req.body;
    
    // SECURITY: Registration links can ONLY create shop admins, never cashiers
    // Force role to 'admin' regardless of client input
    const enforcedRole = 'admin';

    // Validate GST rates if provided (admin role is enforced)
    const validGstRates = ['0', '0.25', '3', '5', '12', '18', '28'];
    let processedGstRates = null;
    
    if (gst_rates !== undefined) {
      if (!Array.isArray(gst_rates)) {
        return res.status(400).json({
          success: false,
          message: 'GST rates must be an array'
        });
      }
      
      // Validate each rate is valid
      const invalidRates = gst_rates.filter(rate => !validGstRates.includes(String(rate)));
      if (invalidRates.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid GST rates: ${invalidRates.join(', ')}. Valid rates are: ${validGstRates.join(', ')}`
        });
      }
      
      // Ensure "0" is always included
      const ratesSet = new Set(gst_rates.map(r => String(r)));
      ratesSet.add('0');
      processedGstRates = JSON.stringify(Array.from(ratesSet).sort((a, b) => parseFloat(a) - parseFloat(b)));
    }

    // Validate registration token and shop status
    const [tokens] = await pool.execute(
      `SELECT rt.*, s.shop_name, s.status, s.admin_user_id
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
        message: 'This shop is already activated. Registration link has been used.'
      });
    }

    const shop_id = tokenData.shop_id;

    // CRITICAL VALIDATION: Ensure shop is in DRAFT/pending state and has no admin
    if (tokenData.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Shop setup already completed. This registration link is no longer valid.'
      });
    }

    if (tokenData.admin_user_id !== null) {
      return res.status(400).json({
        success: false,
        message: 'This shop is already activated. An admin user already exists for this shop.'
      });
    }


    // Check if an admin user already exists for this shop (additional safety check)
    const [existingAdmin] = await pool.execute(
      'SELECT id FROM users WHERE shop_id = ? AND role = ?',
      [shop_id, 'admin']
    );

    if (existingAdmin.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This shop already has an admin user. Registration is no longer available.'
      });
    }

    // Check if username already exists in this shop
    const [existingUsername] = await pool.execute(
      'SELECT id FROM users WHERE shop_id = ? AND username = ?',
      [shop_id, username]
    );

    if (existingUsername.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists in this shop'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Hash password and create admin user
      const passwordHash = await bcrypt.hash(password, 10);
      const [userResult] = await connection.execute(
        `INSERT INTO users (shop_id, username, email, password_hash, role, full_name, phone, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [shop_id, username, email, passwordHash, enforcedRole, full_name, phone || null]
      );

      const adminUserId = userResult.insertId;

      // Activate the shop: update status to 'active' and set admin_user_id
      await connection.execute(
        `UPDATE shops 
         SET status = 'active', 
             admin_user_id = ?,
             updated_at = NOW()
         WHERE id = ? AND status = 'pending' AND admin_user_id IS NULL`,
        [adminUserId, shop_id]
      );
      
      // Update GST rates if provided
      if (processedGstRates !== null) {
        await connection.execute(
          `UPDATE shops SET gst_rates = ? WHERE id = ?`,
          [processedGstRates, shop_id]
        );
      }
      
      // Update GSTIN if provided
      if (gstin && gstin.trim()) {
        await connection.execute(
          `UPDATE shops SET gstin = ? WHERE id = ?`,
          [gstin.trim().toUpperCase(), shop_id]
        );
      }

      // Mark token as used (one-time use enforcement)
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

    // Strict role-based filtering to prevent security vulnerability
    // When shop_id is null (explicit): search only for super_admin users
    // When shop_id is undefined/empty (not provided): search only for admin/cashier users
    // When shop_id is a number: search for admin/cashier users with that specific shop_id
    let query = `SELECT u.id, u.shop_id, u.username, u.email, u.password_hash, u.role, 
                        u.full_name, u.is_active, s.shop_name, s.gstin, s.logo_url as shop_logo_url
                 FROM users u
                 LEFT JOIN shops s ON u.shop_id = s.id
                 WHERE u.username = ?`;
    let params = [username];

    // Strict role-based filtering based on shop_id presence
    if (shop_id === null) {
      // shop_id explicitly null (superadmin checkbox checked) - search only for super_admin users
      query += ' AND u.shop_id IS NULL AND u.role = ?';
      params.push('super_admin');
    } else if (shop_id === undefined || shop_id === '') {
      // shop_id not provided (regular user login) - search only for regular users (admin/cashier)
      // Don't filter by shop_id value, just exclude superadmins
      query += ' AND u.shop_id IS NOT NULL AND u.role IN (?, ?)';
      params.push('admin', 'cashier');
    } else {
      // shop_id provided as a number - search for regular users with that specific shop_id
      query += ' AND u.shop_id IS NOT NULL AND u.shop_id = ? AND u.role IN (?, ?)';
      params.push(parseInt(shop_id), 'admin', 'cashier');
    }

    const [users] = await pool.execute(query, params);

    // Defensive check: if multiple users match, it's a data integrity issue
    if (users.length > 1) {
      await logLoginAttempt(null, shop_id || null, username, req, 'failed', 'Multiple users found - data integrity error');
      return res.status(500).json({
        success: false,
        message: 'Authentication error: Multiple users found. Please contact system administrator.'
      });
    }

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
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
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
          shop_logo_url: user.shop_logo_url || null,
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
              s.shop_name, s.owner_name, s.gstin, s.phone, s.address, s.logo_url as shop_logo_url
       FROM users u
       LEFT JOIN shops s ON u.shop_id = s.id
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

// Refresh token endpoint - extends session without requiring re-login
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    // User is already authenticated via middleware
    // Verify user still exists and is active
    const [users] = await pool.execute(
      `SELECT u.id, u.shop_id, u.username, u.role, u.is_active, s.is_active as shop_active
       FROM users u
       LEFT JOIN shops s ON u.shop_id = s.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!users.length || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Check if shop is active (for admin and cashier roles)
    if (users[0].shop_id && users[0].role !== 'super_admin') {
      if (users[0].shop_active === 0 || users[0].shop_active === false) {
        return res.status(403).json({
          success: false,
          message: 'This shop has been disabled. Please contact your system administrator.'
        });
      }
    }

    // Generate new JWT token with same expiration (30 days default for POS systems)
    const token = jwt.sign(
      { userId: req.user.id, shopId: req.user.shopId, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    res.json({
      success: true,
      token,
      message: 'Token refreshed successfully'
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

// Update own profile (username and/or password) - any authenticated user
router.put('/profile', authenticate, [
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('current_password').optional().notEmpty().withMessage('Current password is required when changing password')
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

    const { username, password, current_password } = req.body;
    const userId = req.user.id;

    // Verify user exists
    const [users] = await pool.execute(
      'SELECT id, username, password_hash, shop_id FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const updateFields = [];
    const updateValues = [];

    // Update username if provided
    if (username && username !== user.username) {
      // Check if username already exists in the same shop
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE shop_id = ? AND username = ? AND id != ?',
        [user.shop_id, username, userId]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists in this shop'
        });
      }

      updateFields.push('username = ?');
      updateValues.push(username);
    }

    // Update password if provided
    if (password) {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change password'
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      updateValues.push(passwordHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(userId);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

