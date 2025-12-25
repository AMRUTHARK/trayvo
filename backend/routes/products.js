const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Get all products with filters
router.get('/', async (req, res, next) => {
  try {
    const { search, category_id, low_stock, page = 1, limit = 50, skip_count } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    let query = `
      SELECT p.id, p.name, p.sku, p.barcode, p.unit, p.cost_price, p.selling_price, 
             p.gst_rate, p.stock_quantity, p.min_stock_level, p.description, 
             p.hsn_code, p.image_url, p.is_active, p.created_at, p.updated_at,
             c.id as category_id, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.shop_id = ? AND p.is_active = TRUE
    `;
    const params = [req.shopId];

    // For POS searches (skip_count=true), exclude products with zero quantity
    if (skip_count === 'true') {
      query += ' AND p.stock_quantity > 0';
    }

    if (search) {
      const searchTerm = search.trim();
      // Optimized search: prioritize exact matches and prefix matches (can use indexes)
      // This is faster than LOWER() on both sides which prevents index usage
      query += ` AND (
        p.name = ? OR p.sku = ? OR p.barcode = ?
        OR p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?
        OR LOWER(p.name) LIKE LOWER(?) OR LOWER(p.sku) LIKE LOWER(?) OR LOWER(p.barcode) LIKE LOWER(?)
      )`;
      const exactTerm = searchTerm;
      const prefixTerm = `${searchTerm}%`;
      const wildcardTerm = `%${searchTerm}%`;
      // Try exact match first (fastest with indexes)
      params.push(exactTerm, exactTerm, exactTerm);
      // Then prefix match (can use index)
      params.push(prefixTerm, prefixTerm, prefixTerm);
      // Finally wildcard match (fallback, slower but more flexible)
      params.push(wildcardTerm, wildcardTerm, wildcardTerm);
    }

    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(parseInt(category_id));
    }

    if (low_stock === 'true') {
      query += ' AND p.stock_quantity <= p.min_stock_level';
    }

    // Use template literals for LIMIT and OFFSET to avoid prepared statement issues
    query += ` ORDER BY p.name LIMIT ${limitNum} OFFSET ${offset}`;

    const [products] = await pool.execute(query, params);

    // Skip count query for POS searches (faster performance)
    let total = null;
    let pagination = null;
    
    if (skip_count !== 'true') {
      // Only run count query if not skipping (for product listing page)
      let countQuery = 'SELECT COUNT(*) as total FROM products WHERE shop_id = ? AND is_active = TRUE';
      const countParams = [req.shopId];

      if (search) {
        const searchTerm = search.trim();
        countQuery += ` AND (
          name = ? OR sku = ? OR barcode = ?
          OR name LIKE ? OR sku LIKE ? OR barcode LIKE ?
          OR LOWER(name) LIKE LOWER(?) OR LOWER(sku) LIKE LOWER(?) OR LOWER(barcode) LIKE LOWER(?)
        )`;
        const exactTerm = searchTerm;
        const prefixTerm = `${searchTerm}%`;
        const wildcardTerm = `%${searchTerm}%`;
        countParams.push(exactTerm, exactTerm, exactTerm, prefixTerm, prefixTerm, prefixTerm, wildcardTerm, wildcardTerm, wildcardTerm);
      }

      if (category_id) {
        countQuery += ' AND category_id = ?';
        countParams.push(parseInt(category_id));
      }

      if (low_stock === 'true') {
        countQuery += ' AND stock_quantity <= min_stock_level';
      }

      const [countResult] = await pool.execute(countQuery, countParams);
      total = countResult[0].total;
      
      pagination = {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      };
    }

    res.json({
      success: true,
      data: products,
      pagination: pagination
    });
  } catch (error) {
    next(error);
  }
});

// Get single product
router.get('/:id', async (req, res, next) => {
  try {
    const [products] = await pool.execute(
      `SELECT p.id, p.name, p.sku, p.barcode, p.unit, p.cost_price, p.selling_price, 
              p.gst_rate, p.stock_quantity, p.min_stock_level, p.description, 
              p.hsn_code, p.image_url, p.is_active, p.created_at, p.updated_at,
              c.id as category_id, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.shop_id = ?`,
      [req.params.id, req.shopId]
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    next(error);
  }
});

// Create product
router.post('/', [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('cost_price').isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('selling_price').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('unit').optional().isIn(['pcs', 'kg', 'g', 'l', 'ml', 'm', 'cm']),
  body('gst_rate').optional().isFloat({ min: 0, max: 100 }),
  body('stock_quantity').optional().isFloat({ min: 0 }),
  body('min_stock_level').optional().isFloat({ min: 0 })
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

    const {
      name, sku, hsn_code, barcode, category_id, unit, cost_price, selling_price,
      gst_rate, stock_quantity, min_stock_level, description, image_url
    } = req.body;

    // Check if SKU already exists
    const [existing] = await pool.execute(
      'SELECT id FROM products WHERE shop_id = ? AND sku = ?',
      [req.shopId, sku]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      });
    }

    // Verify category belongs to shop
    if (category_id) {
      const [categories] = await pool.execute(
        'SELECT id FROM categories WHERE id = ? AND shop_id = ?',
        [category_id, req.shopId]
      );

      if (!categories.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
      }
    }

    // Stock quantity is always set to 0 - stock must be added via Purchase module or Inventory Adjustment
    // This ensures all stock movements are properly tracked with supplier information and purchase records
    const [result] = await pool.execute(
      `INSERT INTO products (shop_id, category_id, name, sku, hsn_code, barcode, unit, cost_price, 
                            selling_price, gst_rate, stock_quantity, min_stock_level, 
                            description, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, TRUE)`,
      [
        req.shopId, category_id || null, name, sku, hsn_code || null, barcode || null,
        unit || 'pcs', cost_price, selling_price, gst_rate || 0,
        min_stock_level || 0, description || null, image_url || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
});

// Update product
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('cost_price').optional().isFloat({ min: 0 }),
  body('selling_price').optional().isFloat({ min: 0 }),
  body('gst_rate').optional().isFloat({ min: 0, max: 100 })
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
    const {
      name, sku, hsn_code, barcode, category_id, unit, cost_price, selling_price,
      gst_rate, min_stock_level, description, image_url, is_active
    } = req.body;

    // Verify product belongs to shop
    const [products] = await pool.execute(
      'SELECT id, stock_quantity FROM products WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check SKU uniqueness if changed
    if (sku) {
      const [existing] = await pool.execute(
        'SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ?',
        [req.shopId, sku, id]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    }

    // Verify category if provided
    if (category_id) {
      const [categories] = await pool.execute(
        'SELECT id FROM categories WHERE id = ? AND shop_id = ?',
        [category_id, req.shopId]
      );

      if (!categories.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (name) updateFields.push('name = ?'), updateValues.push(name);
    if (sku) updateFields.push('sku = ?'), updateValues.push(sku);
    if (hsn_code !== undefined) updateFields.push('hsn_code = ?'), updateValues.push(hsn_code || null);
    if (barcode !== undefined) updateFields.push('barcode = ?'), updateValues.push(barcode || null);
    if (category_id !== undefined) updateFields.push('category_id = ?'), updateValues.push(category_id || null);
    if (unit) updateFields.push('unit = ?'), updateValues.push(unit);
    if (cost_price !== undefined) updateFields.push('cost_price = ?'), updateValues.push(cost_price);
    if (selling_price !== undefined) updateFields.push('selling_price = ?'), updateValues.push(selling_price);
    if (gst_rate !== undefined) updateFields.push('gst_rate = ?'), updateValues.push(gst_rate);
    if (min_stock_level !== undefined) updateFields.push('min_stock_level = ?'), updateValues.push(min_stock_level);
    if (description !== undefined) updateFields.push('description = ?'), updateValues.push(description || null);
    if (image_url !== undefined) updateFields.push('image_url = ?'), updateValues.push(image_url || null);
    if (is_active !== undefined) updateFields.push('is_active = ?'), updateValues.push(is_active);

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(id);

    await pool.execute(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Product updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete product
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify product belongs to shop
    const [products] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product has been used in bills
    const [bills] = await pool.execute(
      'SELECT id FROM bill_items WHERE product_id = ? LIMIT 1',
      [id]
    );

    if (bills.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product that has been used in bills'
      });
    }

    await pool.execute('DELETE FROM products WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const products = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        products.push(row);
      })
      .on('end', () => {
        resolve(products);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Helper function to parse Excel file
const parseExcel = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0]; // Get first worksheet
  
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const products = [];
  const headers = [];
  
  // Get headers from first row
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (cell.value) {
      headers[colNumber] = String(cell.value).toLowerCase().trim();
    }
  });

  // Read data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    const product = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        const value = cell.value;
        product[header] = value !== null && value !== undefined ? String(value).trim() : '';
      }
    });
    
    // Only add row if it has at least one non-empty value
    if (Object.values(product).some(val => val && val !== '')) {
      products.push(product);
    }
  });

  return products;
};

// Bulk import from CSV or Excel
router.post('/bulk-import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let products = [];
    const errors = [];

    try {
      // Parse file based on extension
      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        products = await parseExcel(req.file.path);
      } else {
        // Default to CSV
        products = await parseCSV(req.file.path);
      }
    } catch (parseError) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Failed to parse file: ${parseError.message}`
      });
    }

    if (products.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'No data found in file. Please check the file format.'
      });
    }

    // Process products
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < products.length; i++) {
              const row = products[i];
              try {
                // Normalize row keys to lowercase and trim whitespace
                const normalizedRow = {};
                Object.keys(row).forEach(key => {
                  const normalizedKey = key.toLowerCase().trim();
                  const value = row[key];
                  normalizedRow[normalizedKey] = typeof value === 'string' ? value.trim() : value;
                });

                // Extract fields with case-insensitive matching
                const name = normalizedRow.name || normalizedRow['product name'] || '';
                const sku = normalizedRow.sku || '';
                const barcode = normalizedRow.barcode || null;
                const category_name = normalizedRow.category_name || normalizedRow.category || null;
                const unit = normalizedRow.unit || 'pcs';
                const cost_price = normalizedRow.cost_price || normalizedRow['cost price'] || '';
                const selling_price = normalizedRow.selling_price || normalizedRow['selling price'] || normalizedRow.price || '';
                const gst_rate = normalizedRow.gst_rate || normalizedRow['gst rate'] || normalizedRow.gst || 0;
                const stock_quantity = normalizedRow.stock_quantity || normalizedRow['stock quantity'] || normalizedRow.stock || 0;
                const min_stock_level = normalizedRow.min_stock_level || normalizedRow['min stock level'] || normalizedRow['min stock'] || 0;
                const description = normalizedRow.description || null;

                // Check for required fields (trimmed and check for empty strings)
                const missingFields = [];
                if (!name || name === '') missingFields.push('name');
                if (!sku || sku === '') missingFields.push('sku');
                if (!cost_price || cost_price === '' || isNaN(parseFloat(cost_price))) missingFields.push('cost_price');
                if (!selling_price || selling_price === '' || isNaN(parseFloat(selling_price))) missingFields.push('selling_price');

                if (missingFields.length > 0) {
                  errors.push(`Row ${i + 2}: Missing required fields: ${missingFields.join(', ')}. Available columns: ${Object.keys(row).join(', ')}`);
                  errorCount++;
                  continue;
                }

                // Get category ID if category_name provided
                let category_id = null;
                if (category_name) {
                  const [categories] = await connection.execute(
                    'SELECT id FROM categories WHERE shop_id = ? AND name = ?',
                    [req.shopId, category_name]
                  );
                  if (categories.length) {
                    category_id = categories[0].id;
                  }
                }

                // Check if SKU exists
                const [existing] = await connection.execute(
                  'SELECT id FROM products WHERE shop_id = ? AND sku = ?',
                  [req.shopId, sku]
                );

                if (existing.length > 0) {
                  errors.push(`Row ${i + 2}: SKU ${sku} already exists`);
                  errorCount++;
                  continue;
                }

                // Parse and validate stock_quantity from CSV if provided, default to 0
                // stock_quantity is already extracted from CSV row above (line 519)
                let parsedStockQuantity = 0;
                // Handle stock_quantity: it could be a string, number, or null/undefined
                if (stock_quantity !== null && stock_quantity !== undefined && stock_quantity !== '') {
                  const parsed = parseFloat(stock_quantity);
                  if (!isNaN(parsed) && parsed >= 0) {
                    parsedStockQuantity = parsed;
                  } else {
                    // Log warning but continue with 0
                    errors.push(`Row ${i + 2}: Invalid stock_quantity value "${stock_quantity}". Using 0 instead.`);
                  }
                }
                // If stock_quantity is null, undefined, empty string, or 0, parsedStockQuantity remains 0 (default)

                // Insert product with stock_quantity from CSV (or 0 if not provided/invalid)
                const [result] = await connection.execute(
                  `INSERT INTO products (shop_id, category_id, name, sku, barcode, unit, 
                                        cost_price, selling_price, gst_rate, stock_quantity, 
                                        min_stock_level, description, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
                  [
                    req.shopId, 
                    category_id, 
                    name.trim(), 
                    sku.trim(), 
                    barcode ? barcode.trim() : null,
                    unit.trim(), 
                    parseFloat(cost_price), 
                    parseFloat(selling_price),
                    parseFloat(gst_rate) || 0, 
                    parsedStockQuantity, // Use parsed CSV value instead of hardcoded 0
                    parseFloat(min_stock_level) || 0, 
                    description ? description.trim() : null
                  ]
                );

                const productId = result.insertId;

                // If stock_quantity > 0, create ledger entry for audit trail
                // This maintains inventory tracking integrity while allowing initial stock during import
                if (parsedStockQuantity > 0) {
                  try {
                    await connection.execute(
                      `INSERT INTO stock_ledger (shop_id, product_id, transaction_type, reference_type,
                                                quantity_change, quantity_before, quantity_after, 
                                                notes, created_by)
                       VALUES (?, ?, 'adjustment', 'adjustment', ?, 0, ?, ?, ?)`,
                      [
                        req.shopId, 
                        productId, 
                        parsedStockQuantity, 
                        parsedStockQuantity,
                        'Initial stock from CSV import', 
                        req.user.id
                      ]
                    );
                  } catch (ledgerError) {
                    // Log ledger error but don't fail the product creation
                    // This ensures products are still created even if ledger entry fails
                    console.error(`Failed to create ledger entry for product ${productId}:`, ledgerError);
                    errors.push(`Row ${i + 2}: Product created but failed to log stock in ledger: ${ledgerError.message}`);
                  }
                }

                successCount++;
              } catch (err) {
                errors.push(`Row ${i + 2}: ${err.message}`);
                errorCount++;
              }
            }

      await connection.commit();
      connection.release();

      // Delete uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Import completed: ${successCount} successful, ${errorCount} failed`,
        data: {
          successCount,
          errorCount,
          errors: errors.slice(0, 50) // Limit errors shown
        }
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(error);
  }
});

module.exports = router;

