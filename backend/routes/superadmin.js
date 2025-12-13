const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// All routes require super admin role
router.use((req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }
  next();
});

// Super admin doesn't need shop isolation, but we'll use it to allow shop_id specification
router.use(shopIsolation);

// Get all shops
router.get('/shops', async (req, res, next) => {
  try {
    const [shops] = await pool.execute(
      `SELECT s.*, 
              s.is_active,
              COUNT(DISTINCT u.id) as user_count,
              COUNT(DISTINCT p.id) as product_count,
              COUNT(DISTINCT b.id) as bill_count
       FROM shops s
       LEFT JOIN users u ON s.id = u.shop_id
       LEFT JOIN products p ON s.id = p.shop_id
       LEFT JOIN bills b ON s.id = b.shop_id
       GROUP BY s.id
       ORDER BY s.created_at DESC`
    );

    res.json({
      success: true,
      data: shops
    });
  } catch (error) {
    next(error);
  }
});

// Get single shop details
router.get('/shops/:id', async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id);

    const [shops] = await pool.execute(
      `SELECT s.*, 
              COUNT(DISTINCT u.id) as user_count,
              COUNT(DISTINCT p.id) as product_count,
              COUNT(DISTINCT b.id) as bill_count,
              SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END) as total_revenue
       FROM shops s
       LEFT JOIN users u ON s.id = u.shop_id
       LEFT JOIN products p ON s.id = p.shop_id
       LEFT JOIN bills b ON s.id = b.shop_id
       WHERE s.id = ?
       GROUP BY s.id`,
      [shopId]
    );

    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    res.json({
      success: true,
      data: shops[0]
    });
  } catch (error) {
    next(error);
  }
});

// Create new shop
router.post('/shops', [
  body('shop_name').trim().notEmpty().withMessage('Shop name is required'),
  body('owner_name').trim().notEmpty().withMessage('Owner name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const { shop_name, owner_name, email, phone, address, gstin, username, password, sendInvitation } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check if shop email already exists
      const [existingShop] = await connection.execute(
        'SELECT id FROM shops WHERE email = ?',
        [email]
      );

      if (existingShop.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Shop with this email already exists'
        });
      }

      // Create shop
      const [shopResult] = await connection.execute(
        `INSERT INTO shops (shop_name, owner_name, email, phone, address, gstin) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [shop_name, owner_name, email, phone || null, address || null, gstin || null]
      );

      const shopId = shopResult.insertId;

      // Check if username already exists
      const [existingUser] = await connection.execute(
        'SELECT id FROM users WHERE shop_id = ? AND username = ?',
        [shopId, username]
      );

      if (existingUser.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      // Hash password and create admin user
      const passwordHash = await bcrypt.hash(password, 10);
      await connection.execute(
        `INSERT INTO users (shop_id, username, email, password_hash, role, full_name, is_active) 
         VALUES (?, ?, ?, ?, 'admin', ?, TRUE)`,
        [shopId, username, email, passwordHash, owner_name]
      );

      await connection.commit();
      connection.release();

      // Optionally send invitation email
      let invitationData = null;
      if (sendInvitation) {
        try {
          const { sendRegistrationInvitation, isEmailConfigured } = require('../config/email');
          const crypto = require('crypto');
          
          if (isEmailConfigured()) {
            const generateToken = () => crypto.randomBytes(32).toString('hex');
            const token = generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await pool.execute(
              `INSERT INTO registration_tokens (shop_id, token, email, expires_at)
               VALUES (?, ?, ?, ?)`,
              [shopId, token, email, expiresAt]
            );

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const registrationUrl = `${frontendUrl}/register?token=${token}`;

            try {
              await sendRegistrationInvitation(email, shop_name, shopId, token, registrationUrl);
              invitationData = {
                sent: true,
                email,
                expires_at: expiresAt,
                registration_url: registrationUrl
              };
            } catch (emailError) {
              invitationData = {
                sent: false,
                warning: emailError.message,
                token,
                email,
                expires_at: expiresAt,
                registration_url: registrationUrl
              };
            }
          } else {
            // Generate token even if email not configured
            const generateToken = () => crypto.randomBytes(32).toString('hex');
            const token = generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await pool.execute(
              `INSERT INTO registration_tokens (shop_id, token, email, expires_at)
               VALUES (?, ?, ?, ?)`,
              [shopId, token, email, expiresAt]
            );

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const registrationUrl = `${frontendUrl}/register?token=${token}`;

            invitationData = {
              sent: false,
              warning: 'Email service is not configured. Please share the registration URL manually.',
              token,
              email,
              expires_at: expiresAt,
              registration_url: registrationUrl
            };
          }
        } catch (error) {
          // Log error but don't fail shop creation
          console.error('Error sending invitation:', error);
          invitationData = {
            sent: false,
            warning: error.message || 'Failed to send invitation email. Please check email configuration.',
            error: error.message
          };
        }
      }

      res.status(201).json({
        success: true,
        message: 'Shop and admin user created successfully',
        data: { 
          shop_id: shopId,
          ...(invitationData && { invitation: invitationData })
        }
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

// Update shop
router.put('/shops/:id', [
  body('shop_name').optional().trim().notEmpty().withMessage('Shop name cannot be empty'),
  body('owner_name').optional().trim().notEmpty().withMessage('Owner name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required')
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

    const shopId = parseInt(req.params.id);
    const { shop_name, owner_name, email, phone, address, gstin } = req.body;

    // Check if shop exists
    const [shops] = await pool.execute('SELECT id FROM shops WHERE id = ?', [shopId]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Check email uniqueness if provided
    if (email) {
      const [existing] = await pool.execute(
        'SELECT id FROM shops WHERE email = ? AND id != ?',
        [email, shopId]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another shop'
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (shop_name) { updates.push('shop_name = ?'); values.push(shop_name); }
    if (owner_name) { updates.push('owner_name = ?'); values.push(owner_name); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address || null); }
    if (gstin !== undefined) { updates.push('gstin = ?'); values.push(gstin || null); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(shopId);
    await pool.execute(
      `UPDATE shops SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Shop updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete shop (soft delete by deactivating)
router.delete('/shops/:id', async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id);

    // Check if shop exists
    const [shops] = await pool.execute('SELECT id FROM shops WHERE id = ?', [shopId]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Note: We're not actually deleting due to foreign key constraints
    // In production, you might want to add a 'deleted_at' column for soft deletes
    // For now, we'll just return a message
    res.json({
      success: true,
      message: 'Shop deletion would cascade to all related data. Use with caution. This endpoint needs implementation for soft delete.'
    });
  } catch (error) {
    next(error);
  }
});

// Disable shop (deactivates shop and all its users)
router.post('/shops/:id/disable', async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id);

    // Check if shop exists
    const [shops] = await pool.execute('SELECT id, shop_name FROM shops WHERE id = ?', [shopId]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Disable the shop
      await connection.execute(
        'UPDATE shops SET is_active = FALSE WHERE id = ?',
        [shopId]
      );

      // Disable all users of this shop (admin and cashier roles)
      await connection.execute(
        `UPDATE users 
         SET is_active = FALSE 
         WHERE shop_id = ? AND role IN ('admin', 'cashier')`,
        [shopId]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Shop and all its users have been disabled successfully'
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

// Enable shop (reactivates shop and all its users)
router.post('/shops/:id/enable', async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id);

    // Check if shop exists
    const [shops] = await pool.execute('SELECT id, shop_name FROM shops WHERE id = ?', [shopId]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Enable the shop
      await connection.execute(
        'UPDATE shops SET is_active = TRUE WHERE id = ?',
        [shopId]
      );

      // Enable all users of this shop (admin and cashier roles)
      await connection.execute(
        `UPDATE users 
         SET is_active = TRUE 
         WHERE shop_id = ? AND role IN ('admin', 'cashier')`,
        [shopId]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Shop and all its users have been enabled successfully'
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

// Get users for a specific shop
router.get('/shops/:id/users', async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id);

    const [users] = await pool.execute(
      `SELECT id, username, email, role, full_name, phone, is_active, created_at
       FROM users
       WHERE shop_id = ?
       ORDER BY created_at DESC`,
      [shopId]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// Create user for a shop
router.post('/shops/:id/users', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
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

    const shopId = parseInt(req.params.id);
    const { username, email, password, role, full_name, phone } = req.body;

    // Check if shop exists
    const [shops] = await pool.execute('SELECT id FROM shops WHERE id = ?', [shopId]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Check if username already exists in this shop
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE shop_id = ? AND username = ?',
      [shopId, username]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists in this shop'
      });
    }

    // Check if email + role combination already exists for this shop
    // This allows the same email for different roles but prevents duplicate email + role combinations
    const [existingEmailRole] = await pool.execute(
      'SELECT id, role FROM users WHERE shop_id = ? AND email = ? AND role = ?',
      [shopId, email, role]
    );

    if (existingEmailRole.length > 0) {
      return res.status(400).json({
        success: false,
        message: `A ${role} user with this email already exists for this shop. Please use a different email or select a different role.`
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO users (shop_id, username, email, password_hash, role, full_name, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [shopId, username, email, passwordHash, role, full_name || null, phone || null]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
});

// Send registration invitation for a shop
router.post('/shops/:id/send-invitation', [
  body('email').isEmail().withMessage('Valid email is required')
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

    const { id } = req.params;
    const { email } = req.body;

    // Verify shop exists
    const [shops] = await pool.execute('SELECT id, shop_name FROM shops WHERE id = ?', [id]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Call the send-invitation handler directly
    const { sendRegistrationInvitation, isEmailConfigured } = require('../config/email');
    const crypto = require('crypto');

    if (!isEmailConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Email service is not configured. Please set SMTP environment variables.'
      });
    }

    const shop = shops[0];
    const generateToken = () => crypto.randomBytes(32).toString('hex');
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await pool.execute(
      `INSERT INTO registration_tokens (shop_id, token, email, expires_at)
       VALUES (?, ?, ?, ?)`,
      [id, token, email, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationUrl = `${frontendUrl}/register?token=${token}`;

    try {
      // Set a timeout wrapper for the entire email operation
      const emailPromise = sendRegistrationInvitation(email, shop.shop_name, id, token, registrationUrl);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout: Email operation took too long')), 28000);
      });
      
      await Promise.race([emailPromise, timeoutPromise]);
      
      res.json({
        success: true,
        message: 'Registration invitation sent successfully',
        data: {
          email,
          expires_at: expiresAt,
          registration_url: registrationUrl
        }
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Check if it's a timeout error
      const isTimeout = emailError.message.includes('timeout') || emailError.message.includes('Timeout');
      
      // Return success but with warning so token is still generated
      res.json({
        success: true,
        message: 'Token generated but email sending failed',
        warning: isTimeout 
          ? 'Email sending timed out. The registration link has been generated. Please share it manually or try sending again later.'
          : (emailError.message || 'Failed to send email. Please check email configuration.'),
        data: {
          token,
          email,
          expires_at: expiresAt,
          registration_url: registrationUrl
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

