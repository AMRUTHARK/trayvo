const nodemailer = require('nodemailer');

// Detect which email service is being used
const detectEmailService = () => {
  const host = process.env.SMTP_HOST?.toLowerCase() || '';
  if (host.includes('sendgrid')) {
    return 'sendgrid';
  } else if (host.includes('gmail')) {
    return 'gmail';
  } else if (host.includes('mailgun')) {
    return 'mailgun';
  }
  return 'generic';
};

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // If SMTP is not configured, return null (email sending will be disabled)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return null;
  }

  const emailService = detectEmailService();
  
  // Remove spaces from password (Gmail app passwords often have spaces when copied)
  // SendGrid API keys don't have spaces, but this won't hurt
  const smtpPassword = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');
  
  // Validate required fields
  if (!smtpPassword) {
    throw new Error('SMTP_PASSWORD is required but not set');
  }

  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const isSecure = smtpPort === 465;

  // Base configuration
  const transporterConfig = {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: isSecure, // true for 465 (SSL), false for 587 (TLS)
    requireTLS: !isSecure && smtpPort === 587, // Require TLS for port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPassword,
    },
    connectionTimeout: 20000, // 20 seconds to establish connection
    greetingTimeout: 20000, // 20 seconds for greeting
    socketTimeout: 20000, // 20 seconds for socket operations
    debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
    logger: process.env.NODE_ENV === 'development', // Enable logger in development
  };

  // SendGrid-specific optimizations (works better on Render)
  if (emailService === 'sendgrid') {
    transporterConfig.tls = {
      rejectUnauthorized: true, // SendGrid uses valid certificates
      // Use modern TLS versions - Node.js defaults work well with SendGrid
    };
    // SendGrid is reliable on Render, so we can use standard timeouts
    transporterConfig.connectionTimeout = 15000;
    transporterConfig.greetingTimeout = 15000;
    transporterConfig.socketTimeout = 15000;
  } else {
    // Generic SMTP (Gmail, etc.) - more lenient settings
    transporterConfig.tls = {
      rejectUnauthorized: false, // Don't reject self-signed certificates
      // Use modern TLS versions - removed deprecated SSLv3 cipher
      // Let Node.js use default cipher suites (TLS 1.2/1.3 compatible)
    };
  }

  return nodemailer.createTransport(transporterConfig);
};

// Send registration invitation email
const sendRegistrationInvitation = async (email, shopName, shopId, token, registrationUrl) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    throw new Error('Email service is not configured. Please set SMTP environment variables.');
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.SMTP_FROM_NAME || 'Multi-Shop Billing System';

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: `Registration Invitation - ${shopName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Invitation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Multi-Shop Billing System</h1>
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
    `,
    text: `
Multi-Shop Billing System - Registration Invitation

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
    `.trim(),
  };

  try {
    // Skip verify() for faster connections - sendMail will handle connection internally
    // verify() can cause unnecessary delays on slow networks (like Render)
    
    // Set a timeout for the email sending operation
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout: Operation took longer than 30 seconds')), 30000);
    });
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Provide more specific error messages based on email service
    let errorMessage = error.message;
    const emailService = detectEmailService();
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      if (emailService === 'sendgrid') {
        errorMessage = 'SendGrid authentication failed. Please check your SMTP_USER (should be "apikey") and SMTP_PASSWORD (should be your SendGrid API key).';
      } else if (emailService === 'gmail') {
        errorMessage = 'Gmail authentication failed. Please check your SMTP_USER and SMTP_PASSWORD. Ensure you are using an App Password (not your regular password).';
      } else {
        errorMessage = 'SMTP authentication failed. Please check your SMTP_USER and SMTP_PASSWORD.';
      }
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      if (emailService === 'sendgrid') {
        errorMessage = 'Cannot connect to SendGrid SMTP server. Please check SMTP_HOST (should be smtp.sendgrid.net) and SMTP_PORT (should be 587). SendGrid works reliably on Render.';
      } else {
        errorMessage = 'Cannot connect to SMTP server. Please check SMTP_HOST and SMTP_PORT, and ensure your network/firewall allows SMTP connections. For Render, consider using SendGrid (smtp.sendgrid.net) which is not blocked.';
      }
    } else if (error.code === 'EENVELOPE') {
      errorMessage = `Invalid email address: ${email}. Please check the recipient email format.`;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Email sending timed out. This might be due to network issues or SMTP server being slow. Please try again.';
    } else if (error.responseCode === 550 || error.responseCode === 553) {
      errorMessage = `Email rejected by server. Check if the recipient email address (${email}) is valid and not blocked.`;
    }
    
    // Log detailed error information for debugging
    console.error('Email sending error details:', {
      service: emailService,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
      message: error.message,
      errorMessage: errorMessage,
      // Only log full response in development (may contain sensitive info)
      response: process.env.NODE_ENV === 'development' ? error.response : undefined,
    });
    
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};

// Verify email configuration
const isEmailConfigured = () => {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
};

// Test email configuration by attempting to verify connection
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return {
        success: false,
        error: 'Email service is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.'
      };
    }

    // Verify connection
    await transporter.verify();
    
    return {
      success: true,
      message: 'Email configuration is valid and connection successful'
    };
  } catch (error) {
    let errorMessage = error.message;
    const emailService = detectEmailService();
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      if (emailService === 'sendgrid') {
        errorMessage = 'SendGrid authentication failed. Please check your SMTP_USER (should be "apikey") and SMTP_PASSWORD (should be your SendGrid API key).';
      } else if (emailService === 'gmail') {
        errorMessage = 'Gmail authentication failed. Please check your SMTP_USER and SMTP_PASSWORD. Ensure you are using an App Password (not your regular password).';
      } else {
        errorMessage = 'SMTP authentication failed. Please check your SMTP_USER and SMTP_PASSWORD.';
      }
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      if (emailService === 'sendgrid') {
        errorMessage = 'Cannot connect to SendGrid SMTP server. Please check SMTP_HOST (should be smtp.sendgrid.net) and SMTP_PORT (should be 587). SendGrid works reliably on Render.';
      } else {
        errorMessage = 'Cannot connect to SMTP server. Please check SMTP_HOST and SMTP_PORT, and ensure your network/firewall allows SMTP connections. For Render, consider using SendGrid (smtp.sendgrid.net) which is not blocked.';
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      code: error.code,
      responseCode: error.responseCode,
      service: emailService
    };
  }
};

module.exports = {
  sendRegistrationInvitation,
  isEmailConfigured,
  createTransporter,
  testEmailConnection,
};

