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
      'SELECT id, shop_name, owner_name, email, phone, address, gstin, gst_rates, logo_url, printer_type, printer_config, created_at FROM shops WHERE id = ?',
      [req.shopId]
    );

    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    const shop = shops[0];
    
    // Parse gst_rates JSON if present, or return all rates for backward compatibility
    let gstRates = null;
    if (shop.gst_rates) {
      try {
        gstRates = typeof shop.gst_rates === 'string' ? JSON.parse(shop.gst_rates) : shop.gst_rates;
      } catch (e) {
        // If parsing fails, treat as null (all rates available)
        gstRates = null;
      }
    }

    res.json({
      success: true,
      data: {
        ...shop,
        gst_rates: gstRates
      }
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

    const { shop_name, owner_name, email, phone, address, gstin, printer_type, printer_config, logo_url, gst_rates } = req.body;

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
    if (logo_url !== undefined) {
      updateFields.push('logo_url = ?');
      updateValues.push(logo_url || null);
    }
    if (gst_rates !== undefined) {
      // Validate GST rates
      const validGstRates = ['0', '0.25', '3', '5', '12', '18', '28'];
      if (Array.isArray(gst_rates)) {
        // Ensure "0" is always included
        const ratesSet = new Set(gst_rates.map(r => String(r)));
        ratesSet.add('0');
        const processedRates = Array.from(ratesSet).sort((a, b) => parseFloat(a) - parseFloat(b));
        
        // Validate all rates are valid
        const invalidRates = processedRates.filter(rate => !validGstRates.includes(String(rate)));
        if (invalidRates.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid GST rates: ${invalidRates.join(', ')}. Valid rates are: ${validGstRates.join(', ')}`
          });
        }
        
        updateFields.push('gst_rates = ?');
        updateValues.push(JSON.stringify(processedRates));
      } else if (gst_rates === null) {
        // Allow setting to null (all rates available)
        updateFields.push('gst_rates = ?');
        updateValues.push(null);
      } else {
        return res.status(400).json({
          success: false,
          message: 'GST rates must be an array or null'
        });
      }
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

// Create new user (shop admin only) - ONLY for creating cashiers
// Shop admins cannot create other admins - only superadmin can via registration links
router.post('/users', authorize('admin'), [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['cashier']).withMessage('Only cashier role can be created. Admin users must be created via registration links.'),
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
    
    // SECURITY: Enforce that only cashiers can be created via this endpoint
    // Shop admins cannot create other admins
    const enforcedRole = 'cashier';

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
      [req.shopId, username, email, passwordHash, enforcedRole, full_name || null, phone || null]
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

// Delete user (admin only)
router.delete('/users/:userId', authorize('admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    // Prevent self-deletion
    if (userIdNum === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Verify user belongs to same shop
    const [users] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ? AND shop_id = ?',
      [userIdNum, req.shopId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Prevent deleting the last admin user
    if (user.role === 'admin') {
      const [adminCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM users WHERE shop_id = ? AND role = ? AND is_active = TRUE',
        [req.shopId, 'admin']
      );

      if (adminCount[0].count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin user. At least one active admin is required for the shop.'
        });
      }
    }

    // Delete the user (CASCADE will handle related records like login_history)
    await pool.execute(
      'DELETE FROM users WHERE id = ? AND shop_id = ?',
      [userIdNum, req.shopId]
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

