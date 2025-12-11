const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get login history for current user (admin/cashier can see their own, super admin can see all)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, shopId, userId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        lh.id,
        lh.user_id,
        lh.shop_id,
        lh.username,
        lh.ip_address,
        lh.user_agent,
        lh.device_type,
        lh.browser,
        lh.os,
        lh.login_status,
        lh.failure_reason,
        lh.login_at,
        u.full_name,
        s.shop_name
      FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      LEFT JOIN shops s ON lh.shop_id = s.id
      WHERE 1=1
    `;
    const params = [];

    // Super admin can see all, others can only see their own shop's history
    if (req.user.role === 'super_admin') {
      if (shopId) {
        query += ' AND lh.shop_id = ?';
        params.push(parseInt(shopId));
      }
      if (userId) {
        query += ' AND lh.user_id = ?';
        params.push(parseInt(userId));
      }
    } else {
      // Regular users can only see their own login history
      query += ' AND lh.user_id = ?';
      params.push(req.user.userId);
    }

    query += ' ORDER BY lh.login_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [history] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM login_history lh WHERE 1=1';
    const countParams = [];

    if (req.user.role === 'super_admin') {
      if (shopId) {
        countQuery += ' AND lh.shop_id = ?';
        countParams.push(parseInt(shopId));
      }
      if (userId) {
        countQuery += ' AND lh.user_id = ?';
        countParams.push(parseInt(userId));
      }
    } else {
      countQuery += ' AND lh.user_id = ?';
      countParams.push(req.user.userId);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get login statistics (super admin only)
router.get('/stats', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // Total logins
    const [totalLogins] = await pool.execute(
      `SELECT COUNT(*) as total FROM login_history 
       WHERE login_at >= ?`,
      [daysAgo]
    );

    // Successful vs failed
    const [successStats] = await pool.execute(
      `SELECT 
        login_status,
        COUNT(*) as count
       FROM login_history
       WHERE login_at >= ?
       GROUP BY login_status`,
      [daysAgo]
    );

    // Top devices
    const [deviceStats] = await pool.execute(
      `SELECT 
        device_type,
        COUNT(*) as count
       FROM login_history
       WHERE login_at >= ?
       GROUP BY device_type
       ORDER BY count DESC
       LIMIT 10`,
      [daysAgo]
    );

    // Top browsers
    const [browserStats] = await pool.execute(
      `SELECT 
        browser,
        COUNT(*) as count
       FROM login_history
       WHERE login_at >= ?
       GROUP BY browser
       ORDER BY count DESC
       LIMIT 10`,
      [daysAgo]
    );

    // Logins per day
    const [dailyLogins] = await pool.execute(
      `SELECT 
        DATE(login_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN login_status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN login_status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM login_history
       WHERE login_at >= ?
       GROUP BY DATE(login_at)
       ORDER BY date DESC`,
      [daysAgo]
    );

    res.json({
      success: true,
      data: {
        totalLogins: totalLogins[0].total,
        successStats,
        deviceStats,
        browserStats,
        dailyLogins
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

