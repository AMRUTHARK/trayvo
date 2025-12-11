const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Sales report
router.get('/sales', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date, group_by = 'day' } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    let dateFormat = '%Y-%m-%d';
    if (group_by === 'month') {
      dateFormat = '%Y-%m';
    } else if (group_by === 'year') {
      dateFormat = '%Y';
    }

    const [sales] = await pool.execute(
      `SELECT 
        DATE_FORMAT(created_at, ?) as period,
        COUNT(*) as total_bills,
        SUM(subtotal) as total_subtotal,
        SUM(discount_amount) as total_discount,
        SUM(gst_amount) as total_gst,
        SUM(total_amount) as total_revenue
       FROM bills
       WHERE shop_id = ? AND status = 'completed'
       AND DATE(created_at) >= ? AND DATE(created_at) <= ?
       GROUP BY period
       ORDER BY period`,
      [dateFormat, req.shopId, start_date, end_date]
    );

    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    next(error);
  }
});

// GST report
router.get('/gst', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const [gstReport] = await pool.execute(
      `SELECT 
        bi.gst_rate,
        SUM(bi.quantity) as total_quantity,
        SUM(bi.unit_price * bi.quantity) as total_before_gst,
        SUM(bi.gst_amount) as total_gst,
        SUM(bi.total_amount) as total_after_gst
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.shop_id = ? AND b.status = 'completed'
       AND DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
       GROUP BY bi.gst_rate
       ORDER BY bi.gst_rate`,
      [req.shopId, start_date, end_date]
    );

    res.json({
      success: true,
      data: gstReport
    });
  } catch (error) {
    next(error);
  }
});

// Profit/Loss report
router.get('/profit-loss', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const [profitLoss] = await pool.execute(
      `SELECT 
        DATE(b.created_at) as date,
        COUNT(DISTINCT b.id) as total_bills,
        SUM(b.subtotal) as total_revenue,
        SUM(bi.quantity * p.cost_price) as total_cost,
        SUM(b.subtotal - bi.quantity * p.cost_price) as total_profit,
        SUM(b.discount_amount) as total_discount,
        SUM(b.gst_amount) as total_gst
       FROM bills b
       JOIN bill_items bi ON b.id = bi.bill_id
       JOIN products p ON bi.product_id = p.id
       WHERE b.shop_id = ? AND b.status = 'completed'
       AND DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
       GROUP BY DATE(b.created_at)
       ORDER BY date`,
      [req.shopId, start_date, end_date]
    );

    res.json({
      success: true,
      data: profitLoss
    });
  } catch (error) {
    next(error);
  }
});

// Category-wise sales
router.get('/category-sales', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const [categorySales] = await pool.execute(
      `SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        COUNT(DISTINCT b.id) as total_bills,
        SUM(bi.quantity) as total_quantity_sold,
        SUM(bi.total_amount) as total_revenue,
        SUM(bi.quantity * p.cost_price) as total_cost,
        SUM(bi.total_amount - bi.quantity * p.cost_price) as total_profit
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       JOIN products p ON bi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE b.shop_id = ? AND b.status = 'completed'
       AND DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
       GROUP BY c.id, c.name
       ORDER BY total_revenue DESC`,
      [req.shopId, start_date, end_date]
    );

    res.json({
      success: true,
      data: categorySales
    });
  } catch (error) {
    next(error);
  }
});

// Payment mode report
router.get('/payment-mode', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const [paymentReport] = await pool.execute(
      `SELECT 
        payment_mode,
        COUNT(*) as total_bills,
        SUM(total_amount) as total_amount
       FROM bills
       WHERE shop_id = ? AND status = 'completed'
       AND DATE(created_at) >= ? AND DATE(created_at) <= ?
       GROUP BY payment_mode
       ORDER BY total_amount DESC`,
      [req.shopId, start_date, end_date]
    );

    res.json({
      success: true,
      data: paymentReport
    });
  } catch (error) {
    next(error);
  }
});

// Top selling products
router.get('/top-products', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { start_date, end_date, limit = 10 } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Use template literal for LIMIT to avoid prepared statement issues
    const limitNum = parseInt(limit) || 10;
    const [topProducts] = await pool.execute(
      `SELECT 
        p.id, p.name, p.sku,
        SUM(bi.quantity) as total_quantity_sold,
        SUM(bi.total_amount) as total_revenue,
        COUNT(DISTINCT bi.bill_id) as times_sold
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       JOIN products p ON bi.product_id = p.id
       WHERE b.shop_id = ? AND b.status = 'completed'
       AND DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?
       GROUP BY p.id, p.name, p.sku
       ORDER BY total_quantity_sold DESC
       LIMIT ${limitNum}`,
      [req.shopId, start_date, end_date]
    );

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

