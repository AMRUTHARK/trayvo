const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Generate unique purchase return number
async function generatePurchaseReturnNumber(shopId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const [lastReturn] = await pool.execute(
    `SELECT purchase_return_number FROM purchase_returns 
     WHERE shop_id = ? AND purchase_return_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [shopId, `PR-RET-${dateStr}-%`]
  );

  let sequence = 1;
  if (lastReturn.length > 0) {
    const lastSeq = parseInt(lastReturn[0].purchase_return_number.split('-')[3]) || 0;
    sequence = lastSeq + 1;
  }

  return `PR-RET-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

// Get all purchase returns with filters
router.get('/', async (req, res, next) => {
  try {
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date, status, purchase_id, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT pr.id, pr.purchase_return_number, pr.purchase_id, pr.supplier_name,
             pr.subtotal, pr.discount_amount, pr.gst_amount, pr.total_amount,
             pr.status, pr.created_at, u.username as user_name, p.purchase_number
      FROM purchase_returns pr
      JOIN users u ON pr.user_id = u.id
      JOIN purchases p ON pr.purchase_id = p.id
      WHERE pr.shop_id = ?
    `;
    const params = [req.shopId];

    if (start_date) {
      query += ' AND DATE(pr.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(pr.created_at) <= ?';
      params.push(end_date);
    }

    if (status) {
      query += ' AND pr.status = ?';
      params.push(status);
    }

    if (purchase_id) {
      query += ' AND pr.purchase_id = ?';
      params.push(purchase_id);
    }

    query += ` ORDER BY pr.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [returns] = await pool.execute(query, params);

    let countQuery = `
      SELECT COUNT(*) as total FROM purchase_returns pr
      WHERE pr.shop_id = ?
    `;
    const countParams = [req.shopId];

    if (start_date) {
      countQuery += ' AND DATE(pr.created_at) >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ' AND DATE(pr.created_at) <= ?';
      countParams.push(end_date);
    }
    if (status) {
      countQuery += ' AND pr.status = ?';
      countParams.push(status);
    }
    if (purchase_id) {
      countQuery += ' AND pr.purchase_id = ?';
      countParams.push(purchase_id);
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

// Get single purchase return with items
router.get('/:id', async (req, res, next) => {
  try {
    const [returns] = await pool.execute(
      `SELECT pr.*, u.username as user_name, u.full_name as user_full_name, p.purchase_number
       FROM purchase_returns pr
       JOIN users u ON pr.user_id = u.id
       JOIN purchases p ON pr.purchase_id = p.id
       WHERE pr.id = ? AND pr.shop_id = ?`,
      [req.params.id, req.shopId]
    );

    if (!returns.length) {
      return res.status(404).json({
        success: false,
        message: 'Purchase return not found'
      });
    }

    const [items] = await pool.execute(
      `SELECT pri.*, pr.name as product_name, pr.sku, pr.unit
       FROM purchase_return_items pri
       JOIN products pr ON pri.product_id = pr.id
       WHERE pri.purchase_return_id = ?
       ORDER BY pri.id`,
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

// Create purchase return
router.post('/', [
  body('purchase_id').isInt().withMessage('Purchase ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.purchase_item_id').isInt().withMessage('Valid purchase item ID is required'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Valid quantity is required'),
  body('return_reason').optional().trim(),
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
      purchase_id,
      items,
      discount_amount,
      return_reason,
      notes,
      status = 'completed'
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Verify purchase exists and belongs to shop
      const [purchases] = await connection.execute(
        'SELECT * FROM purchases WHERE id = ? AND shop_id = ?',
        [purchase_id, req.shopId]
      );

      if (!purchases.length) {
        throw new Error('Purchase not found');
      }

      const purchase = purchases[0];
      const supplierName = purchase.supplier_name;

      // Generate return number
      const returnNumber = await generatePurchaseReturnNumber(req.shopId);

      // Calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const returnItems = [];

      for (const item of items) {
        // Get purchase item details
        const [purchaseItems] = await connection.execute(
          `SELECT pi.*, p.name as product_name, p.sku, p.unit, p.gst_rate
           FROM purchase_items pi
           JOIN products p ON pi.product_id = p.id
           WHERE pi.id = ? AND pi.purchase_id = ?`,
          [item.purchase_item_id, purchase_id]
        );

        if (!purchaseItems.length) {
          throw new Error(`Purchase item ${item.purchase_item_id} not found`);
        }

        const purchaseItem = purchaseItems[0];
        const returnQty = parseFloat(item.quantity);

        if (returnQty > parseFloat(purchaseItem.quantity)) {
          throw new Error(`Return quantity exceeds purchased quantity for item ${purchaseItem.product_name}`);
        }

        const unitPrice = parseFloat(purchaseItem.unit_price);
        const gstRate = parseFloat(purchaseItem.gst_rate) || 0;
        const itemSubtotal = unitPrice * returnQty;
        const itemDiscount = parseFloat(item.discount_amount || 0);
        const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
        const itemGst = (itemTotalAfterDiscount * gstRate) / 100;
        const itemTotal = itemTotalAfterDiscount + itemGst;

        subtotal += itemSubtotal;
        totalGst += itemGst;

        returnItems.push({
          purchase_item_id: purchaseItem.id,
          product_id: purchaseItem.product_id,
          product_name: purchaseItem.product_name,
          sku: purchaseItem.sku,
          quantity: returnQty,
          unit: purchaseItem.unit,
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

      // Insert purchase return
      const [returnResult] = await connection.execute(
        `INSERT INTO purchase_returns (shop_id, purchase_return_number, purchase_id, 
                                     supplier_name, user_id, subtotal, discount_amount, 
                                     gst_amount, total_amount, return_reason, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.shopId, returnNumber, purchase_id, supplierName, req.user.id,
          subtotal, returnDiscountAmount, totalGst, totalAmount,
          return_reason || null, status, notes || null
        ]
      );

      const returnId = returnResult.insertId;

      // Create return items and update stock
      for (const item of returnItems) {
        await connection.execute(
          `INSERT INTO purchase_return_items (purchase_return_id, purchase_item_id, product_id, 
                                             product_name, sku, quantity, unit, unit_price,
                                             gst_rate, gst_amount, discount_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            returnId, item.purchase_item_id, item.product_id, item.product_name,
            item.sku, item.quantity, item.unit, item.unit_price, item.gst_rate,
            item.gst_amount, item.discount_amount, item.total_amount
          ]
        );

        if (status === 'completed') {
          // Update product stock (decrease for purchase return)
          const [currentStock] = await connection.execute(
            'SELECT stock_quantity FROM products WHERE id = ?',
            [item.product_id]
          );

          const oldStock = parseFloat(currentStock[0].stock_quantity);
          const newStock = oldStock - item.quantity;

          if (newStock < 0) {
            throw new Error(`Cannot return: insufficient stock for product ${item.product_name}`);
          }

          await connection.execute(
            'UPDATE products SET stock_quantity = ? WHERE id = ?',
            [newStock, item.product_id]
          );

          // Add to stock ledger
          await connection.execute(
            `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                      reference_type, quantity_change, quantity_before, 
                                      quantity_after, notes, created_by)
             VALUES (?, ?, 'purchase', ?, 'purchase_return', ?, ?, ?, ?, ?)`,
            [
              req.shopId, item.product_id, returnId,
              -item.quantity, oldStock, newStock,
              `Purchase Return - ${returnNumber}`, req.user.id
            ]
          );
        }
      }

      await connection.commit();
      connection.release();

      // Fetch complete return data
      const [completeReturn] = await pool.execute(
        `SELECT pr.*, u.username as user_name, p.purchase_number
         FROM purchase_returns pr
         JOIN users u ON pr.user_id = u.id
         JOIN purchases p ON pr.purchase_id = p.id
         WHERE pr.id = ?`,
        [returnId]
      );

      const [completeItems] = await pool.execute(
        `SELECT pri.*, pr.name as product_name, pr.sku, pr.unit
         FROM purchase_return_items pri
         JOIN products pr ON pri.product_id = pr.id
         WHERE pri.purchase_return_id = ?`,
        [returnId]
      );

      res.status(201).json({
        success: true,
        message: 'Purchase return created successfully',
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

