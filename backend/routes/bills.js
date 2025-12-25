const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const { logError, logDatabaseError } = require('../utils/errorLogger');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Generate unique bill number using shop's invoice number pattern
async function generateBillNumber(shopId, connection = null) {
  const dbConnection = connection || pool;
  
  try {
    // Get shop's invoice number configuration
    const [shops] = await dbConnection.execute(
      `SELECT invoice_number_prefix, invoice_number_pattern, invoice_sequence_number 
       FROM shops WHERE id = ?`,
      [shopId]
    );

    if (!shops.length) {
      throw new Error('Shop not found');
    }

    const shop = shops[0];
    const prefix = shop.invoice_number_prefix || 'BILL';
    const pattern = shop.invoice_number_pattern || '{PREFIX}-{DATE}-{SEQUENCE}';
    let sequenceNumber = shop.invoice_sequence_number || 0;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const dateStrWithDashes = `${day}-${month}-${year}`;

    // Generate invoice number based on pattern
    sequenceNumber += 1;
    let invoiceNumber = pattern
      .replace(/{PREFIX}/g, prefix)
      .replace(/{DATE}/g, dateStr)
      .replace(/{YEAR}/g, year)
      .replace(/{MONTH}/g, month)
      .replace(/{DAY}/g, day)
      .replace(/{SEQUENCE}/g, sequenceNumber)
      .replace(/{SEQUENCE4}/g, sequenceNumber.toString().padStart(4, '0'))
      .replace(/{SEQUENCE3}/g, sequenceNumber.toString().padStart(3, '0'))
      .replace(/{SEQUENCE2}/g, sequenceNumber.toString().padStart(2, '0'));

    // Check if invoice number already exists (handle collisions)
    let attempts = 0;
    const maxAttempts = 100;
    while (attempts < maxAttempts) {
      const [existing] = await dbConnection.execute(
        'SELECT id FROM bills WHERE shop_id = ? AND bill_number = ?',
        [shopId, invoiceNumber]
      );

      if (existing.length === 0) {
        // Update shop's sequence number
        await dbConnection.execute(
          'UPDATE shops SET invoice_sequence_number = ? WHERE id = ?',
          [sequenceNumber, shopId]
        );
        return invoiceNumber;
      }

      // Collision detected, increment and try again
      sequenceNumber += 1;
      invoiceNumber = pattern
        .replace(/{PREFIX}/g, prefix)
        .replace(/{DATE}/g, dateStr)
        .replace(/{YEAR}/g, year)
        .replace(/{MONTH}/g, month)
        .replace(/{DAY}/g, day)
        .replace(/{SEQUENCE}/g, sequenceNumber)
        .replace(/{SEQUENCE4}/g, sequenceNumber.toString().padStart(4, '0'))
        .replace(/{SEQUENCE3}/g, sequenceNumber.toString().padStart(3, '0'))
        .replace(/{SEQUENCE2}/g, sequenceNumber.toString().padStart(2, '0'));
      attempts++;
    }

    throw new Error('Failed to generate unique invoice number after multiple attempts');
  } catch (error) {
    // Fallback to default pattern if anything fails
    console.error('Error generating invoice number with pattern, using fallback:', error);
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const [lastBill] = await dbConnection.execute(
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
             b.discount_amount, b.gst_amount, b.total_amount, b.round_off, b.payment_mode, 
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
      `SELECT bi.*, p.name as product_name, p.sku, p.unit, COALESCE(bi.hsn_code, p.hsn_code) as hsn_code
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
      customer_name, customer_phone, customer_email, customer_gstin, customer_address,
      shipping_address,
      items, discount_amount, discount_percent,
      payment_mode, payment_details, notes,
      include_gst = true  // Default to true for backward compatibility
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Generate bill number using shop's pattern
      const billNumber = await generateBillNumber(req.shopId, connection);

      // Calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const billItems = [];

      for (const item of items) {
        const [products] = await connection.execute(
          `SELECT id, name, sku, hsn_code, unit, selling_price, gst_rate, stock_quantity 
           FROM products 
           WHERE id = ? AND shop_id = ? AND is_active = TRUE`,
          [item.product_id, req.shopId]
        );

        if (!products.length) {
          const error = new Error(`Product ${item.product_id} not found`);
          await logError({
            error_type: 'bill_generation',
            error_level: 'error',
            error_message: `Product not found during bill creation: ${item.product_id}`,
            error_stack: error.stack,
            request: req,
            user: req.user,
            notes: `Shop ID: ${req.shopId}, Bill Number: ${billNumber || 'N/A'}`
          });
          throw error;
        }

        const product = products[0];

        // Check stock availability
        if (parseFloat(product.stock_quantity) < parseFloat(item.quantity)) {
          const error = new Error(`Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`);
          await logError({
            error_type: 'bill_generation',
            error_level: 'warning',
            error_message: `Insufficient stock for product ${product.name} (ID: ${product.id})`,
            error_stack: error.stack,
            request: req,
            user: req.user,
            notes: `Available: ${product.stock_quantity}, Requested: ${item.quantity}, Shop ID: ${req.shopId}`
          });
          throw error;
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
          hsn_code: product.hsn_code || null,
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
      const totalBeforeRound = finalSubtotal + totalGst;
      
      // Round off to nearest whole number for easier payment
      const roundedTotal = Math.round(totalBeforeRound);
      const roundOff = roundedTotal - totalBeforeRound;

      // Create bill with new fields
      const [billResult] = await connection.execute(
        `INSERT INTO bills (shop_id, bill_number, user_id, customer_name, customer_phone, 
                          customer_email, customer_gstin, customer_address, shipping_address,
                          subtotal, discount_amount, discount_percent, 
                          gst_amount, total_amount, round_off, payment_mode, payment_details, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [
          req.shopId, billNumber, req.user.id,
          customer_name || null, customer_phone || null, customer_email || null,
          customer_gstin || null, customer_address || null,
          shipping_address || customer_address || null, // Default shipping to customer address if not provided
          subtotal, billDiscountAmount, discount_percent || 0,
          totalGst, roundedTotal, roundOff, payment_mode,
          payment_details ? JSON.stringify(payment_details) : null,
          notes || null
        ]
      );

      const billId = billResult.insertId;

      // Create bill items and update stock
      for (const item of billItems) {
        await connection.execute(
          `INSERT INTO bill_items (bill_id, product_id, product_name, sku, hsn_code, quantity, unit, 
                                  unit_price, gst_rate, gst_amount, discount_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            billId, item.product_id, item.product_name, item.sku, item.hsn_code || null,
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

      // Fetch complete bill data with items
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

