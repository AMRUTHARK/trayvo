const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Get stock ledger
router.get('/ledger', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { product_id, transaction_type, start_date, end_date, page = 1, limit = 100 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT sl.id, sl.product_id, sl.transaction_type, sl.reference_id, sl.reference_type,
             sl.quantity_change, sl.quantity_before, sl.quantity_after, sl.notes,
             sl.created_at, p.name as product_name, p.sku, u.username as created_by_name
      FROM stock_ledger sl
      JOIN products p ON sl.product_id = p.id
      LEFT JOIN users u ON sl.created_by = u.id
      WHERE sl.shop_id = ?
    `;
    const params = [req.shopId];

    if (product_id) {
      query += ' AND sl.product_id = ?';
      params.push(parseInt(product_id));
    }

    if (transaction_type) {
      query += ' AND sl.transaction_type = ?';
      params.push(transaction_type);
    }

    if (start_date) {
      query += ' AND DATE(sl.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(sl.created_at) <= ?';
      params.push(end_date);
    }

    // Use template literals for LIMIT and OFFSET to avoid prepared statement issues
    query += ` ORDER BY sl.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [ledger] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM stock_ledger WHERE shop_id = ?';
    const countParams = [req.shopId];

    if (product_id) {
      countQuery += ' AND product_id = ?';
      countParams.push(parseInt(product_id));
    }
    if (transaction_type) {
      countQuery += ' AND transaction_type = ?';
      countParams.push(transaction_type);
    }
    if (start_date) {
      countQuery += ' AND DATE(created_at) >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ' AND DATE(created_at) <= ?';
      countParams.push(end_date);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: ledger,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get low stock products
router.get('/low-stock', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const [products] = await pool.execute(
      `SELECT p.id, p.name, p.sku, p.unit, p.stock_quantity, p.min_stock_level,
              c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.shop_id = ? AND p.is_active = TRUE 
       AND p.stock_quantity <= p.min_stock_level
       ORDER BY (p.stock_quantity / NULLIF(p.min_stock_level, 0)) ASC`,
      [req.shopId]
    );

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
});

// Adjust stock (manual adjustment)
router.post('/adjust', [
  body('product_id').isInt().withMessage('Product ID is required'),
  body('quantity_change').isFloat().withMessage('Quantity change is required'),
  body('notes').optional().trim()
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

    const { product_id, quantity_change, notes } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Verify product belongs to shop
      const [products] = await connection.execute(
        'SELECT id, stock_quantity FROM products WHERE id = ? AND shop_id = ?',
        [product_id, req.shopId]
      );

      if (!products.length) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const oldStock = parseFloat(products[0].stock_quantity);
      const newStock = oldStock + parseFloat(quantity_change);

      if (newStock < 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for adjustment'
        });
      }

      // Update stock
      await connection.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [newStock, product_id]
      );

      // Add to ledger
      await connection.execute(
        `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_type,
                                  quantity_change, quantity_before, quantity_after, 
                                  notes, created_by)
         VALUES (?, ?, 'adjustment', 'adjustment', ?, ?, ?, ?, ?)`,
        [
          req.shopId, product_id, parseFloat(quantity_change),
          oldStock, newStock, notes || 'Manual stock adjustment', req.user.id
        ]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Stock adjusted successfully',
        data: {
          product_id,
          old_stock: oldStock,
          new_stock: newStock,
          quantity_change: parseFloat(quantity_change)
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

// Bulk stock update
router.post('/bulk-update', [
  body('updates').isArray({ min: 1 }).withMessage('At least one update is required'),
  body('updates.*.product_id').isInt().withMessage('Product ID is required'),
  body('updates.*.quantity_change').isFloat().withMessage('Quantity change is required')
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

    const { updates, notes } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < updates.length; i++) {
        const { product_id, quantity_change } = updates[i];

        try {
          // Verify product
          const [products] = await connection.execute(
            'SELECT id, stock_quantity FROM products WHERE id = ? AND shop_id = ?',
            [product_id, req.shopId]
          );

          if (!products.length) {
            errors.push(`Product ${product_id} not found`);
            continue;
          }

          const oldStock = parseFloat(products[0].stock_quantity);
          const newStock = oldStock + parseFloat(quantity_change);

          if (newStock < 0) {
            errors.push(`Product ${product_id}: Insufficient stock`);
            continue;
          }

          // Update stock
          await connection.execute(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [newStock, product_id]
          );

          // Add to ledger
          await connection.execute(
            `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_type,
                                      quantity_change, quantity_before, quantity_after, 
                                      notes, created_by)
             VALUES (?, ?, 'adjustment', 'adjustment', ?, ?, ?, ?, ?)`,
            [
              req.shopId, product_id, parseFloat(quantity_change),
              oldStock, newStock, notes || 'Bulk stock update', req.user.id
            ]
          );

          results.push({ product_id, old_stock: oldStock, new_stock: newStock });
        } catch (err) {
          errors.push(`Product ${product_id}: ${err.message}`);
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `Bulk update completed: ${results.length} successful, ${errors.length} failed`,
        data: {
          successful: results,
          errors
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

module.exports = router;

