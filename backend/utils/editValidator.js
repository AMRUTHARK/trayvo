/**
 * Edit Transaction Validator
 * Validates if a transaction (bill/purchase) can be edited
 */

const pool = require('../config/database');

/**
 * Configuration for edit restrictions
 */
const EDIT_CONFIG = {
  GST_LOCK_PERIOD_DAYS: 30, // Days after which transactions are locked for GST filing
  CASHIER_EDIT_WINDOW_HOURS: 24, // Cashiers can only edit within X hours
  ALLOW_NEGATIVE_STOCK: false, // Whether to allow negative stock on edit
  REQUIRE_EDIT_REASON: true, // Force user to enter reason for edit
};

/**
 * Validate if a bill can be edited
 * @param {number} billId - Bill ID
 * @param {number} shopId - Shop ID
 * @param {object} user - User object with role and id
 * @param {object} connection - Database connection (optional, for transactions)
 * @returns {Promise<{canEdit: boolean, reason?: string, restrictions?: object}>}
 */
async function validateBillEdit(billId, shopId, user, connection = null) {
  const db = connection || pool;
  
  try {
    // Get bill
    const [bills] = await db.execute(
      `SELECT b.*, 
       (SELECT COUNT(*) FROM sales_returns sr WHERE sr.bill_id = b.id AND sr.status = 'completed') as return_count
       FROM bills b 
       WHERE b.id = ? AND b.shop_id = ?`,
      [billId, shopId]
    );

    if (!bills.length) {
      return { canEdit: false, reason: 'Bill not found' };
    }

    const bill = bills[0];

    // Check if bill is cancelled
    if (bill.status === 'cancelled') {
      return { canEdit: false, reason: 'Cannot edit a cancelled bill' };
    }

    // Check if bill is locked
    if (bill.is_locked) {
      return { 
        canEdit: false, 
        reason: bill.locked_reason || 'Bill is locked and cannot be edited',
        restrictions: { isLocked: true }
      };
    }

    // Check GST period lock
    const billDate = new Date(bill.created_at);
    const daysSinceBill = Math.floor((Date.now() - billDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceBill > EDIT_CONFIG.GST_LOCK_PERIOD_DAYS && user.role !== 'super_admin') {
      return { 
        canEdit: false, 
        reason: `Bill is older than ${EDIT_CONFIG.GST_LOCK_PERIOD_DAYS} days and is locked for GST filing`,
        restrictions: { gstPeriodLocked: true }
      };
    }

    // Check user permissions
    if (user.role === 'cashier') {
      const hoursSinceBill = Math.floor((Date.now() - billDate.getTime()) / (1000 * 60 * 60));
      if (hoursSinceBill > EDIT_CONFIG.CASHIER_EDIT_WINDOW_HOURS) {
        return { 
          canEdit: false, 
          reason: `Cashiers can only edit bills within ${EDIT_CONFIG.CASHIER_EDIT_WINDOW_HOURS} hours of creation`,
          restrictions: { timeRestricted: true }
        };
      }
    }

    // Check if returns exist
    const returnCount = parseInt(bill.return_count || 0);
    if (returnCount > 0) {
      // Get return details to understand restrictions
      const [returns] = await db.execute(
        `SELECT sri.bill_item_id, sri.quantity as returned_qty
         FROM sales_returns sr
         JOIN sales_return_items sri ON sr.id = sri.sales_return_id
         WHERE sr.bill_id = ? AND sr.status = 'completed'`,
        [billId]
      );

      return {
        canEdit: true,
        reason: `Bill has ${returnCount} return(s) associated. Some restrictions may apply.`,
        restrictions: {
          hasReturns: true,
          returnCount,
          returnedItems: returns // Items that were returned
        }
      };
    }

    return { canEdit: true };
  } catch (error) {
    console.error('Error validating bill edit:', error);
    throw error;
  }
}

/**
 * Validate if a purchase can be edited
 * @param {number} purchaseId - Purchase ID
 * @param {number} shopId - Shop ID
 * @param {object} user - User object with role and id
 * @param {object} connection - Database connection (optional)
 * @returns {Promise<{canEdit: boolean, reason?: string, restrictions?: object}>}
 */
async function validatePurchaseEdit(purchaseId, shopId, user, connection = null) {
  const db = connection || pool;
  
  try {
    // Get purchase
    const [purchases] = await db.execute(
      `SELECT p.*, 
       (SELECT COUNT(*) FROM purchase_returns pr WHERE pr.purchase_id = p.id AND pr.status = 'completed') as return_count
       FROM purchases p 
       WHERE p.id = ? AND p.shop_id = ?`,
      [purchaseId, shopId]
    );

    if (!purchases.length) {
      return { canEdit: false, reason: 'Purchase not found' };
    }

    const purchase = purchases[0];

    // Check if purchase is cancelled
    if (purchase.status === 'cancelled') {
      return { canEdit: false, reason: 'Cannot edit a cancelled purchase' };
    }

    // Check if purchase is locked
    if (purchase.is_locked) {
      return { 
        canEdit: false, 
        reason: purchase.locked_reason || 'Purchase is locked and cannot be edited',
        restrictions: { isLocked: true }
      };
    }

    // Check GST period lock
    const purchaseDate = new Date(purchase.created_at);
    const daysSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSincePurchase > EDIT_CONFIG.GST_LOCK_PERIOD_DAYS && user.role !== 'super_admin') {
      return { 
        canEdit: false, 
        reason: `Purchase is older than ${EDIT_CONFIG.GST_LOCK_PERIOD_DAYS} days and is locked for GST filing`,
        restrictions: { gstPeriodLocked: true }
      };
    }

    // Check user permissions
    if (user.role === 'cashier') {
      const hoursSincePurchase = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60));
      if (hoursSincePurchase > EDIT_CONFIG.CASHIER_EDIT_WINDOW_HOURS) {
        return { 
          canEdit: false, 
          reason: `Cashiers can only edit purchases within ${EDIT_CONFIG.CASHIER_EDIT_WINDOW_HOURS} hours of creation`,
          restrictions: { timeRestricted: true }
        };
      }
    }

    // Check if returns exist
    const returnCount = parseInt(purchase.return_count || 0);
    if (returnCount > 0) {
      // Get return details
      const [returns] = await db.execute(
        `SELECT pri.purchase_item_id, pri.quantity as returned_qty
         FROM purchase_returns pr
         JOIN purchase_return_items pri ON pr.id = pri.purchase_return_id
         WHERE pr.purchase_id = ? AND pr.status = 'completed'`,
        [purchaseId]
      );

      return {
        canEdit: true,
        reason: `Purchase has ${returnCount} return(s) associated. Some restrictions may apply.`,
        restrictions: {
          hasReturns: true,
          returnCount,
          returnedItems: returns
        }
      };
    }

    return { canEdit: true };
  } catch (error) {
    console.error('Error validating purchase edit:', error);
    throw error;
  }
}

/**
 * Validate stock availability for new items
 * @param {Array} items - Array of items with product_id and quantity
 * @param {number} shopId - Shop ID
 * @param {boolean} isSale - True for sales (decrease stock), false for purchases (increase stock)
 * @param {object} connection - Database connection (optional)
 * @returns {Promise<{valid: boolean, errors?: Array}>}
 */
async function validateStockAvailability(items, shopId, isSale, connection = null) {
  const db = connection || pool;
  const errors = [];

  for (const item of items) {
    const [products] = await db.execute(
      'SELECT stock_quantity FROM products WHERE id = ? AND shop_id = ?',
      [item.product_id, shopId]
    );

    if (!products.length) {
      errors.push(`Product ${item.product_id} not found`);
      continue;
    }

    const currentStock = parseFloat(products[0].stock_quantity);
    const quantityChange = parseFloat(item.quantity);

    if (isSale) {
      const newStock = currentStock - quantityChange;
      if (newStock < 0 && !EDIT_CONFIG.ALLOW_NEGATIVE_STOCK) {
        errors.push(`Insufficient stock for product ${item.product_id}. Available: ${currentStock}, Required: ${quantityChange}`);
      }
    }
    // For purchases, stock increases, so no validation needed (unless you want to check max stock)
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

module.exports = {
  validateBillEdit,
  validatePurchaseEdit,
  validateStockAvailability,
  EDIT_CONFIG
};

