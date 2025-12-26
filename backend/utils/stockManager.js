/**
 * Stock Management Utilities
 * Handles stock reversal and application for transaction edits
 */

/**
 * Reverse stock for a bill (restore stock)
 * @param {number} billId - Bill ID
 * @param {number} shopId - Shop ID
 * @param {number} userId - User ID performing the reversal
 * @param {string} reason - Reason for reversal (e.g., "Edit reversal")
 * @param {object} connection - Database connection (required for transactions)
 * @returns {Promise<void>}
 */
async function reverseBillStock(billId, shopId, userId, reason, connection) {
  try {
    // Get all bill items
    const [items] = await connection.execute(
      `SELECT bi.product_id, bi.quantity 
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE bi.bill_id = ? AND b.shop_id = ?`,
      [billId, shopId]
    );

    for (const item of items) {
      const productId = item.product_id;
      const quantity = parseFloat(item.quantity);

      // Get current stock
      const [products] = await connection.execute(
        'SELECT stock_quantity FROM products WHERE id = ?',
        [productId]
      );

      if (!products.length) {
        throw new Error(`Product ${productId} not found`);
      }

      const oldStock = parseFloat(products[0].stock_quantity);
      const newStock = oldStock + quantity; // Restore stock (add back)

      // Update product stock
      await connection.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [newStock, productId]
      );

      // Add to stock ledger (reversal entry)
      await connection.execute(
        `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                  reference_type, quantity_change, quantity_before, 
                                  quantity_after, notes, created_by)
         VALUES (?, ?, 'return', ?, 'bill', ?, ?, ?, ?, ?)`,
        [
          shopId, productId, billId,
          quantity, // Positive quantity change (restore)
          oldStock, newStock,
          reason || `Bill edit reversal - Bill ID ${billId}`,
          userId
        ]
      );
    }
  } catch (error) {
    console.error('Error reversing bill stock:', error);
    throw error;
  }
}

/**
 * Apply stock for a bill (deduct stock)
 * @param {Array} items - Array of items with product_id and quantity
 * @param {number} billId - Bill ID
 * @param {number} shopId - Shop ID
 * @param {number} userId - User ID
 * @param {string} billNumber - Bill number for notes
 * @param {object} connection - Database connection (required)
 * @returns {Promise<void>}
 */
async function applyBillStock(items, billId, shopId, userId, billNumber, connection) {
  try {
    for (const item of items) {
      const productId = item.product_id;
      const quantity = parseFloat(item.quantity);

      // Get current stock
      const [products] = await connection.execute(
        'SELECT stock_quantity FROM products WHERE id = ?',
        [productId]
      );

      if (!products.length) {
        throw new Error(`Product ${productId} not found`);
      }

      const oldStock = parseFloat(products[0].stock_quantity);
      const newStock = oldStock - quantity; // Deduct stock for sale

      // Update product stock
      await connection.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [newStock, productId]
      );

      // Add to stock ledger
      await connection.execute(
        `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                  reference_type, quantity_change, quantity_before, 
                                  quantity_after, notes, created_by)
         VALUES (?, ?, 'sale', ?, 'bill', ?, ?, ?, ?, ?)`,
        [
          shopId, productId, billId,
          -quantity, // Negative quantity change (deduct)
          oldStock, newStock,
          `Bill edit - ${billNumber}`,
          userId
        ]
      );
    }
  } catch (error) {
    console.error('Error applying bill stock:', error);
    throw error;
  }
}

/**
 * Reverse stock for a purchase (deduct stock back)
 * @param {number} purchaseId - Purchase ID
 * @param {number} shopId - Shop ID
 * @param {number} userId - User ID
 * @param {string} reason - Reason for reversal
 * @param {object} connection - Database connection (required)
 * @returns {Promise<void>}
 */
async function reversePurchaseStock(purchaseId, shopId, userId, reason, connection) {
  try {
    // Get all purchase items
    const [items] = await connection.execute(
      `SELECT pi.product_id, pi.quantity 
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       WHERE pi.purchase_id = ? AND p.shop_id = ?`,
      [purchaseId, shopId]
    );

    for (const item of items) {
      const productId = item.product_id;
      const quantity = parseFloat(item.quantity);

      // Get current stock
      const [products] = await connection.execute(
        'SELECT stock_quantity FROM products WHERE id = ?',
        [productId]
      );

      if (!products.length) {
        throw new Error(`Product ${productId} not found`);
      }

      const oldStock = parseFloat(products[0].stock_quantity);
      const newStock = oldStock - quantity; // Reverse purchase (deduct)

      if (newStock < 0) {
        throw new Error(`Cannot reverse purchase: insufficient stock for product ${productId}. Current: ${oldStock}, Required: ${quantity}`);
      }

      // Update product stock
      await connection.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [newStock, productId]
      );

      // Add to stock ledger (reversal entry)
      await connection.execute(
        `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                  reference_type, quantity_change, quantity_before, 
                                  quantity_after, notes, created_by)
         VALUES (?, ?, 'purchase', ?, 'purchase', ?, ?, ?, ?, ?)`,
        [
          shopId, productId, purchaseId,
          -quantity, // Negative quantity change (reverse)
          oldStock, newStock,
          reason || `Purchase edit reversal - Purchase ID ${purchaseId}`,
          userId
        ]
      );
    }
  } catch (error) {
    console.error('Error reversing purchase stock:', error);
    throw error;
  }
}

/**
 * Apply stock for a purchase (increase stock)
 * @param {Array} items - Array of items with product_id and quantity
 * @param {number} purchaseId - Purchase ID
 * @param {number} shopId - Shop ID
 * @param {number} userId - User ID
 * @param {string} purchaseNumber - Purchase number for notes
 * @param {object} connection - Database connection (required)
 * @returns {Promise<void>}
 */
async function applyPurchaseStock(items, purchaseId, shopId, userId, purchaseNumber, connection) {
  try {
    for (const item of items) {
      const productId = item.product_id;
      const quantity = parseFloat(item.quantity);

      // Get current stock
      const [products] = await connection.execute(
        'SELECT stock_quantity FROM products WHERE id = ?',
        [productId]
      );

      if (!products.length) {
        throw new Error(`Product ${productId} not found`);
      }

      const oldStock = parseFloat(products[0].stock_quantity);
      const newStock = oldStock + quantity; // Increase stock for purchase

      // Update product stock
      await connection.execute(
        'UPDATE products SET stock_quantity = ? WHERE id = ?',
        [newStock, productId]
      );

      // Add to stock ledger
      await connection.execute(
        `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_id, 
                                  reference_type, quantity_change, quantity_before, 
                                  quantity_after, notes, created_by)
         VALUES (?, ?, 'purchase', ?, 'purchase', ?, ?, ?, ?, ?)`,
        [
          shopId, productId, purchaseId,
          quantity, // Positive quantity change (increase)
          oldStock, newStock,
          `Purchase edit - ${purchaseNumber}`,
          userId
        ]
      );
    }
  } catch (error) {
    console.error('Error applying purchase stock:', error);
    throw error;
  }
}

module.exports = {
  reverseBillStock,
  applyBillStock,
  reversePurchaseStock,
  applyPurchaseStock
};

