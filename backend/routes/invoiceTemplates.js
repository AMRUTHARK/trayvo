const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const shopIsolation = require('../middleware/shopIsolation');
const { logError, logDatabaseError } = require('../utils/errorLogger');

const router = express.Router();

router.use(authenticate);
router.use(shopIsolation);

// Helper function to create default templates for a shop
async function createDefaultTemplates(shopId, connection = null) {
  const dbConnection = connection || pool;
  
  try {
    // Check if templates already exist
    const [existing] = await dbConnection.execute(
      'SELECT COUNT(*) as count FROM invoice_templates WHERE shop_id = ?',
      [shopId]
    );

    if (existing[0].count > 0) {
      return; // Templates already exist
    }

    // Default thermal template
    const thermalTemplate = {
      version: '1.0',
      sections: {
        header: { enabled: true, showLogo: false },
        items: { columns: ['item', 'qty', 'rate', 'amount'] },
        totals: { showTaxBreakdown: false }
      }
    };

    // Default A4 professional template
    const a4Template = {
      version: '1.0',
      pageSize: 'a4',
      sections: {
        header: {
          enabled: true,
          showLogo: true,
          logoPosition: 'right',
          fields: ['name', 'address', 'phone', 'email', 'gstin', 'state']
        },
        billing: {
          enabled: true,
          title: 'Bill To',
          fields: ['name', 'address', 'phone', 'gstin', 'state']
        },
        shipping: {
          enabled: true,
          title: 'Shipping To',
          defaultToBilling: true
        },
        items: {
          columns: ['sl_no', 'items', 'hsn', 'unit_price', 'quantity', 'amount']
        },
        totals: {
          showTaxBreakdown: true,
          showCGST: true,
          showSGST: true
        },
        bankDetails: {
          enabled: true,
          position: 'bottom_left'
        },
        footer: {
          showQueryContact: true,
          showSignature: true
        }
      },
      styling: {
        fontFamily: 'Arial, sans-serif',
        primaryColor: '#000000',
        borderStyle: 'solid'
      }
    };

    // Insert default templates
    await dbConnection.execute(
      `INSERT INTO invoice_templates (shop_id, template_name, template_type, is_default_for_type, template_config, is_active)
       VALUES (?, 'Thermal Simple', 'thermal', TRUE, ?, TRUE),
              (?, 'A4 Professional', 'a4', TRUE, ?, TRUE)`,
      [
        shopId, JSON.stringify(thermalTemplate),
        shopId, JSON.stringify(a4Template)
      ]
    );
  } catch (error) {
    console.error('Error creating default templates:', error);
    throw error;
  }
}

// Get all invoice templates for shop
router.get('/', async (req, res, next) => {
  try {
    // Ensure default templates exist
    await createDefaultTemplates(req.shopId);

    const [templates] = await pool.execute(
      `SELECT id, template_name, template_type, is_default_for_type, template_config, 
              is_active, created_at, updated_at
       FROM invoice_templates 
       WHERE shop_id = ? AND is_active = TRUE
       ORDER BY template_type, is_default_for_type DESC, template_name`,
      [req.shopId]
    );

    // Parse template_config JSON
    const parsedTemplates = templates.map(t => ({
      ...t,
      template_config: typeof t.template_config === 'string' 
        ? JSON.parse(t.template_config) 
        : t.template_config
    }));

    res.json({
      success: true,
      data: parsedTemplates
    });
  } catch (error) {
    await logDatabaseError(error, req, req.user);
    next(error);
  }
});

// Get single invoice template
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [templates] = await pool.execute(
      `SELECT id, template_name, template_type, is_default_for_type, template_config, 
              is_active, created_at, updated_at
       FROM invoice_templates 
       WHERE id = ? AND shop_id = ?`,
      [id, req.shopId]
    );

    if (!templates.length) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = templates[0];
    template.template_config = typeof template.template_config === 'string'
      ? JSON.parse(template.template_config)
      : template.template_config;

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    await logDatabaseError(error, req, req.user);
    next(error);
  }
});

// Get default template for a type
router.get('/default/:type', async (req, res, next) => {
  try {
    const { type } = req.params;

    if (!['thermal', 'a4'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type. Must be "thermal" or "a4"'
      });
    }

    // Ensure default templates exist
    await createDefaultTemplates(req.shopId);

    const [templates] = await pool.execute(
      `SELECT id, template_name, template_type, is_default_for_type, template_config, 
              is_active, created_at, updated_at
       FROM invoice_templates 
       WHERE shop_id = ? AND template_type = ? AND is_default_for_type = TRUE AND is_active = TRUE
       LIMIT 1`,
      [req.shopId, type]
    );

    if (!templates.length) {
      return res.status(404).json({
        success: false,
        message: `Default ${type} template not found`
      });
    }

    const template = templates[0];
    template.template_config = typeof template.template_config === 'string'
      ? JSON.parse(template.template_config)
      : template.template_config;

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    await logDatabaseError(error, req, req.user);
    next(error);
  }
});

// Create new invoice template (admin only)
router.post('/', authorize('admin'), [
  body('template_name').trim().notEmpty().withMessage('Template name is required'),
  body('template_type').isIn(['thermal', 'a4']).withMessage('Template type must be thermal or a4'),
  body('template_config').isObject().withMessage('Template config must be a valid JSON object'),
  body('is_default_for_type').optional().isBoolean()
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

    const { template_name, template_type, template_config, is_default_for_type = false } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // If setting as default, unset other defaults of the same type
      if (is_default_for_type) {
        await connection.execute(
          'UPDATE invoice_templates SET is_default_for_type = FALSE WHERE shop_id = ? AND template_type = ?',
          [req.shopId, template_type]
        );
      }

      // Insert new template
      const [result] = await connection.execute(
        `INSERT INTO invoice_templates (shop_id, template_name, template_type, is_default_for_type, template_config, is_active)
         VALUES (?, ?, ?, ?, ?, TRUE)`,
        [req.shopId, template_name, template_type, is_default_for_type, JSON.stringify(template_config)]
      );

      await connection.commit();
      connection.release();

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: { id: result.insertId }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      await logDatabaseError(error, req, req.user);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Update invoice template (admin only)
router.put('/:id', authorize('admin'), [
  body('template_name').optional().trim().notEmpty(),
  body('template_config').optional().isObject(),
  body('is_default_for_type').optional().isBoolean(),
  body('is_active').optional().isBoolean()
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
    const { template_name, template_config, is_default_for_type, is_active } = req.body;

    // Verify template belongs to shop
    const [templates] = await pool.execute(
      'SELECT id, template_type FROM invoice_templates WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!templates.length) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = templates[0];
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // If setting as default, unset other defaults of the same type
      if (is_default_for_type === true) {
        await connection.execute(
          'UPDATE invoice_templates SET is_default_for_type = FALSE WHERE shop_id = ? AND template_type = ? AND id != ?',
          [req.shopId, template.template_type, id]
        );
      }

      const updateFields = [];
      const updateValues = [];

      if (template_name !== undefined) {
        updateFields.push('template_name = ?');
        updateValues.push(template_name);
      }
      if (template_config !== undefined) {
        updateFields.push('template_config = ?');
        updateValues.push(JSON.stringify(template_config));
      }
      if (is_default_for_type !== undefined) {
        updateFields.push('is_default_for_type = ?');
        updateValues.push(is_default_for_type);
      }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(is_active);
      }

      if (updateFields.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      await connection.execute(
        `UPDATE invoice_templates SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Template updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      await logDatabaseError(error, req, req.user);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Set template as default for its type (admin only)
router.post('/:id/set-default', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify template belongs to shop
    const [templates] = await pool.execute(
      'SELECT id, template_type FROM invoice_templates WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!templates.length) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = templates[0];
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Unset other defaults of the same type
      await connection.execute(
        'UPDATE invoice_templates SET is_default_for_type = FALSE WHERE shop_id = ? AND template_type = ?',
        [req.shopId, template.template_type]
      );

      // Set this template as default
      await connection.execute(
        'UPDATE invoice_templates SET is_default_for_type = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Template set as default successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      await logDatabaseError(error, req, req.user);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// Delete invoice template (admin only)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify template belongs to shop
    const [templates] = await pool.execute(
      'SELECT id, is_default_for_type FROM invoice_templates WHERE id = ? AND shop_id = ?',
      [id, req.shopId]
    );

    if (!templates.length) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Prevent deletion of default templates (soft delete by setting is_active = FALSE)
    if (templates[0].is_default_for_type) {
      await pool.execute(
        'UPDATE invoice_templates SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } else {
      // Delete non-default templates
      await pool.execute('DELETE FROM invoice_templates WHERE id = ?', [id]);
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    await logDatabaseError(error, req, req.user);
    next(error);
  }
});

module.exports = router;

