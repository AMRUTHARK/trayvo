const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Get all hold bills
router.get('/', async (req, res, next) => {
  try {
    const [holdBills] = await pool.execute(
      `SELECT hb.id, hb.bill_data, hb.created_at, hb.updated_at, u.username as created_by
       FROM hold_bills hb
       JOIN users u ON hb.user_id = u.id
       WHERE hb.shop_id = ?
       ORDER BY hb.updated_at DESC`,
      [req.shopId]
    );

    res.json({
      success: true,
      data: holdBills
    });
  } catch (error) {
    next(error);
  }
});

// Create hold bill
router.post('/', [
  body('bill_data').isObject().withMessage('Bill data is required')
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

    const { bill_data } = req.body;

    const [result] = await pool.execute(
      'INSERT INTO hold_bills (shop_id, user_id, bill_data) VALUES (?, ?, ?)',
      [req.shopId, req.user.id, JSON.stringify(bill_data)]
    );

    res.status(201).json({
      success: true,
      message: 'Bill held successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
});

// Update hold bill
router.put('/:id', [
  body('bill_data').isObject().withMessage('Bill data is required')
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
    const { bill_data } = req.body;

    // Verify hold bill belongs to shop
    const [holdBills] = await pool.execute(
      'SELECT id FROM hold_bills WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!holdBills.length) {
      return res.status(404).json({
        success: false,
        message: 'Hold bill not found'
      });
    }

    await pool.execute(
      'UPDATE hold_bills SET bill_data = ? WHERE id = ?',
      [JSON.stringify(bill_data), id]
    );

    res.json({
      success: true,
      message: 'Hold bill updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete hold bill
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify hold bill belongs to shop
    const [holdBills] = await pool.execute(
      'SELECT id FROM hold_bills WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!holdBills.length) {
      return res.status(404).json({
        success: false,
        message: 'Hold bill not found'
      });
    }

    await pool.execute('DELETE FROM hold_bills WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Hold bill deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

