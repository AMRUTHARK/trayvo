const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const editValidator = require('../utils/editValidator');
const editHelper = require('../utils/editHelper');
const stockManager = require('../utils/stockManager');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Generate unique purchase number
async function generatePurchaseNumber(shopId) {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  const [lastPurchase] = await pool.execute(
    `SELECT purchase_number FROM purchases 
     WHERE shop_id = ? AND purchase_number LIKE ? 
     ORDER BY id DESC LIMIT 1`,
    [shopId, `PUR-${dateStr}-%`]
  );

  let sequence = 1;
  if (lastPurchase.length > 0) {
    const lastSeq = parseInt(lastPurchase[0].purchase_number.split('-')[2]) || 0;
    sequence = lastSeq + 1;
  }

  return `PUR-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

// Get all purchases with filters
router.get('/', async (req, res, next) => {
  try {
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date, status, supplier_name, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT p.id, p.purchase_number, p.supplier_name, p.supplier_phone, 
             p.subtotal, p.discount_amount, p.gst_amount, p.total_amount, 
             p.payment_mode, p.status, p.created_at, u.username as user_name
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      WHERE p.shop_id = ?
    `;
    const params = [req.shopId];

    if (start_date) {
      query += ' AND DATE(p.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(p.created_at) <= ?';
      params.push(end_date);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (supplier_name) {
      query += ' AND p.supplier_name LIKE ?';
      params.push(`%${supplier_name}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const [purchases] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM purchases WHERE shop_id = ?';
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
    if (supplier_name) {
      countQuery += ' AND supplier_name LIKE ?';
      countParams.push(`%${supplier_name}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: purchases,
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

// Get single purchase with items
router.get('/:id', async (req, res, next) => {
  try {
    const [purchases] = await pool.execute(
      `SELECT p.*, u.username as user_name, u.full_name as user_full_name
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ? AND p.shop_id = ?`,
      [req.params.id, req.shopId]
    );

    if (!purchases.length) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    const [items] = await pool.execute(
      `SELECT pi.*, pr.name as product_name, pr.sku, pr.unit
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...purchases[0],
        items
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create purchase
router.post('/', [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt().withMessage('Valid product ID is required'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Valid quantity is required'),
  body('payment_mode').optional().isIn(['cash', 'upi', 'card', 'credit']).withMessage('Invalid payment mode'),
  body('supplier_name').optional().trim(),
  body('supplier_phone').optional().trim(),
  body('supplier_email').optional().trim().isEmail().withMessage('Invalid supplier email'),
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
      supplier_name, supplier_phone, supplier_email, supplier_address,
      items, discount_amount, discount_percent,
      payment_mode, payment_details, notes,
      include_gst = true,
      status = 'completed'
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Generate purchase number
      const purchaseNumber = await generatePurchaseNumber(req.shopId);

      // Calculate totals
      let subtotal = 0;
      let totalGst = 0;
      const purchaseItems = [];

      for (const item of items) {
        const [products] = await connection.execute(
          `SELECT id, name, sku, unit, cost_price, gst_rate, stock_quantity 
           FROM products 
           WHERE id = ? AND shop_id = ? AND is_active = TRUE`,
          [item.product_id, req.shopId]
        );

        if (!products.length) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        const product = products[0];
        const unitPrice = parseFloat(item.unit_price || product.cost_price);
        const quantity = parseFloat(item.quantity);
        const gstRate = parseFloat(product.gst_rate) || 0;
        const itemSubtotal = unitPrice * quantity;
        const itemDiscount = parseFloat(item.discount_amount || 0);
        const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
        const itemGst = include_gst ? (itemTotalAfterDiscount * gstRate) / 100 : 0;
        const itemTotal = itemTotalAfterDiscount + itemGst;

        subtotal += itemSubtotal;
        totalGst += itemGst;

        purchaseItems.push({
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

      // Apply purchase-level discount
      const purchaseDiscountAmount = discount_amount || (subtotal * (discount_percent || 0) / 100);
      const finalSubtotal = subtotal - purchaseDiscountAmount;
      const finalGst = include_gst ? totalGst : 0;
      const totalAmount = finalSubtotal + finalGst;

      // Insert purchase
      const [purchaseResult] = await connection.execute(
        `INSERT INTO purchases (shop_id, purchase_number, supplier_name, supplier_phone, 
                               supplier_email, supplier_address, user_id, subtotal, 
                               discount_amount, discount_percent, gst_amount, total_amount, 
                               payment_mode, payment_details, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.shopId, purchaseNumber, supplier_name || null, supplier_phone || null,
          supplier_email || null, supplier_address || null, req.user.id,
          subtotal, purchaseDiscountAmount, discount_percent || 0,
          finalGst, totalAmount, payment_mode || 'cash',
          payment_details ? JSON.stringify(payment_details) : null,
          status, notes || null
        ]
      );

      const purchaseId = purchaseResult.insertId;

      // Create purchase items and update stock
      for (const item of purchaseItems) {
        await connection.execute(
          `INSERT INTO purchase_items (purchase_id, product_id, product_name, sku, quantity, unit, 
                                     unit_price, gst_rate, gst_amount, discount_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            purchaseId, item.product_id, item.product_name, item.sku,
            item.quantity, item.unit, item.unit_price, item.gst_rate,
            item.gst_amount, item.discount_amount, item.total_amount
          ]
        );

        if (status === 'completed') {
          // Update product stock (increase for purchase)
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
             VALUES (?, ?, 'purchase', ?, 'purchase', ?, ?, ?, ?, ?)`,
            [
              req.shopId, item.product_id, purchaseId,
              item.quantity, oldStock, newStock,
              `Purchase - ${purchaseNumber}`, req.user.id
            ]
          );
        }
      }

      await connection.commit();
      connection.release();

      // Fetch complete purchase data
      const [completePurchase] = await pool.execute(
        `SELECT p.*, u.username as user_name 
         FROM purchases p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
        [purchaseId]
      );

      const [completeItems] = await pool.execute(
        `SELECT pi.*, pr.name as product_name, pr.sku, pr.unit
         FROM purchase_items pi
         JOIN products pr ON pi.product_id = pr.id
         WHERE pi.purchase_id = ?`,
        [purchaseId]
      );

      res.status(201).json({
        success: true,
        message: 'Purchase created successfully',
        data: {
          ...completePurchase[0],
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

// Cancel purchase
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get purchase
      const [purchases] = await connection.execute(
        'SELECT * FROM purchases WHERE id = ? AND shop_id = ? AND status = ?',
        [id, req.shopId, 'completed']
      );

      if (!purchases.length) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Purchase not found or already cancelled'
        });
      }

      // Get purchase items
      const [items] = await connection.execute(
        'SELECT * FROM purchase_items WHERE purchase_id = ?',
        [id]
      );

      // Reverse stock for each item
      for (const item of items) {
        const [currentStock] = await connection.execute(
          'SELECT stock_quantity FROM products WHERE id = ?',
          [item.product_id]
        );

        const oldStock = parseFloat(currentStock[0].stock_quantity);
        const newStock = oldStock - parseFloat(item.quantity);

        if (newStock < 0) {
          throw new Error(`Cannot cancel purchase: insufficient stock for product ${item.product_id}`);
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
           VALUES (?, ?, 'purchase', ?, 'purchase', ?, ?, ?, ?, ?)`,
          [
            req.shopId, item.product_id, id,
            -parseFloat(item.quantity), oldStock, newStock,
            `Purchase cancellation - ${reason || 'No reason provided'}`, req.user.id
          ]
        );
      }

      // Update purchase status
      await connection.execute(
        'UPDATE purchases SET status = ? WHERE id = ?',
        ['cancelled', id]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Purchase cancelled successfully'
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

// Get edit preview for a purchase
router.get('/:id/edit-preview', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate if purchase can be edited
    const validation = await editValidator.validatePurchaseEdit(id, req.shopId, req.user);

    if (!validation.canEdit) {
      return res.status(400).json({
        success: false,
        message: validation.reason,
        restrictions: validation.restrictions
      });
    }

    // Get purchase data
    const [purchases] = await pool.execute(
      `SELECT p.*, u.username as user_name 
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ? AND p.shop_id = ?`,
      [id, req.shopId]
    );

    if (!purchases.length) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    const [items] = await pool.execute(
      `SELECT pi.*, pr.name as product_name, pr.sku, pr.unit
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...purchases[0],
        items,
        canEdit: true,
        restrictions: validation.restrictions
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update/edit a purchase
router.put('/:id', [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt().withMessage('Valid product ID is required'),
  body('items.*.quantity').isFloat({ min: 0.001 }).withMessage('Valid quantity is required'),
  body('payment_mode').optional().isIn(['cash', 'upi', 'card', 'credit']).withMessage('Invalid payment mode'),
  body('edit_reason').optional().trim()
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

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Validate if purchase can be edited
      const validation = await editValidator.validatePurchaseEdit(id, req.shopId, req.user, connection);
      
      if (!validation.canEdit) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: validation.reason,
          restrictions: validation.restrictions
        });
      }

      // Get original purchase data for history
      const [originalPurchases] = await connection.execute(
        'SELECT * FROM purchases WHERE id = ? AND shop_id = ?',
        [id, req.shopId]
      );

      if (!originalPurchases.length) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Purchase not found'
        });
      }

      const originalPurchase = originalPurchases[0];
      const purchaseNumber = originalPurchase.purchase_number;

      // Get original items for history
      const [originalItems] = await connection.execute(
        'SELECT * FROM purchase_items WHERE purchase_id = ?',
        [id]
      );

      // Prepare edit history data
      const originalData = {
        purchase: originalPurchase,
        items: originalItems
      };

      // Get new data from request
      const {
        supplier_name, supplier_phone, supplier_email, supplier_address,
        items, discount_amount, discount_percent,
        payment_mode, payment_details, notes,
        status = 'completed',
        edit_reason
      } = req.body;

      // Calculate totals for new items
      let subtotal = 0;
      let totalGst = 0;
      const purchaseItems = [];

      for (const item of items) {
        const [products] = await connection.execute(
          `SELECT id, name, sku, unit, cost_price, gst_rate 
           FROM products 
           WHERE id = ? AND shop_id = ? AND is_active = TRUE`,
          [item.product_id, req.shopId]
        );

        if (!products.length) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        const product = products[0];
        const unitPrice = parseFloat(item.unit_price || product.cost_price);
        const quantity = parseFloat(item.quantity);
        const gstRate = parseFloat(item.gst_rate || product.gst_rate || 0);
        const itemSubtotal = unitPrice * quantity;
        const itemDiscount = parseFloat(item.discount_amount || 0);
        const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
        const itemGst = (itemTotalAfterDiscount * gstRate) / 100;
        const itemTotal = itemTotalAfterDiscount + itemGst;

        subtotal += itemSubtotal;
        totalGst += itemGst;

        purchaseItems.push({
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

      const billDiscountAmount = discount_amount || (subtotal * (discount_percent || 0) / 100);
      const finalSubtotal = subtotal - billDiscountAmount;
      const totalAmount = finalSubtotal + totalGst;

      // Create edit history entry
      const changesSummary = editHelper.generateChangesSummary(
        { ...originalPurchase, items: originalItems },
        { supplier_name, items, discount_amount, discount_percent }
      );

      await editHelper.createEditHistory(
        'purchase',
        id,
        req.user.id,
        edit_reason,
        originalData,
        changesSummary,
        connection
      );

      // Reverse old stock (only if purchase was completed)
      if (originalPurchase.status === 'completed') {
        await stockManager.reversePurchaseStock(
          id,
          req.shopId,
          req.user.id,
          `Purchase edit reversal - ${purchaseNumber}`,
          connection
        );
      }

      // Delete old items
      await connection.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);

      // Insert new items
      for (const item of purchaseItems) {
        await connection.execute(
          `INSERT INTO purchase_items (purchase_id, product_id, product_name, sku, quantity, unit, 
                                     unit_price, gst_rate, gst_amount, discount_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, item.product_id, item.product_name, item.sku,
            item.quantity, item.unit, item.unit_price, item.gst_rate,
            item.gst_amount, item.discount_amount, item.total_amount
          ]
        );
      }

      // Apply new stock (only if status is completed)
      if (status === 'completed') {
        await stockManager.applyPurchaseStock(purchaseItems, id, req.shopId, req.user.id, purchaseNumber, connection);
      }

      // Update purchase
      await connection.execute(
        `UPDATE purchases SET 
         supplier_name = ?, supplier_phone = ?, supplier_email = ?, supplier_address = ?,
         subtotal = ?, discount_amount = ?, discount_percent = ?,
         gst_amount = ?, total_amount = ?,
         payment_mode = ?, payment_details = ?, notes = ?, status = ?,
         last_edited_at = NOW(), last_edited_by = ?, edit_count = edit_count + 1
         WHERE id = ?`,
        [
          supplier_name || null, supplier_phone || null, supplier_email || null, supplier_address || null,
          subtotal, billDiscountAmount, discount_percent || 0,
          totalGst, totalAmount,
          payment_mode || originalPurchase.payment_mode,
          payment_details ? JSON.stringify(payment_details) : originalPurchase.payment_details,
          notes || null, status,
          req.user.id,
          id
        ]
      );

      await connection.commit();
      connection.release();

      // Fetch updated purchase
      const [updatedPurchases] = await pool.execute(
        `SELECT p.*, u.username as user_name 
         FROM purchases p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
        [id]
      );

      const [updatedItems] = await pool.execute(
        `SELECT pi.*, pr.name as product_name, pr.sku, pr.unit
         FROM purchase_items pi
         JOIN products pr ON pi.product_id = pr.id
         WHERE pi.purchase_id = ?
         ORDER BY pi.id`,
        [id]
      );

      res.json({
        success: true,
        message: 'Purchase updated successfully',
        data: {
          ...updatedPurchases[0],
          items: updatedItems
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

// Lock a purchase (prevent editing)
router.post('/:id/lock', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can lock purchases'
      });
    }

    const [result] = await pool.execute(
      `UPDATE purchases SET 
       is_locked = TRUE, 
       locked_reason = ?,
       locked_at = NOW(),
       locked_by = ?
       WHERE id = ? AND shop_id = ?`,
      [reason || 'Locked by administrator', req.user.id, id, req.shopId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      message: 'Purchase locked successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Unlock a purchase (allow editing)
router.post('/:id/unlock', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can unlock purchases'
      });
    }

    const [result] = await pool.execute(
      `UPDATE purchases SET 
       is_locked = FALSE, 
       locked_reason = NULL,
       locked_at = NULL,
       locked_by = NULL
       WHERE id = ? AND shop_id = ?`,
      [id, req.shopId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      message: 'Purchase unlocked successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

