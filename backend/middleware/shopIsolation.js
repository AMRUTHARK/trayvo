const pool = require('../config/database');

// Middleware to ensure users can only access their own shop's data
// Super admin can bypass this restriction
const shopIsolation = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super admin can access all shops - bypass shop isolation
    if (req.user.role === 'super_admin') {
      // Super admin can specify shop_id in params/body/query, or use null for all shops
      const shopId = req.params.shopId || req.body.shop_id || req.query.shop_id;
      req.shopId = shopId ? parseInt(shopId) : null; // null means access all shops
      req.isSuperAdmin = true;
      return next();
    }

    // Regular users must have a shop_id
    if (!req.user.shopId) {
      return res.status(401).json({
        success: false,
        message: 'Shop association required'
      });
    }

    // If shop_id is provided in params or body, verify it matches user's shop
    const shopId = req.params.shopId || req.body.shop_id || req.query.shop_id;
    
    if (shopId && parseInt(shopId) !== req.user.shopId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot access other shop data'
      });
    }

    // Attach shop_id to request for use in queries
    req.shopId = req.user.shopId;
    req.isSuperAdmin = false;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = shopIsolation;

