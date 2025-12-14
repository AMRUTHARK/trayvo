const sgMail = require('@sendgrid/mail');

// Track initialization state
let isInitialized = false;

// Initialize SendGrid with API key
const initializeSendGrid = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) {
    sgMail.setApiKey(apiKey);
    isInitialized = true;
    return true;
  }
  return false;
};

// Safely check if SendGrid is initialized
const isSendGridInitialized = () => {
  try {
    // If we've initialized before, return true
    if (isInitialized) return true;
    
    // Check if client has authorization header (safe access with optional chaining)
    if (sgMail?.client?.request?.defaults?.headers?.['Authorization']) {
      isInitialized = true;
      return true;
    }
    return false;
  } catch (err) {
    // If any error occurs, assume not initialized
    return false;
  }
};

// Check if email is configured (SendGrid Web API)
const isEmailConfigured = () => {
  return !!process.env.SENDGRID_API_KEY;
};

// Validate email format
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Send registration invitation email using SendGrid Web API
const sendRegistrationInvitation = async (email, shopName, shopId, token, registrationUrl) => {
  // Validate email format before proceeding
  if (!isValidEmail(email)) {
    throw new Error(`Invalid email address: ${email}`);
  }

  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured. Please set SENDGRID_API_KEY environment variable.');
  }

  // Initialize SendGrid safely
  if (!isSendGridInitialized()) {
    initializeSendGrid();
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'Trayvo Billing System';

  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL or SMTP_FROM_EMAIL environment variable is required. This should be a verified sender email in SendGrid.');
  }

  if (!isValidEmail(fromEmail)) {
    throw new Error(`Invalid from email address: ${fromEmail}`);
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Trayvo Billing System</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #667eea; margin-top: 0;">Registration Invitation</h2>
        <p>Hello,</p>
        <p>You have been invited to register an account for <strong>${shopName}</strong> to access our comprehensive billing and inventory management system.</p>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
          <p style="margin: 0;"><strong>Shop ID:</strong> ${shopId}</p>
          <p style="margin: 5px 0 0 0;"><strong>Shop Name:</strong> ${shopName}</p>
        </div>

        <div style="background: #f0f7ff; padding: 25px; border-radius: 8px; margin: 25px 0;">
          <h3 style="color: #667eea; margin-top: 0; margin-bottom: 20px; font-size: 18px;">🚀 What You Can Do With Our System:</h3>
          <div style="font-size: 14px; line-height: 1.8;">
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Fast POS Billing:</strong> Quick checkout with real-time calculations
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Inventory Management:</strong> Track stock levels and get low-stock alerts
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>GST-Compliant Invoices:</strong> Automatic GST calculation and reporting
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Sales Reports:</strong> Detailed analytics and profit/loss tracking
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Thermal Printing:</strong> Print receipts directly from the system
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Hold Bills:</strong> Save and recall incomplete transactions
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Export Reports:</strong> Download reports in PDF or CSV format
            </div>
            <div style="margin-bottom: 10px;">
              <span style="color: #667eea; margin-right: 8px; font-weight: bold;">✓</span>
              <strong>Cloud-Based:</strong> Access your shop data from anywhere, anytime
            </div>
          </div>
        </div>

        <p><strong>Get started by completing your registration:</strong></p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${registrationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Complete Registration
          </a>
        </div>

        <p style="font-size: 12px; color: #666; margin-top: 30px;">
          Or copy and paste this link into your browser:<br>
          <a href="${registrationUrl}" style="color: #667eea; word-break: break-all;">${registrationUrl}</a>
        </p>

        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>Important:</strong> This invitation link will expire in 7 days. Please complete your registration before then.
          </p>
        </div>

        <p style="margin-top: 30px; font-size: 12px; color: #666;">
          If you did not request this invitation, please ignore this email.
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Trayvo Billing System - Registration Invitation

Hello,

You have been invited to register an account for ${shopName} to access our comprehensive billing and inventory management system.

Shop ID: ${shopId}
Shop Name: ${shopName}

WHAT YOU CAN DO WITH OUR SYSTEM:

✓ Fast POS Billing - Quick checkout with real-time calculations
✓ Inventory Management - Track stock levels and get low-stock alerts
✓ GST-Compliant Invoices - Automatic GST calculation and reporting
✓ Sales Reports - Detailed analytics and profit/loss tracking
✓ Thermal Printing - Print receipts directly from the system
✓ Hold Bills - Save and recall incomplete transactions
✓ Export Reports - Download reports in PDF or CSV format
✓ Cloud-Based - Access your shop data from anywhere, anytime

Complete your registration by visiting:
${registrationUrl}

Important: This invitation link will expire in 7 days. Please complete your registration before then.

If you did not request this invitation, please ignore this email.
  `.trim();

  const msg = {
    to: email.trim(),
    from: {
      email: fromEmail.trim(),
      name: fromName,
    },
    subject: `Registration Invitation - ${shopName}`,
    text: textContent,
    html: htmlContent,
  };

  try {
    // SendGrid Web API uses HTTPS (port 443) - much more reliable than SMTP
    // Set timeout to 30 seconds for the HTTP request
    const sendPromise = sgMail.send(msg);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout: Operation took longer than 30 seconds')), 30000);
    });
    
    let result;
    
    try {
      result = await Promise.race([sendPromise, timeoutPromise]);
    } catch (raceError) {
      // Check if it's a timeout or actual SendGrid error
      if (raceError.message && raceError.message.includes('timeout')) {
        throw new Error('Email sending timeout: Operation took longer than 30 seconds. Please check your network connection and SendGrid service status.');
      }
      // Re-throw SendGrid errors as-is
      throw raceError;
    }
    
    // SendGrid Web API response handling - be defensive about structure
    let messageId = 'sent';
    
    // Log response structure in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('SendGrid response structure:', {
        isArray: Array.isArray(result),
        resultType: typeof result,
        resultLength: Array.isArray(result) ? result.length : 'N/A',
        hasResponse: Array.isArray(result) ? !!result[0] : !!result,
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : 'N/A',
      });
    }
    
    // Safely extract message ID from response
    try {
      if (Array.isArray(result) && result.length > 0) {
        // Standard SendGrid response format: [response, body]
        const response = result[0];
        if (response && typeof response === 'object' && response.headers && typeof response.headers === 'object') {
          messageId = response.headers['x-message-id'] || 
                     response.headers['X-Message-Id'] || 
                     'sent';
        }
      } else if (result && typeof result === 'object') {
        // Check if result itself has headers (direct response object)
        if (result.headers && typeof result.headers === 'object') {
          messageId = result.headers['x-message-id'] || 
                     result.headers['X-Message-Id'] || 
                     'sent';
        }
      }
    } catch (err) {
      // If we can't extract message ID, just use 'sent' as default
      console.warn('Could not extract message ID from SendGrid response:', err.message);
      messageId = 'sent';
    }

    return { 
      success: true, 
      messageId: messageId
    };
  } catch (error) {
    // Build detailed error message with exact error details
    let errorDetails = {
      message: error.message || 'Unknown error',
      code: error.code || null,
      responseCode: error.response?.statusCode || error.response?.status || null,
      service: 'sendgrid',
    };

    // Include SendGrid-specific error details (safely)
    if (error.response) {
      errorDetails.responseBody = process.env.NODE_ENV === 'development' 
        ? error.response.body 
        : 'Response available in logs';
      // Safe access to headers - use optional chaining and null fallback
      errorDetails.responseHeaders = error.response.headers || null;
    }

    // Log detailed error information for debugging
    console.error('Email sending error details:', errorDetails);

    // Create a detailed error message string
    const errorMessageParts = [`Error: ${error.message}`];
    if (error.code) {
      errorMessageParts.push(`Code: ${error.code}`);
    }
    if (error.response?.statusCode || error.response?.status) {
      errorMessageParts.push(`HTTP Status: ${error.response.statusCode || error.response.status}`);
    }
    // Safe array check before mapping
    if (error.response?.body?.errors && Array.isArray(error.response.body.errors)) {
      const sendGridErrors = error.response.body.errors
        .map(e => (e && typeof e === 'object' && e.message) ? e.message : String(e))
        .filter(msg => msg)
        .join('; ');
      if (sendGridErrors) {
        errorMessageParts.push(`SendGrid Errors: ${sendGridErrors}`);
      }
    }

    const detailedErrorMessage = errorMessageParts.join(' | ');

    // Create error object with all details
    const emailError = new Error(detailedErrorMessage);
    emailError.code = error.code;
    emailError.responseCode = error.response?.statusCode || error.response?.status;
    emailError.originalMessage = error.message;
    emailError.service = 'sendgrid';
    // Safe array check before assigning
    if (error.response?.body?.errors && Array.isArray(error.response.body.errors)) {
      emailError.sendGridErrors = error.response.body.errors;
    }

    throw emailError;
  }
};

// Test email configuration by attempting to send a test email
const testEmailConnection = async () => {
  try {
    if (!isEmailConfigured()) {
      return {
        success: false,
        error: 'Email service is not configured. Please set SENDGRID_API_KEY environment variable.'
      };
    }

    // Initialize SendGrid
    initializeSendGrid();

    // SendGrid Web API doesn't have a verify method like SMTP
    // Instead, we can check if the API key is valid by making a simple API call
    // For testing, we'll just verify the configuration is present
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL;
    
    if (!fromEmail) {
      return {
        success: false,
        error: 'SENDGRID_FROM_EMAIL or SMTP_FROM_EMAIL is required. This should be a verified sender email in SendGrid.'
      };
    }

    if (!isValidEmail(fromEmail)) {
      return {
        success: false,
        error: `Invalid from email address format: ${fromEmail}`
      };
    }

    return {
      success: true,
      message: 'SendGrid configuration appears valid. API key and from email are set. Note: Actual sending will be tested when sending an invitation.'
    };
  } catch (error) {
    let errorMessage = error.message;
    
    if (error.response?.statusCode === 401 || error.response?.status === 401) {
      errorMessage = 'SendGrid API key is invalid or unauthorized. Please check your SENDGRID_API_KEY environment variable.';
    } else if (error.response?.statusCode === 403 || error.response?.status === 403) {
      errorMessage = 'SendGrid API key does not have permission to send emails. Please check your API key permissions.';
    } else if (error.response?.body?.errors && Array.isArray(error.response.body.errors)) {
      const sendGridErrors = error.response.body.errors
        .map(e => (e && typeof e === 'object' && e.message) ? e.message : String(e))
        .filter(msg => msg)
        .join('; ');
      if (sendGridErrors) {
        errorMessage = `SendGrid error: ${sendGridErrors}`;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      code: error.code,
      responseCode: error.response?.statusCode || error.response?.status,
      service: 'sendgrid'
    };
  }
};

// Legacy function for backward compatibility (no longer used but kept for API compatibility)
const createTransporter = () => {
  console.warn('createTransporter() is deprecated. SendGrid Web API is now used instead of SMTP.');
  return null;
};

// Send password reset email using SendGrid Web API
const sendPasswordResetEmail = async (email, username, resetUrl) => {
  // Validate email format before proceeding
  if (!isValidEmail(email)) {
    throw new Error(`Invalid email address: ${email}`);
  }

  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured. Please set SENDGRID_API_KEY environment variable.');
  }

  // Initialize SendGrid safely
  if (!isSendGridInitialized()) {
    initializeSendGrid();
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || process.env.SENDGRID_FROM_NAME || 'Trayvo Billing System';

  if (!fromEmail) {
    throw new Error('SENDGRID_FROM_EMAIL or SMTP_FROM_EMAIL environment variable is required.');
  }

  if (!isValidEmail(fromEmail)) {
    throw new Error(`Invalid from email address: ${fromEmail}`);
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Trayvo Billing System</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
        <h2 style="color: #667eea; margin-top: 0;">Password Reset Request</h2>
        <p>Hello ${username || 'User'},</p>
        <p>We received a request to reset your password for your Trayvo Billing System account.</p>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; border-left: 4px solid #667eea;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0;">Reset Password</a>
        </div>

        <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #999; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${resetUrl}</p>

        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>⚠️ Security Notice:</strong><br>
            • This link will expire in 1 hour<br>
            • If you didn't request this, please ignore this email<br>
            • Your password will remain unchanged if you don't click the link
          </p>
        </div>

        <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          This is an automated email. Please do not reply to this message.<br>
          If you have any questions, please contact your system administrator.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Password Reset Request - Trayvo Billing System
    
    Hello ${username || 'User'},
    
    We received a request to reset your password for your Trayvo Billing System account.
    
    Click the following link to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
    
    This is an automated email. Please do not reply to this message.
  `;

  const msg = {
    to: email.trim(),
    from: {
      email: fromEmail.trim(),
      name: fromName
    },
    subject: 'Reset Your Password - Trayvo Billing System',
    text: textContent,
    html: htmlContent,
  };

  try {
    const sendPromise = sgMail.send(msg);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout: Operation took longer than 30 seconds')), 30000);
    });
    
    let result;
    
    try {
      result = await Promise.race([sendPromise, timeoutPromise]);
    } catch (raceError) {
      if (raceError.message && raceError.message.includes('timeout')) {
        throw new Error('Email sending timeout: Operation took longer than 30 seconds. Please check your network connection and SendGrid service status.');
      }
      throw raceError;
    }
    
    let messageId = 'sent';
    
    try {
      if (Array.isArray(result) && result.length > 0) {
        const response = result[0];
        if (response && typeof response === 'object' && response.headers && typeof response.headers === 'object') {
          messageId = response.headers['x-message-id'] || 
                     response.headers['X-Message-Id'] || 
                     'sent';
        }
      } else if (result && typeof result === 'object') {
        if (result.headers && typeof result.headers === 'object') {
          messageId = result.headers['x-message-id'] || 
                     result.headers['X-Message-Id'] || 
                     'sent';
        }
      }
    } catch (err) {
      console.warn('Could not extract message ID from SendGrid response:', err.message);
      messageId = 'sent';
    }

    return { 
      success: true, 
      messageId: messageId
    };
  } catch (error) {
    let errorDetails = {
      message: error.message || 'Unknown error',
      code: error.code || null,
      responseCode: error.response?.statusCode || error.response?.status || null,
      service: 'sendgrid',
    };

    if (error.response) {
      errorDetails.responseBody = process.env.NODE_ENV === 'development' 
        ? error.response.body 
        : 'Response available in logs';
      errorDetails.responseHeaders = error.response.headers || null;
    }

    console.error('Email sending error details:', errorDetails);

    const errorMessageParts = [`Error: ${error.message}`];
    if (error.code) {
      errorMessageParts.push(`Code: ${error.code}`);
    }
    if (error.response?.statusCode || error.response?.status) {
      errorMessageParts.push(`HTTP Status: ${error.response.statusCode || error.response.status}`);
    }
    if (error.response?.body?.errors && Array.isArray(error.response.body.errors)) {
      const sendGridErrors = error.response.body.errors
        .map(e => (e && typeof e === 'object' && e.message) ? e.message : String(e))
        .filter(msg => msg)
        .join('; ');
      if (sendGridErrors) {
        errorMessageParts.push(`SendGrid Errors: ${sendGridErrors}`);
      }
    }

    const detailedErrorMessage = errorMessageParts.join(' | ');

    const emailError = new Error(detailedErrorMessage);
    emailError.code = error.code;
    emailError.responseCode = error.response?.statusCode || error.response?.status;
    emailError.originalMessage = error.message;
    emailError.service = 'sendgrid';
    if (error.response?.body?.errors && Array.isArray(error.response.body.errors)) {
      emailError.sendGridErrors = error.response.body.errors;
    }

    throw emailError;
  }
};

module.exports = {
  sendRegistrationInvitation,
  sendPasswordResetEmail,
  isEmailConfigured,
  createTransporter, // Kept for backward compatibility
  testEmailConnection,
};
