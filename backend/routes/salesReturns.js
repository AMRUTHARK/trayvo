const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Generate unique sales return number
async function generateSalesReturnNumber(shopId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const [lastReturn] = await pool.execute(
    `SELECT sales_return_number FROM sales_returns 
     WHERE shop_id = ? AND sales_return_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [shopId, `SR-RET-${dateStr}-%`]
  );

  let sequence = 1;
  if (lastReturn.length > 0) {
    const lastSeq = parseInt(lastReturn[0].sales_return_number.split('-')[3]) || 0;
    sequence = lastSeq + 1;
  }

  return `SR-RET-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

// Get all sales returns with filters
router.get('/', async (req, res, next) => {
  try {
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date, status, bill_id, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT sr.id, sr.sales_return_number, sr.bill_id, sr.customer_name,
             sr.subtotal, sr.discount_amount, sr.gst_amount, sr.total_amount,
             sr.refund_mode, sr.status, sr.created_at, u.username as user_name, b.bill_number
      FROM sales_returns sr
      JOIN users u ON sr.user_id = u.id
      JOIN bills b ON sr.bill_id = b.id
      WHERE sr.shop_id = ?
    `;
    const params = [req.shopId];

    if (start_date) {
      query += ' AND DATE(sr.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(sr.created_at) <= ?';
      params.push(end_date);
    }

    if (status) {
      query += ' AND sr.status = ?';
      params.push(status);
    }

    if (bill_id) {
      query += ' AND sr.bill_id = ?';
      params.push(bill_id);
    }

    query += ` ORDER BY sr.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [returns] = await pool.execute(query, params);

    let countQuery = `
      SELECT COUNT(*) as total FROM sales_returns sr
      WHERE sr.shop_id = ?
    `;
    const countParams = [req.shopId];

    if (start_date) {
      countQuery += ' AND DATE(sr.created_at) >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ' AND DATE(sr.created_at) <= ?';
      countParams.push(end_date);
    }
    if (status) {
      countQuery += ' AND sr.status = ?';
      countParams.push(status);
    }
    if (bill_id) {
      countQuery += ' AND sr.bill_id = ?';
      countParams.push(bill_id);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: returns,
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

// Get single sales return with items
router.get('/:id', async (req, res, next) => {
  try {
    const [returns] = await pool.execute(
      `SELECT sr.*, u.username as user_name, u.full_name as user_full_name, b.bill_number
       FROM sales_returns sr
       JOIN users u ON sr.user_id = u.id
       JOIN bills b ON sr.bill_id = b.id
       WHERE sr.id = ? AND sr.shop_id = ?`,
      [req.params.id, req.shopId]
    );

    if (!returns.length) {
      return res.status(404).json({
        success: false,
        message: 'Sales return not found'
      });
    }

    const [items] = await pool.execute(
      `SELECT sri.*, p.name as product_name, p.sku, p.unit
       FROM sales_return_items sri
       JOIN products p ON sri.product_id = p.id
       WHERE sri.sales_return_id = ?
       ORDER BY sri.id`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...returns[0],
        items
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create sales return
router.post('/', [
  body('bill_id').isInt().withMessage('Bill ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.bill_item_id').isInt().withMessage('Valid bill item ID is required'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Valid quantity is required'),
  body('return_reason').optional().trim(),
  body('refund_mode').optional().isIn(['cash', 'upi', 'card', 'credit']).withMessage('Invalid refund mode'),
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
      bill_id,
      items,
      discount_amount,
      return_reason,
      refund_mode,
      refund_details,
      notes,
      status = 'completed'
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Verify bill exists and belongs to shop
      const [bills] = await connection.execute(
        'SELECT * FROM bills WHERE id = ? AND shop_id = ?',
        [bill_id, req.shopId]
      );

      if (!bills.length) {
        throw new Error('Bill not found');
      }

      const bill = bills[0];
      const customerName = bill.customer_name;
      const customerPhone = bill.customer_phone;

      // Generate return number
      const returnNumber = await generateSalesReturnNumber(req.shopId);

      // Calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const returnItems = [];

      for (const item of items) {
        // Get bill item details
        const [billItems] = await connection.execute(
          `SELECT bi.*, p.name as product_name, p.sku, p.unit, p.gst_rate
           FROM bill_items bi
           JOIN products p ON bi.product_id = p.id
           WHERE bi.id = ? AND bi.bill_id = ?`,
          [item.bill_item_id, bill_id]
        );

        if (!billItems.length) {
          throw new Error(`Bill item ${item.bill_item_id} not found`);
        }

        const billItem = billItems[0];
        const returnQty = parseFloat(item.quantity);

        if (returnQty > parseFloat(billItem.quantity)) {
          throw new Error(`Return quantity exceeds sold quantity for item ${billItem.product_name}`);
        }

        const unitPrice = parseFloat(billItem.unit_price);
        const gstRate = parseFloat(billItem.gst_rate) || 0;
        const itemSubtotal = unitPrice * returnQty;
        const itemDiscount = parseFloat(item.discount_amount || 0);
        const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
        const itemGst = (itemTotalAfterDiscount * gstRate) / 100;
        const itemTotal = itemTotalAfterDiscount + itemGst;

        subtotal += itemSubtotal;
        totalGst += itemGst;

        returnItems.push({
          bill_item_id: billItem.id,
          product_id: billItem.product_id,
          product_name: billItem.product_name,
          sku: billItem.sku,
          quantity: returnQty,
          unit: billItem.unit,
          unit_price: unitPrice,
          gst_rate: gstRate,
          gst_amount: itemGst,
          discount_amount: itemDiscount,
          total_amount: itemTotal
        });
      }

      // Apply return-level discount
      const returnDiscountAmount = discount_amount || 0;
      const finalSubtotal = subtotal - returnDiscountAmount;
      const totalAmount = finalSubtotal + totalGst;

      // Insert sales return
      const [returnResult] = await connection.execute(
        `INSERT INTO sales_returns (shop_id, sales_return_number, bill_id, customer_name, 
                                   customer_phone, user_id, subtotal, discount_amount, 
                                   gst_amount, total_amount, return_reason, refund_mode, 
                                   refund_details, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.shopId, returnNumber, bill_id, customerName, customerPhone, req.user.id,
          subtotal, returnDiscountAmount, totalGst, totalAmount,
          return_reason || null, refund_mode || 'cash',
          refund_details ? JSON.stringify(refund_details) : null,
          status, notes || null
        ]
      );

      const returnId = returnResult.insertId;

      // Create return items and update stock
      for (const item of returnItems) {
        await connection.execute(
          `INSERT INTO sales_return_items (sales_return_id, bill_item_id, product_id, 
                                          product_name, sku, quantity, unit, unit_price,
                                          gst_rate, gst_amount, discount_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            returnId, item.bill_item_id, item.product_id, item.product_name,
            item.sku, item.quantity, item.unit, item.unit_price, item.gst_rate,
            item.gst_amount, item.discount_amount, item.total_amount
          ]
        );

        if (status === 'completed') {
          // Update product stock (increase for sales return)
          const [currentStock] = await connection.execute(
            'SELECT stock_quantity FROM products WHERE id = ?',
            [item.product_id]
          );

          const oldStock = parseFloat(currentStock[0].stock_quantity);
          const newStock = oldStock + item.quantity;

          await connection.execute(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [newStock, item.product_id]
          );

          // Add to stock ledger
          await connection.execute(
            `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                      reference_type, quantity_change, quantity_before, 
                                      quantity_after, notes, created_by)
             VALUES (?, ?, 'return', ?, 'sales_return', ?, ?, ?, ?, ?)`,
            [
              req.shopId, item.product_id, returnId,
              item.quantity, oldStock, newStock,
              `Sales Return - ${returnNumber}`, req.user.id
            ]
          );
        }
      }

      await connection.commit();
      connection.release();

      // Fetch complete return data
      const [completeReturn] = await pool.execute(
        `SELECT sr.*, u.username as user_name, b.bill_number
         FROM sales_returns sr
         JOIN users u ON sr.user_id = u.id
         JOIN bills b ON sr.bill_id = b.id
         WHERE sr.id = ?`,
        [returnId]
      );

      const [completeItems] = await pool.execute(
        `SELECT sri.*, p.name as product_name, p.sku, p.unit
         FROM sales_return_items sri
         JOIN products p ON sri.product_id = p.id
         WHERE sri.sales_return_id = ?`,
        [returnId]
      );

      res.status(201).json({
        success: true,
        message: 'Sales return created successfully',
        data: {
          ...completeReturn[0],
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

module.exports = router;

