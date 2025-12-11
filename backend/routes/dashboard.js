const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Get dashboard stats
router.get('/stats', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { period = 'today' } = req.query;

    let dateFilter = '';
    const params = [req.shopId];

    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    dateFilter = 'AND b.created_at >= ? AND b.created_at <= ?';
    params.push(startDate, endDate);

    // Revenue, Cost, Profit
    const [financialStats] = await pool.execute(
      `SELECT 
        COUNT(DISTINCT b.id) as total_bills,
        SUM(b.subtotal) as revenue,
        SUM(bi.quantity * p.cost_price) as cost,
        SUM(b.subtotal - bi.quantity * p.cost_price) as profit,
        SUM(b.discount_amount) as total_discount,
        SUM(b.gst_amount) as total_gst,
        SUM(b.total_amount) as total_revenue
       FROM bills b
       JOIN bill_items bi ON b.id = bi.bill_id
       JOIN products p ON bi.product_id = p.id
       WHERE b.shop_id = ? AND b.status = 'completed' ${dateFilter}`,
      params
    );

    // Items sold
    const [itemsSold] = await pool.execute(
      `SELECT SUM(bi.quantity) as items_sold
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.shop_id = ? AND b.status = 'completed' ${dateFilter}`,
      params
    );

    // Low stock count
    const [lowStock] = await pool.execute(
      `SELECT COUNT(*) as low_stock_count
       FROM products
       WHERE shop_id = ? AND is_active = TRUE 
       AND stock_quantity <= min_stock_level`,
      [req.shopId]
    );

    const stats = financialStats[0] || {};
    const revenue = parseFloat(stats.revenue || 0);
    const cost = parseFloat(stats.cost || 0);
    const profit = parseFloat(stats.profit || 0);
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        revenue: revenue,
        cost: cost,
        profit: profit,
        margin: parseFloat(margin),
        total_bills: parseInt(stats.total_bills || 0),
        items_sold: parseFloat(itemsSold[0]?.items_sold || 0),
        total_discount: parseFloat(stats.total_discount || 0),
        total_gst: parseFloat(stats.total_gst || 0),
        total_revenue: parseFloat(stats.total_revenue || 0),
        low_stock_count: parseInt(lowStock[0]?.low_stock_count || 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get revenue chart data
router.get('/revenue-chart', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { period = 'week', group_by = 'day' } = req.query;

    let dateFilter = '';
    let dateFormat = '%Y-%m-%d';
    const params = [req.shopId];

    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        if (group_by === 'day') dateFormat = '%Y-%m-%d';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        dateFormat = '%Y-%m';
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    dateFilter = 'AND b.created_at >= ? AND b.created_at <= ?';
    params.push(startDate, endDate);

    const [chartData] = await pool.execute(
      `SELECT 
        DATE_FORMAT(b.created_at, ?) as period,
        SUM(b.total_amount) as revenue,
        SUM(bi.quantity * p.cost_price) as cost,
        SUM(b.total_amount - bi.quantity * p.cost_price) as profit
       FROM bills b
       JOIN bill_items bi ON b.id = bi.bill_id
       JOIN products p ON bi.product_id = p.id
       WHERE b.shop_id = ? AND b.status = 'completed' ${dateFilter}
       GROUP BY period
       ORDER BY period`,
      [dateFormat, ...params]
    );

    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    next(error);
  }
});

// Get category sales chart
router.get('/category-chart', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const { period = 'month' } = req.query;

    let dateFilter = '';
    const params = [req.shopId];

    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    dateFilter = 'AND b.created_at >= ? AND b.created_at <= ?';
    params.push(startDate, endDate);

    const [categoryData] = await pool.execute(
      `SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(bi.total_amount) as revenue
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       JOIN products p ON bi.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE b.shop_id = ? AND b.status = 'completed' ${dateFilter}
       GROUP BY c.id, c.name
       ORDER BY revenue DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

