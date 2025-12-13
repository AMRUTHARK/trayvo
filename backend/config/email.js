const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // If SMTP is not configured, return null (email sending will be disabled)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return null;
  }

  // Remove spaces from password (Gmail app passwords often have spaces when copied)
  const smtpPassword = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');
  
  // Validate required fields
  if (!smtpPassword) {
    throw new Error('SMTP_PASSWORD is required but not set');
  }

  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const isSecure = smtpPort === 465;

  return nodemailer.createTransport({
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
    // Additional options for better compatibility
    tls: {
      rejectUnauthorized: false, // Accept self-signed certificates (for some SMTP servers)
      ciphers: 'SSLv3', // Use SSLv3 for compatibility
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
    logger: process.env.NODE_ENV === 'development', // Enable logger in development
  });
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
          <p>You have been invited to register an account for <strong>${shopName}</strong>.</p>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
            <p style="margin: 0;"><strong>Shop ID:</strong> ${shopId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Shop Name:</strong> ${shopName}</p>
          </div>

          <p>Click the button below to complete your registration:</p>
          
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

You have been invited to register an account for ${shopName}.

Shop ID: ${shopId}
Shop Name: ${shopName}

Complete your registration by visiting:
${registrationUrl}

Important: This invitation link will expire in 7 days. Please complete your registration before then.

If you did not request this invitation, please ignore this email.
    `.trim(),
  };

  try {
    // Verify connection before sending
    await transporter.verify();
    
    // Set a timeout for the email sending operation
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout: Operation took longer than 25 seconds')), 25000);
    });
    
    const info = await Promise.race([sendPromise, timeoutPromise]);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Provide more specific error messages
    let errorMessage = error.message;
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = 'SMTP authentication failed. Please check your SMTP_USER and SMTP_PASSWORD. For Gmail, ensure you are using an App Password (not your regular password).';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Cannot connect to SMTP server. Please check SMTP_HOST and SMTP_PORT, and ensure your network/firewall allows SMTP connections.';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = `Invalid email address: ${email}. Please check the recipient email format.`;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Email sending timed out. This might be due to network issues or SMTP server being slow. Please try again.';
    } else if (error.responseCode === 550 || error.responseCode === 553) {
      errorMessage = `Email rejected by server. Check if the recipient email address (${email}) is valid and not blocked.`;
    }
    
    console.error('Email sending error details:', {
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
      message: error.message,
      response: error.response,
    });
    
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};

// Verify email configuration
const isEmailConfigured = () => {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
};

module.exports = {
  sendRegistrationInvitation,
  isEmailConfigured,
  createTransporter,
};

