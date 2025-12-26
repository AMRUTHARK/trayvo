/**
 * Edit Transaction Helper
 * Main logic for editing bills and purchases
 */

const stockManager = require('./stockManager');
const editValidator = require('./editValidator');

/**
 * Create edit history entry
 * @param {string} transactionType - 'bill' or 'purchase'
 * @param {number} transactionId - Transaction ID
 * @param {number} userId - User ID
 * @param {string} reason - Edit reason
 * @param {object} originalData - Original transaction data
 * @param {object} changesSummary - Summary of changes
 * @param {object} connection - Database connection
 * @returns {Promise<number>} Edit history ID
 */
async function createEditHistory(transactionType, transactionId, userId, reason, originalData, changesSummary, connection) {
  try {
    // Get current edit count
    const tableName = transactionType === 'bill' ? 'bills' : 'purchases';
    const [transactions] = await connection.execute(
      `SELECT edit_count FROM ${tableName} WHERE id = ?`,
      [transactionId]
    );

    const editNumber = (transactions[0]?.edit_count || 0) + 1;

    const [result] = await connection.execute(
      `INSERT INTO transaction_edit_history 
       (transaction_type, transaction_id, edit_number, edited_by, edit_reason, changes_summary, original_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionType,
        transactionId,
        editNumber,
        userId,
        reason || null,
        JSON.stringify(changesSummary),
        JSON.stringify(originalData)
      ]
    );

    return result.insertId;
  } catch (error) {
    console.error('Error creating edit history:', error);
    throw error;
  }
}

/**
 * Calculate bill totals
 * @param {Array} items - Array of items with prices, quantities, discounts, GST rates
 * @param {number} billDiscountAmount - Bill-level discount amount
 * @param {number} billDiscountPercent - Bill-level discount percent
 * @param {boolean} includeGst - Whether to include GST
 * @returns {object} Totals object
 */
function calculateBillTotals(items, billDiscountAmount, billDiscountPercent, includeGst = true) {
  let subtotal = 0;
  let totalGst = 0;

  // Calculate item-level totals
  for (const item of items) {
    const unitPrice = parseFloat(item.unit_price || 0);
    const quantity = parseFloat(item.quantity || 0);
    const itemDiscount = parseFloat(item.discount_amount || 0);
    const gstRate = parseFloat(item.gst_rate || 0);

    const itemSubtotal = unitPrice * quantity;
    const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
    const itemGst = includeGst ? (itemTotalAfterDiscount * gstRate) / 100 : 0;

    subtotal += itemSubtotal;
    totalGst += itemGst;
  }

  // Apply bill-level discount
  const billDiscount = billDiscountAmount || (subtotal * (billDiscountPercent || 0) / 100);
  const finalSubtotal = subtotal - billDiscount;
  const totalBeforeRound = finalSubtotal + totalGst;

  // Round off to nearest whole number
  const roundedTotal = Math.round(totalBeforeRound);
  const roundOff = roundedTotal - totalBeforeRound;

  return {
    subtotal,
    discount_amount: billDiscount,
    discount_percent: billDiscountPercent || 0,
    gst_amount: totalGst,
    total_amount: roundedTotal,
    round_off: roundOff
  };
}

/**
 * Generate changes summary for edit history
 * @param {object} oldData - Old transaction data
 * @param {object} newData - New transaction data
 * @returns {object} Changes summary
 */
function generateChangesSummary(oldData, newData) {
  const changes = {
    fields: [],
    items: {
      added: [],
      removed: [],
      modified: []
    }
  };

  // Compare main fields
  const fieldsToCompare = [
    'customer_name', 'customer_phone', 'customer_email', 'customer_gstin', 
    'customer_address', 'shipping_address', 'supplier_name', 'supplier_phone',
    'supplier_email', 'supplier_address', 'discount_amount', 'discount_percent',
    'payment_mode', 'notes'
  ];

  for (const field of fieldsToCompare) {
    if (oldData[field] !== newData[field]) {
      changes.fields.push({
        field,
        old: oldData[field],
        new: newData[field]
      });
    }
  }

  return changes;
}

module.exports = {
  createEditHistory,
  calculateBillTotals,
  generateChangesSummary
};

