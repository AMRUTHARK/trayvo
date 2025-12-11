# Email Configuration for Registration Invitations

This guide explains how to configure email sending for registration invitations in the Multi-Shop Billing System.

## Overview

The system uses email invitations to control user registration. When a super admin creates a shop or sends an invitation, an email is sent to the specified address with a secure registration link.

## Email Service Setup

### Option 1: Gmail (Recommended for Testing)

1. **Enable App Password in Gmail:**
   - Go to your Google Account settings
   - Navigate to Security → 2-Step Verification
   - Enable 2-Step Verification if not already enabled
   - Go to App Passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

2. **Configure in `backend/.env`:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-character-app-password
   SMTP_FROM_EMAIL=your-email@gmail.com
   SMTP_FROM_NAME=Multi-Shop Billing System
   ```

### Option 2: Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=your-email@outlook.com
SMTP_FROM_NAME=Multi-Shop Billing System
```

### Option 3: Custom SMTP Server

```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Multi-Shop Billing System
```

## Environment Variables

Add these to your `backend/.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port (usually 587 for TLS, 465 for SSL) | `587` |
| `SMTP_USER` | SMTP username (usually your email) | `your-email@gmail.com` |
| `SMTP_PASSWORD` | SMTP password or app password | `your-app-password` |
| `SMTP_FROM_EMAIL` | Email address to send from | `your-email@gmail.com` |
| `SMTP_FROM_NAME` | Display name for sender | `Multi-Shop Billing System` |

## Testing Email Configuration

1. Start the backend server
2. Login as super admin
3. Go to Super Admin dashboard
4. Click "Invite" button for any shop
5. Enter an email address and send invitation
6. Check the email inbox for the registration link

## Manual Token Sharing (If Email Not Configured)

If email is not configured, the system will still generate registration tokens. You can:

1. Send invitation from Super Admin dashboard
2. Check the browser console or server logs for the registration URL
3. Manually share the URL with the shop owner

The registration URL format is:
```
http://localhost:3000/register?token=YOUR_TOKEN_HERE
```

## Troubleshooting

### Email Not Sending

1. **Check SMTP credentials:**
   - Verify username and password are correct
   - For Gmail, ensure you're using an App Password, not your regular password

2. **Check firewall/network:**
   - Ensure port 587 or 465 is not blocked
   - Some networks block SMTP ports

3. **Check server logs:**
   - Look for error messages in the backend console
   - Common errors:
     - `Invalid login credentials` - Wrong username/password
     - `Connection timeout` - Firewall blocking SMTP port
     - `Self-signed certificate` - SSL certificate issue

4. **Test with different email provider:**
   - Try Gmail first (easiest to set up)
   - If Gmail works, the issue is with your original SMTP settings

### Registration Link Not Working

1. **Check token expiration:**
   - Tokens expire after 7 days
   - Generate a new invitation if expired

2. **Check if token already used:**
   - Each token can only be used once
   - Generate a new invitation for additional users

3. **Verify frontend URL:**
   - Ensure `FRONTEND_URL` in `backend/.env` matches your frontend URL
   - Default: `http://localhost:3000` for development

## Security Notes

- Never commit `.env` files to version control
- Use App Passwords for Gmail instead of your main password
- Tokens expire after 7 days for security
- Each token can only be used once
- Email addresses are validated before sending

## Production Deployment

For production, consider:

1. **Dedicated email service:**
   - SendGrid
   - Mailgun
   - Amazon SES
   - Postmark

2. **Environment variables:**
   - Set SMTP variables in your hosting platform (Render, Vercel, etc.)
   - Never hardcode credentials

3. **Rate limiting:**
   - The system already includes rate limiting
   - Monitor for abuse

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple email provider (Gmail) first
4. Check that your hosting provider allows SMTP connections

