# Invitation Email Troubleshooting Guide

This document lists all potential reasons why invitation emails might fail and how to fix them.

## ✅ Fixes Already Applied

1. **Timeout increased**: Frontend API timeout increased from 10s to 30s
2. **SMTP timeouts configured**: Connection, greeting, and socket timeouts set to 20s
3. **Password space removal**: Gmail app passwords with spaces are automatically cleaned
4. **Connection verification**: SMTP connection is verified before sending
5. **Better error messages**: Specific error messages for different failure types
6. **Email validation**: Email format is validated before sending

## 🔍 Potential Issues and Solutions

### 1. Gmail App Password Issues

**Problem**: Gmail app passwords often have spaces when copied (e.g., `uoir jlkq jfpx qixs`)

**Solution**: ✅ **FIXED** - Code now automatically removes spaces from passwords

**Check**: In Render dashboard, ensure `SMTP_PASSWORD` has no spaces:
- ❌ Wrong: `uoir jlkq jfpx qixs`
- ✅ Correct: `uoirjlkqjfpxqixs`

### 2. Gmail Authentication Errors

**Common Error Codes**:
- `EAUTH` or `535`: Authentication failed

**Possible Causes**:
1. Using regular Gmail password instead of App Password
2. App Password not generated correctly
3. 2-Step Verification not enabled
4. Account security settings blocking access

**Solutions**:
1. **Generate new App Password**:
   - Go to https://myaccount.google.com
   - Security → 2-Step Verification → App Passwords
   - Generate new password for "Mail"
   - Copy the 16-character password (no spaces)

2. **Verify 2-Step Verification is enabled**:
   - Required for App Passwords to work

3. **Check account security**:
   - Ensure account is not locked or restricted
   - Check for security alerts in Gmail

### 3. SMTP Connection Issues

**Common Error Codes**:
- `ECONNECTION`: Cannot connect to SMTP server
- `ETIMEDOUT`: Connection timeout

**Possible Causes**:
1. Render blocking outbound SMTP connections
2. Firewall blocking port 587/465
3. Gmail blocking Render's IP addresses
4. Network issues

**Solutions**:
1. **Check Render logs** for specific connection errors
2. **Try different SMTP port**:
   - Port 587 (TLS) - Current setting
   - Port 465 (SSL) - Alternative
   - Update `SMTP_PORT` in Render if needed

3. **Use different email provider**:
   - SendGrid (free tier: 100 emails/day)
   - Mailgun (free tier: 5,000 emails/month)
   - AWS SES (very cheap, pay-as-you-go)

### 4. Email Address Validation

**Problem**: Invalid email format

**Solution**: ✅ **FIXED** - Email format is now validated before sending

**Check**: Ensure email addresses are valid:
- ✅ Valid: `user@example.com`
- ❌ Invalid: `user@example`, `user example.com`, `@example.com`

### 5. Gmail Rate Limiting

**Problem**: Gmail limits emails per day (500 emails/day for free accounts)

**Solution**: 
- Monitor email sending frequency
- Use dedicated email service for production

### 6. Render Network Restrictions

**Problem**: Render free tier might have network restrictions

**Solution**:
- Check Render documentation for SMTP restrictions
- Consider upgrading to paid tier if needed
- Use external email service (SendGrid, Mailgun)

### 7. TLS/SSL Configuration Issues

**Problem**: Incorrect TLS/SSL settings

**Solution**: ✅ **FIXED** - Code now properly handles:
- Port 465 → SSL (secure: true)
- Port 587 → TLS (requireTLS: true)
- TLS certificate validation

### 8. Email Template Issues

**Problem**: HTML email template might have issues

**Solution**: ✅ **VERIFIED** - Template is valid HTML with proper escaping

### 9. Missing Environment Variables

**Problem**: SMTP variables not set in Render

**Solution**: 
- Check Render dashboard → Environment Variables
- Ensure all required variables are set:
  - `SMTP_HOST`
  - `SMTP_USER`
  - `SMTP_PASSWORD`
  - `SMTP_PORT` (optional, defaults to 587)
  - `SMTP_FROM_EMAIL` (optional, uses SMTP_USER)
  - `SMTP_FROM_NAME` (optional)

### 10. Frontend URL Configuration

**Problem**: `FRONTEND_URL` not set correctly, causing invalid registration links

**Solution**:
- Check `FRONTEND_URL` in Render environment variables
- Should be: `https://your-app.vercel.app` (no trailing slash)
- Registration URL format: `${FRONTEND_URL}/register?token=${token}`

## 🔧 Debugging Steps

### Step 1: Check Render Logs

1. Go to Render dashboard → Your service → Logs
2. Look for:
   - "Email sending error"
   - "SMTP authentication failed"
   - "Connection timeout"
   - Specific error codes

### Step 2: Verify Environment Variables

In Render dashboard, check:
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=your-email@gmail.com`
- `SMTP_PASSWORD=your-16-char-app-password` (no spaces)
- `SMTP_FROM_EMAIL=your-email@gmail.com`
- `SMTP_FROM_NAME=Trayvo Billing` (or your preferred name)

### Step 3: Test SMTP Connection

You can test the SMTP connection by checking Render logs when sending an invitation. The code now:
- Verifies connection before sending
- Logs detailed error information
- Shows specific error messages

### Step 4: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try sending invitation
4. Look for error messages
5. Check Network tab for API response

### Step 5: Verify Gmail Settings

1. Go to https://myaccount.google.com/security
2. Check "2-Step Verification" is enabled
3. Check "App Passwords" section
4. Verify app password is active
5. Generate new app password if needed

## 📋 Quick Checklist

- [ ] SMTP_HOST is set correctly (`smtp.gmail.com`)
- [ ] SMTP_PORT is set correctly (`587` for TLS)
- [ ] SMTP_USER is your Gmail address
- [ ] SMTP_PASSWORD is a 16-character App Password (no spaces)
- [ ] 2-Step Verification is enabled in Gmail
- [ ] App Password is generated for "Mail"
- [ ] FRONTEND_URL is set correctly (your Vercel URL)
- [ ] No firewall blocking port 587
- [ ] Render service is running (not sleeping)
- [ ] Check Render logs for specific errors

## 🚀 Alternative Solutions

If Gmail continues to fail, consider:

### Option 1: SendGrid (Recommended)
- Free tier: 100 emails/day
- Easy setup
- Better reliability
- API-based (no SMTP needed)

### Option 2: Mailgun
- Free tier: 5,000 emails/month
- Good for production
- SMTP and API options

### Option 3: AWS SES
- Very cheap (pay-as-you-go)
- High reliability
- Requires AWS account setup

## 📝 Current Status

All known issues have been addressed:
- ✅ Timeout issues fixed
- ✅ Password space removal implemented
- ✅ Connection verification added
- ✅ Better error messages
- ✅ Email validation added
- ✅ TLS/SSL configuration improved

## 🆘 Still Having Issues?

1. **Check Render logs** for the exact error message
2. **Verify all environment variables** are set correctly
3. **Test with a different email provider** (SendGrid, Mailgun)
4. **Check Gmail account** for security alerts
5. **Generate a new App Password** and update in Render

The registration token is always generated even if email fails, so you can share the registration URL manually if needed.

