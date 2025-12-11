const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Generate unique bill number
async function generateBillNumber(shopId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const [lastBill] = await pool.execute(
    `SELECT bill_number FROM bills 
     WHERE shop_id = ? AND bill_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [shopId, `BILL-${dateStr}-%`]
  );

  let sequence = 1;
  if (lastBill.length > 0) {
    const lastSeq = parseInt(lastBill[0].bill_number.split('-')[2]) || 0;
    sequence = lastSeq + 1;
  }

  return `BILL-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

// Get all bills with filters
router.get('/', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date, status, payment_mode, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT b.id, b.bill_number, b.customer_name, b.customer_phone, b.subtotal, 
             b.discount_amount, b.gst_amount, b.total_amount, b.payment_mode, 
             b.status, b.created_at, u.username as cashier_name
      FROM bills b
      JOIN users u ON b.user_id = u.id
      WHERE b.shop_id = ?
    `;
    const params = [req.shopId];

    if (start_date) {
      query += ' AND DATE(b.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(b.created_at) <= ?';
      params.push(end_date);
    }

    if (status) {
      query += ' AND b.status = ?';
      params.push(status);
    }

    if (payment_mode) {
      query += ' AND b.payment_mode = ?';
      params.push(payment_mode);
    }

    // Use template literals for LIMIT and OFFSET to avoid prepared statement issues
    query += ` ORDER BY b.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [bills] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM bills WHERE shop_id = ?';
    const countParams = [req.shopId];

    if (start_date) {
      countQuery += ' AND DATE(created_at) >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ' AND DATE(created_at) <= ?';
      countParams.push(end_date);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (payment_mode) {
      countQuery += ' AND payment_mode = ?';
      countParams.push(payment_mode);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: bills,
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

// Get single bill with items
router.get('/:id', async (req, res, next) => {
  try {
    const [bills] = await pool.execute(
      `SELECT b.*, u.username as cashier_name, u.full_name as cashier_full_name
       FROM bills b
       JOIN users u ON b.user_id = u.id
       WHERE b.id = ? AND b.shop_id = ?`,
      [req.params.id, req.shopId]
    );

    if (!bills.length) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const [items] = await pool.execute(
      `SELECT bi.*, p.name as product_name, p.sku, p.unit
       FROM bill_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bill_id = ?
       ORDER BY bi.id`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...bills[0],
        items
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create bill
router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt().withMessage('Valid product ID is required'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Valid quantity is required'),
  body('payment_mode').isIn(['cash', 'upi', 'card', 'mixed']).withMessage('Invalid payment mode')
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
      customer_name, customer_phone, customer_email,
      items, discount_amount, discount_percent,
      payment_mode, payment_details, notes,
      include_gst = true  // Default to true for backward compatibility
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Generate bill number
      const billNumber = await generateBillNumber(req.shopId);

      // Calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const billItems = [];

      for (const item of items) {
        const [products] = await connection.execute(
          `SELECT id, name, sku, unit, selling_price, gst_rate, stock_quantity 
           FROM products 
           WHERE id = ? AND shop_id = ? AND is_active = TRUE`,
          [item.product_id, req.shopId]
        );

        if (!products.length) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        const product = products[0];

        // Check stock availability
        if (parseFloat(product.stock_quantity) < parseFloat(item.quantity)) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`);
        }

        const unitPrice = parseFloat(product.selling_price);
        const quantity = parseFloat(item.quantity);
        const gstRate = parseFloat(product.gst_rate) || 0;
        const itemSubtotal = unitPrice * quantity;
        const itemDiscount = parseFloat(item.discount_amount || 0);
        const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
        const itemGst = include_gst ? (itemTotalAfterDiscount * gstRate) / 100 : 0;
        const itemTotal = itemTotalAfterDiscount + itemGst;

        subtotal += itemSubtotal;
        totalGst += itemGst;

        billItems.push({
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          quantity,
          unit: product.unit,
          unit_price: unitPrice,
          gst_rate: gstRate,
          gst_amount: itemGst,
          discount_amount: itemDiscount,
          total_amount: itemTotal
        });
      }

      // Apply bill-level discount
      const billDiscountAmount = discount_amount || (subtotal * (discount_percent || 0) / 100);
      const finalSubtotal = subtotal - billDiscountAmount;
      const finalTotal = finalSubtotal + totalGst;

      // Create bill
      const [billResult] = await connection.execute(
        `INSERT INTO bills (shop_id, bill_number, user_id, customer_name, customer_phone, 
                          customer_email, subtotal, discount_amount, discount_percent, 
                          gst_amount, total_amount, payment_mode, payment_details, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [
          req.shopId, billNumber, req.user.id,
          customer_name || null, customer_phone || null, customer_email || null,
          subtotal, billDiscountAmount, discount_percent || 0,
          totalGst, finalTotal, payment_mode,
          payment_details ? JSON.stringify(payment_details) : null,
          notes || null
        ]
      );

      const billId = billResult.insertId;

      // Create bill items and update stock
      for (const item of billItems) {
        await connection.execute(
          `INSERT INTO bill_items (bill_id, product_id, product_name, sku, quantity, unit, 
                                  unit_price, gst_rate, gst_amount, discount_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            billId, item.product_id, item.product_name, item.sku,
            item.quantity, item.unit, item.unit_price, item.gst_rate,
            item.gst_amount, item.discount_amount, item.total_amount
          ]
        );

        // Update product stock
        const [currentStock] = await connection.execute(
          'SELECT stock_quantity FROM products WHERE id = ?',
          [item.product_id]
        );

        const oldStock = parseFloat(currentStock[0].stock_quantity);
        const newStock = oldStock - item.quantity;

        await connection.execute(
          'UPDATE products SET stock_quantity = ? WHERE id = ?',
          [newStock, item.product_id]
        );

        // Add to stock ledger
        await connection.execute(
          `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                    reference_type, quantity_change, quantity_before, 
                                    quantity_after, notes, created_by)
           VALUES (?, ?, 'sale', ?, 'bill', ?, ?, ?, ?, ?)`,
          [
            req.shopId, item.product_id, billId,
            -item.quantity, oldStock, newStock,
            `Sale - Bill ${billNumber}`, req.user.id
          ]
        );
      }

      await connection.commit();
      connection.release();

      // Fetch complete bill data
      const [completeBill] = await pool.execute(
        `SELECT b.*, u.username as cashier_name 
         FROM bills b
         JOIN users u ON b.user_id = u.id
         WHERE b.id = ?`,
        [billId]
      );

      const [completeItems] = await pool.execute(
        'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id',
        [billId]
      );

      res.status(201).json({
        success: true,
        message: 'Bill created successfully',
        data: {
          ...completeBill[0],
          items: completeItems
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

// Cancel bill
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get bill
      const [bills] = await connection.execute(
        'SELECT * FROM bills WHERE id = ? AND shop_id = ? AND status = ?',
        [id, req.shopId, 'completed']
      );

      if (!bills.length) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Bill not found or already cancelled'
        });
      }

      // Get bill items
      const [items] = await connection.execute(
        'SELECT * FROM bill_items WHERE bill_id = ?',
        [id]
      );

      // Restore stock for each item
      for (const item of items) {
        const [currentStock] = await connection.execute(
          'SELECT stock_quantity FROM products WHERE id = ?',
          [item.product_id]
        );

        const oldStock = parseFloat(currentStock[0].stock_quantity);
        const newStock = oldStock + parseFloat(item.quantity);

        await connection.execute(
          'UPDATE products SET stock_quantity = ? WHERE id = ?',
          [newStock, item.product_id]
        );

        // Add to stock ledger
        await connection.execute(
          `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                    reference_type, quantity_change, quantity_before, 
                                    quantity_after, notes, created_by)
           VALUES (?, ?, 'return', ?, 'bill', ?, ?, ?, ?, ?)`,
          [
            req.shopId, item.product_id, id,
            parseFloat(item.quantity), oldStock, newStock,
            `Bill cancellation - ${reason || 'No reason provided'}`, req.user.id
          ]
        );
      }

      // Update bill status
      await connection.execute(
        'UPDATE bills SET status = ? WHERE id = ?',
        ['cancelled', id]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Bill cancelled successfully'
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

