const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const { logError } = require('../utils/errorLogger');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Get all customers with filters
router.get('/', async (req, res, next) => {
  try {
    const { search, status, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM bills b WHERE b.customer_id = c.id) as total_orders,
        (SELECT COALESCE(SUM(b.total_amount), 0) FROM bills b WHERE b.customer_id = c.id) as total_spent,
        (SELECT MAX(b.created_at) FROM bills b WHERE b.customer_id = c.id) as last_order_date
      FROM customers c
      WHERE c.shop_id = ?
    `;
    const params = [req.shopId];

    if (status && status !== 'all') {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.gstin LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Use template literals for LIMIT and OFFSET (MySQL doesn't support placeholders for these)
    const limitNum = parseInt(limit) || 100;
    const offsetNum = parseInt(offset) || 0;
    query += ` ORDER BY c.name ASC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const [customers] = await pool.execute(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE shop_id = ?';
    const countParams = [req.shopId];

    if (status && status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (search) {
      countQuery += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logError('Get customers failed', error, { shopId: req.shopId, userId: req.user?.id });
    next(error);
  }
});

// Get single customer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [customers] = await pool.execute(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM bills b WHERE b.customer_id = c.id) as total_orders,
        (SELECT COALESCE(SUM(b.total_amount), 0) FROM bills b WHERE b.customer_id = c.id) as total_spent,
        (SELECT MAX(b.created_at) FROM bills b WHERE b.customer_id = c.id) as last_order_date
       FROM customers c
       WHERE c.id = ? AND c.shop_id = ?`,
      [id, req.shopId]
    );

    if (!customers.length) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get recent bills for this customer
    const [bills] = await pool.execute(
      `SELECT id, bill_number, total_amount, created_at, status
       FROM bills
       WHERE customer_id = ? AND shop_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [id, req.shopId]
    );

    res.json({
      success: true,
      data: {
        ...customers[0],
        recent_bills: bills
      }
    });
  } catch (error) {
    logError('Get customer failed', error, { shopId: req.shopId, userId: req.user?.id, customerId: req.params.id });
    next(error);
  }
});

// Create new customer
router.post('/', [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('phone').optional().trim(),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('gstin').optional().trim().isLength({ min: 15, max: 15 }).withMessage('GSTIN must be 15 characters'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
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

    const {
      name,
      phone,
      email,
      gstin,
      address,
      shipping_address,
      status = 'active',
      notes
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO customers (shop_id, name, phone, email, gstin, address, shipping_address, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.shopId,
        name.trim(),
        phone?.trim() || null,
        email?.trim() || null,
        gstin?.trim().toUpperCase() || null,
        address?.trim() || null,
        shipping_address?.trim() || null,
        status,
        notes?.trim() || null
      ]
    );

    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customers[0]
    });
  } catch (error) {
    logError('Create customer failed', error, { shopId: req.shopId, userId: req.user?.id });
    next(error);
  }
});

// Update customer
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Customer name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('gstin').optional().trim().isLength({ min: 15, max: 15 }).withMessage('GSTIN must be 15 characters'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
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

    // Check if customer exists and belongs to shop
    const [existing] = await pool.execute(
      'SELECT id FROM customers WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const {
      name,
      phone,
      email,
      gstin,
      address,
      shipping_address,
      status,
      notes
    } = req.body;

    const updateFields = [];
    const params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name.trim());
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(phone?.trim() || null);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email?.trim() || null);
    }
    if (gstin !== undefined) {
      updateFields.push('gstin = ?');
      params.push(gstin?.trim().toUpperCase() || null);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      params.push(address?.trim() || null);
    }
    if (shipping_address !== undefined) {
      updateFields.push('shipping_address = ?');
      params.push(shipping_address?.trim() || null);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes?.trim() || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, req.shopId);

    await pool.execute(
      `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customers[0]
    });
  } catch (error) {
    logError('Update customer failed', error, { shopId: req.shopId, userId: req.user?.id, customerId: req.params.id });
    next(error);
  }
});

// Delete customer (soft delete by setting status to inactive, or hard delete if no bills exist)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if customer exists and belongs to shop
    const [existing] = await pool.execute(
      'SELECT id FROM customers WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has any bills
    const [bills] = await pool.execute(
      'SELECT COUNT(*) as count FROM bills WHERE customer_id = ?',
      [id]
    );

    if (bills[0].count > 0) {
      // Soft delete - set status to inactive
      await pool.execute(
        'UPDATE customers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND shop_id = ?',
        ['inactive', id, req.shopId]
      );

      return res.json({
        success: true,
        message: 'Customer deactivated successfully (has existing bills)',
        data: { id, status: 'inactive' }
      });
    } else {
      // Hard delete - no bills associated
      await pool.execute(
        'DELETE FROM customers WHERE id = ? AND shop_id = ?',
        [id, req.shopId]
      );

      return res.json({
        success: true,
        message: 'Customer deleted successfully',
        data: { id }
      });
    }
  } catch (error) {
    logError('Delete customer failed', error, { shopId: req.shopId, userId: req.user?.id, customerId: req.params.id });
    next(error);
  }
});

// Search customers (for autocomplete/select)
router.get('/search/quick', async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 1) {
      return res.json({
        success: true,
        data: []
      });
    }

    const searchTerm = `%${q}%`;
    const [customers] = await pool.execute(
      `SELECT id, name, phone, email, gstin, address
       FROM customers
       WHERE shop_id = ? AND status = 'active'
       AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin LIKE ?)
       ORDER BY name ASC
       LIMIT 20`,
      [req.shopId, searchTerm, searchTerm, searchTerm, searchTerm]
    );

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    logError('Customer search failed', error, { shopId: req.shopId, userId: req.user?.id });
    next(error);
  }
});

module.exports = router;

