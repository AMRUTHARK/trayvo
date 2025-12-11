const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

router.use(authenticate);
router.use(shopIsolation);

// Get all categories
router.get('/', async (req, res, next) => {
  try {
    // For super admin, shop_id must be provided in query
    if (req.isSuperAdmin && !req.shopId) {
      return res.status(400).json({
        success: false,
        message: 'shop_id is required for super admin'
      });
    }

    const [categories] = await pool.execute(
      'SELECT id, name, description, created_at FROM categories WHERE shop_id = ? ORDER BY name',
      [req.shopId]
    );

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
});

// Get single category
router.get('/:id', async (req, res, next) => {
  try {
    const [categories] = await pool.execute(
      'SELECT id, name, description, created_at FROM categories WHERE id = ? AND shop_id = ?',
      [req.params.id, req.shopId]
    );

    if (!categories.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: categories[0]
    });
  } catch (error) {
    next(error);
  }
});

// Create category
router.post('/', [
  body('name').trim().notEmpty().withMessage('Category name is required')
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

    const { name, description } = req.body;

    // Check if category already exists
    const [existing] = await pool.execute(
      'SELECT id FROM categories WHERE shop_id = ? AND name = ?',
      [req.shopId, name]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO categories (shop_id, name, description) VALUES (?, ?, ?)',
      [req.shopId, name, description || null]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { id: result.insertId, name, description }
    });
  } catch (error) {
    next(error);
  }
});

// Update category
router.put('/:id', [
  body('name').optional().trim().notEmpty()
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
    const { name, description } = req.body;

    // Verify category belongs to shop
    const [categories] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!categories.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if new name conflicts
    if (name) {
      const [existing] = await pool.execute(
        'SELECT id FROM categories WHERE shop_id = ? AND name = ? AND id != ?',
        [req.shopId, name, id]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Category name already exists'
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(id);

    await pool.execute(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Category updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Delete category
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify category belongs to shop
    const [categories] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!categories.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const [products] = await pool.execute(
      'SELECT id FROM products WHERE category_id = ? LIMIT 1',
      [id]
    );

    if (products.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products'
      });
    }

    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Bulk import from CSV
router.post('/bulk-import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const categories = [];
    const errors = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          categories.push(row);
        })
        .on('end', async () => {
          try {
            const connection = await pool.getConnection();
            await connection.beginTransaction();

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < categories.length; i++) {
              try {
                const row = categories[i];
                const name = (row.name || row.Name || '').trim();
                const description = (row.description || row.Description || '').trim();

                if (!name) {
                  errors.push(`Row ${i + 2}: Category name is required`);
                  errorCount++;
                  continue;
                }

                // Check if category already exists
                const [existing] = await connection.execute(
                  'SELECT id FROM categories WHERE shop_id = ? AND name = ?',
                  [req.shopId, name]
                );

                if (existing.length > 0) {
                  errors.push(`Row ${i + 2}: Category "${name}" already exists`);
                  errorCount++;
                  continue;
                }

                await connection.execute(
                  'INSERT INTO categories (shop_id, name, description) VALUES (?, ?, ?)',
                  [req.shopId, name, description || null]
                );

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
            resolve();
          } catch (error) {
            if (req.file && fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
            reject(error);
          }
        })
        .on('error', (error) => {
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          reject(error);
        });
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

module.exports = router;

