const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active
    const [users] = await pool.execute(
      `SELECT u.id, u.shop_id, u.username, u.role, u.is_active, s.is_active as shop_active
       FROM users u
       LEFT JOIN shops s ON u.shop_id = s.id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (!users.length || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user'
      });
    }

    // Check if shop is active (for admin and cashier roles)
    if (users[0].shop_id && users[0].role !== 'super_admin') {
      if (users[0].shop_active === 0 || users[0].shop_active === false) {
        return res.status(403).json({
          success: false,
          message: 'This shop has been disabled. Please contact your system administrator.'
        });
      }
    }

    req.user = {
      id: users[0].id,
      shopId: users[0].shop_id,
      username: users[0].username,
      role: users[0].role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };

