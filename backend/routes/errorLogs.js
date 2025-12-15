const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All error log routes require authentication and superadmin authorization
router.use(authenticate);
router.use(authorize('super_admin'));

// Get error logs with filters
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      error_type,
      error_level,
      resolved,
      shop_id,
      user_id,
      start_date,
      end_date
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT 
        el.id,
        el.error_type,
        el.error_level,
        el.error_message,
        el.request_path,
        el.request_method,
        el.user_id,
        el.shop_id,
        el.ip_address,
        el.status_code,
        el.resolved,
        el.resolved_at,
        el.resolved_by,
        el.notes,
        el.created_at,
        u.username as user_username,
        s.shop_name
      FROM error_logs el
      LEFT JOIN users u ON el.user_id = u.id
      LEFT JOIN shops s ON el.shop_id = s.id
      WHERE 1=1
    `;
    const params = [];

    // Apply filters
    if (error_type) {
      query += ' AND el.error_type = ?';
      params.push(error_type);
    }

    if (error_level) {
      query += ' AND el.error_level = ?';
      params.push(error_level);
    }

    if (resolved !== undefined) {
      query += ' AND el.resolved = ?';
      params.push(resolved === 'true' || resolved === true ? 1 : 0);
    }

    if (shop_id) {
      query += ' AND el.shop_id = ?';
      params.push(parseInt(shop_id));
    }

    if (user_id) {
      query += ' AND el.user_id = ?';
      params.push(parseInt(user_id));
    }

    if (start_date) {
      query += ' AND el.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND el.created_at <= ?';
      params.push(end_date);
    }

    // Order by most recent first
    query += ' ORDER BY el.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [errors] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM error_logs el WHERE 1=1';
    const countParams = [];

    if (error_type) {
      countQuery += ' AND el.error_type = ?';
      countParams.push(error_type);
    }

    if (error_level) {
      countQuery += ' AND el.error_level = ?';
      countParams.push(error_level);
    }

    if (resolved !== undefined) {
      countQuery += ' AND el.resolved = ?';
      countParams.push(resolved === 'true' || resolved === true ? 1 : 0);
    }

    if (shop_id) {
      countQuery += ' AND el.shop_id = ?';
      countParams.push(parseInt(shop_id));
    }

    if (user_id) {
      countQuery += ' AND el.user_id = ?';
      countParams.push(parseInt(user_id));
    }

    if (start_date) {
      countQuery += ' AND el.created_at >= ?';
      countParams.push(start_date);
    }

    if (end_date) {
      countQuery += ' AND el.created_at <= ?';
      countParams.push(end_date);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    res.json({
      success: true,
      data: errors,
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

// Get single error log with full details
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [errors] = await pool.execute(
      `SELECT 
        el.*,
        u.username as user_username,
        u.email as user_email,
        s.shop_name,
        resolver.username as resolved_by_username
      FROM error_logs el
      LEFT JOIN users u ON el.user_id = u.id
      LEFT JOIN shops s ON el.shop_id = s.id
      LEFT JOIN users resolver ON el.resolved_by = resolver.id
      WHERE el.id = ?`,
      [id]
    );

    if (!errors.length) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    // Parse JSON fields
    const error = errors[0];
    if (error.request_body) {
      try {
        error.request_body = JSON.parse(error.request_body);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
    if (error.request_query) {
      try {
        error.request_query = JSON.parse(error.request_query);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
    if (error.request_headers) {
      try {
        error.request_headers = JSON.parse(error.request_headers);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    res.json({
      success: true,
      data: error
    });
  } catch (error) {
    next(error);
  }
});

// Mark error as resolved
router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Check if error exists
    const [errors] = await pool.execute(
      'SELECT id FROM error_logs WHERE id = ?',
      [id]
    );

    if (!errors.length) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    // Update error log
    await pool.execute(
      `UPDATE error_logs 
       SET resolved = TRUE, resolved_at = NOW(), resolved_by = ?, notes = ?
       WHERE id = ?`,
      [req.user.id, notes || null, id]
    );

    res.json({
      success: true,
      message: 'Error log marked as resolved'
    });
  } catch (error) {
    next(error);
  }
});

// Mark error as unresolved
router.patch('/:id/unresolve', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if error exists
    const [errors] = await pool.execute(
      'SELECT id FROM error_logs WHERE id = ?',
      [id]
    );

    if (!errors.length) {
      return res.status(404).json({
        success: false,
        message: 'Error log not found'
      });
    }

    // Update error log
    await pool.execute(
      `UPDATE error_logs 
       SET resolved = FALSE, resolved_at = NULL, resolved_by = NULL
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Error log marked as unresolved'
    });
  } catch (error) {
    next(error);
  }
});

// Get error statistics
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get statistics
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_errors,
        SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) as unresolved_errors,
        SUM(CASE WHEN error_level = 'critical' THEN 1 ELSE 0 END) as critical_errors,
        SUM(CASE WHEN error_level = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN error_level = 'warning' THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN error_type = 'authentication' THEN 1 ELSE 0 END) as auth_errors,
        SUM(CASE WHEN error_type = 'database' THEN 1 ELSE 0 END) as database_errors,
        SUM(CASE WHEN error_type = 'validation' THEN 1 ELSE 0 END) as validation_errors
      FROM error_logs
      ${whereClause}`,
      params
    );

    // Get errors by type
    const [byType] = await pool.execute(
      `SELECT error_type, COUNT(*) as count
       FROM error_logs
       ${whereClause}
       GROUP BY error_type
       ORDER BY count DESC`,
      params
    );

    // Get errors by level
    const [byLevel] = await pool.execute(
      `SELECT error_level, COUNT(*) as count
       FROM error_logs
       ${whereClause}
       GROUP BY error_level
       ORDER BY count DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        summary: stats[0],
        by_type: byType,
        by_level: byLevel
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

