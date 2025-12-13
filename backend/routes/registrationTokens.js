const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendRegistrationInvitation, isEmailConfigured } = require('../config/email');

const router = express.Router();

// Generate a secure random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate token (public endpoint for registration page)
router.get('/validate/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const [tokens] = await pool.execute(
      `SELECT rt.*, s.shop_name, s.owner_name, s.suggested_username
       FROM registration_tokens rt
       JOIN shops s ON rt.shop_id = s.id
       WHERE rt.token = ?`,
      [token]
    );

    if (!tokens.length) {
      return res.status(404).json({
        success: false,
        message: 'Invalid registration token'
      });
    }

    const tokenData = tokens[0];

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Registration token has expired'
      });
    }

    // Check if token is already used
    if (tokenData.used_at) {
      return res.status(400).json({
        success: false,
        message: 'Registration token has already been used'
      });
    }

    res.json({
      success: true,
      data: {
        shop_id: tokenData.shop_id,
        shop_name: tokenData.shop_name,
        email: tokenData.email,
        suggested_username: tokenData.suggested_username || null,
        expires_at: tokenData.expires_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Generate token for a shop (super admin only)
router.post('/generate', [
  authenticate,
  authorize('super_admin'),
  body('shop_id').isInt().withMessage('Valid shop ID is required'),
  body('email').isEmail().withMessage('Valid email is required')
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

    const { shop_id, email } = req.body;

    // Verify shop exists
    const [shops] = await pool.execute('SELECT id, shop_name FROM shops WHERE id = ?', [shop_id]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    // Generate token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Insert token
    await pool.execute(
      `INSERT INTO registration_tokens (shop_id, token, email, expires_at)
       VALUES (?, ?, ?, ?)`,
      [shop_id, token, email, expiresAt]
    );

    res.json({
      success: true,
      message: 'Registration token generated successfully',
      data: {
        token,
        expires_at: expiresAt,
        registration_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${token}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// Send invitation email (super admin only)
router.post('/send-invitation', [
  authenticate,
  authorize('super_admin'),
  body('shop_id').isInt().withMessage('Valid shop ID is required'),
  body('email').isEmail().withMessage('Valid email is required')
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

    if (!isEmailConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Email service is not configured. Please set SMTP environment variables.'
      });
    }

    const { shop_id, email } = req.body;

    // Verify shop exists
    const [shops] = await pool.execute('SELECT id, shop_name FROM shops WHERE id = ?', [shop_id]);
    if (!shops.length) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found'
      });
    }

    const shop = shops[0];

    // Generate token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Insert token
    await pool.execute(
      `INSERT INTO registration_tokens (shop_id, token, email, expires_at)
       VALUES (?, ?, ?, ?)`,
      [shop_id, token, email, expiresAt]
    );

    // Send email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationUrl = `${frontendUrl}/register?token=${token}`;

    try {
      await sendRegistrationInvitation(email, shop.shop_name, shop_id, token, registrationUrl);
      
      res.json({
        success: true,
        message: 'Registration invitation sent successfully',
        data: {
          email,
          expires_at: expiresAt,
          registration_url: registrationUrl
        }
      });
    } catch (emailError) {
      // Token was created but email failed - still return success but with warning
      res.json({
        success: true,
        message: 'Token generated but email sending failed',
        warning: emailError.message,
        data: {
          token,
          email,
          expires_at: expiresAt,
          registration_url: registrationUrl
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get tokens for a shop (super admin only)
router.get('/shop/:shopId', [
  authenticate,
  authorize('super_admin')
], async (req, res, next) => {
  try {
    const { shopId } = req.params;

    const [tokens] = await pool.execute(
      `SELECT id, token, email, expires_at, used_at, created_at
       FROM registration_tokens
       WHERE shop_id = ?
       ORDER BY created_at DESC`,
      [shopId]
    );

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

