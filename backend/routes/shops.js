const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

// All routes require authentication
router.use(authenticate);
router.use(shopIsolation);

// Get shop details
router.get('/', async (req, res, next) => {
  try {
    const [shops] = await pool.execute(
      'SELECT id, shop_name, owner_name, email, phone, address, gstin, logo_url, printer_type, printer_config, created_at FROM shops WHERE id = ?',
      [req.shopId]
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

// Update shop details (admin only)
router.put('/', authorize('admin'), [
  body('shop_name').optional().trim().notEmpty(),
  body('owner_name').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('gstin').optional().trim().isLength({ max: 15 }),
  body('printer_type').optional().isIn(['58mm', '80mm'])
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

    const { shop_name, owner_name, email, phone, address, gstin, printer_type, printer_config } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (shop_name) {
      updateFields.push('shop_name = ?');
      updateValues.push(shop_name);
    }
    if (owner_name) {
      updateFields.push('owner_name = ?');
      updateValues.push(owner_name);
    }
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone || null);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address || null);
    }
    if (gstin !== undefined) {
      updateFields.push('gstin = ?');
      updateValues.push(gstin || null);
    }
    if (printer_type) {
      updateFields.push('printer_type = ?');
      updateValues.push(printer_type);
    }
    if (printer_config) {
      updateFields.push('printer_config = ?');
      updateValues.push(JSON.stringify(printer_config));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(req.shopId);

    await pool.execute(
      `UPDATE shops SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Shop updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get shop users (admin only)
router.get('/users', authorize('admin'), async (req, res, next) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, username, email, role, full_name, phone, is_active, created_at 
       FROM users 
       WHERE shop_id = ? 
       ORDER BY created_at DESC`,
      [req.shopId]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// Create new user (admin only)
router.post('/users', authorize('admin'), [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'cashier']).withMessage('Role must be admin or cashier'),
  body('full_name').optional().trim(),
  body('phone').optional().trim()
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

    const { username, email, password, role, full_name, phone } = req.body;

    // Check if username already exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE shop_id = ? AND username = ?',
      [req.shopId, username]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO users (shop_id, username, email, password_hash, role, full_name, phone, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [req.shopId, username, email, passwordHash, role, full_name || null, phone || null]
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

// Update user (admin only)
router.put('/users/:userId', authorize('admin'), [
  body('role').optional().isIn(['admin', 'cashier']),
  body('is_active').optional().isBoolean()
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

    const { userId } = req.params;
    const { role, full_name, phone, is_active } = req.body;

    // Verify user belongs to same shop
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND shop_id = ?',
      [userId, req.shopId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (full_name !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name || null);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone || null);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(userId);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

