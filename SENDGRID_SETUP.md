# SendGrid Email Setup Guide

This guide explains how to set up SendGrid for sending registration invitation emails using the **SendGrid Web API**. This is **recommended for Render deployments** as it uses HTTPS (port 443) which is much more reliable than SMTP and eliminates connection timeout issues.

## Why SendGrid Web API?

- ✅ **Works reliably on Render** (uses HTTPS, no SMTP blocking issues)
- ✅ **No connection timeouts** (Web API is more stable than SMTP)
- ✅ **Free forever** (100 emails/day, no credit card required)
- ✅ **Better deliverability** than Gmail SMTP
- ✅ **No 2-Step Verification needed**
- ✅ **Professional email service**
- ✅ **Faster and more reliable** than SMTP connections

## Step 1: Create SendGrid Account

1. Go to https://sendgrid.com
2. Click "Start for Free"
3. Sign up (no credit card required)
4. Verify your email address

## Step 2: Create API Key

1. In SendGrid dashboard, go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. **Name**: Enter a name (e.g., "Billing System")
4. **Permissions**: Select **"Full Access"** or **"Mail Send"** (minimum required)
5. Click **"Create & View"**
6. **IMPORTANT**: Copy the API key immediately (it's shown only once!)
   - Format: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - It's a long string starting with `SG.`

## Step 3: Verify Sender Email (Required)

1. Go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in your email details:
   - **From Email**: Your email address
   - **From Name**: Your name or company name
   - **Reply To**: Your email address
   - **Company Address**: Your business address
4. Check your email and click the verification link
5. **This is required** - SendGrid will not send emails from unverified addresses

## Step 4: Configure in Render

In your Render dashboard → Your Service → Environment Variables, set:

```
SENDGRID_API_KEY=SG.your-actual-api-key-here
SENDGRID_FROM_EMAIL=your-verified-email@example.com
SENDGRID_FROM_NAME=Trayvo Billing
```

**OR** (for backward compatibility):

```
SENDGRID_API_KEY=SG.your-actual-api-key-here
SMTP_FROM_EMAIL=your-verified-email@example.com
SMTP_FROM_NAME=Trayvo Billing
```

### Required Variables:

- **SENDGRID_API_KEY** (required): Your SendGrid API key from Step 2
- **SENDGRID_FROM_EMAIL** or **SMTP_FROM_EMAIL** (required): The verified sender email from Step 3
- **SENDGRID_FROM_NAME** or **SMTP_FROM_NAME** (optional): Display name for emails (defaults to "Trayvo Billing System")

### Important Notes:

- The `SENDGRID_API_KEY` must start with `SG.`
- The `FROM_EMAIL` must be verified in SendGrid (Step 3)
- You can use either `SENDGRID_*` or `SMTP_*` prefix for FROM_EMAIL and FROM_NAME (for backward compatibility)
- **No SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASSWORD needed** - Web API doesn't use SMTP

## Step 5: Test the Configuration

1. Deploy your application to Render
2. Try sending a registration invitation from the superadmin panel
3. Check the logs if there are any errors
4. Verify the email is received

## Troubleshooting

### Error: "Email service is not configured"
- Make sure `SENDGRID_API_KEY` is set in Render environment variables
- Check that the API key starts with `SG.`

### Error: "SENDGRID_FROM_EMAIL is required"
- Set `SENDGRID_FROM_EMAIL` or `SMTP_FROM_EMAIL` in environment variables
- Make sure the email is verified in SendGrid dashboard

### Error: "401 Unauthorized" or "403 Forbidden"
- Check that your API key is correct
- Verify the API key has "Mail Send" permissions
- Make sure you copied the entire API key (it's very long)

### Error: "The from address does not match a verified Sender Identity"
- Go to SendGrid dashboard → Settings → Sender Authentication
- Verify your sender email address
- Wait a few minutes after verification for changes to propagate

### Emails not being received
- Check SendGrid dashboard → Activity Feed to see if emails are being sent
- Check spam/junk folder
- Verify the recipient email address is correct
- Check SendGrid account limits (free tier: 100 emails/day)

## Migration from SMTP

If you were previously using SMTP configuration:

1. **Remove** these environment variables (no longer needed):
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASSWORD`

2. **Add** these environment variables:
   - `SENDGRID_API_KEY` (your SendGrid API key)
   - `SENDGRID_FROM_EMAIL` (or keep `SMTP_FROM_EMAIL` for compatibility)
   - `SENDGRID_FROM_NAME` (or keep `SMTP_FROM_NAME` for compatibility)

3. **Restart** your Render service

The application will automatically use the SendGrid Web API instead of SMTP.

## Benefits of Web API over SMTP

1. **No connection timeouts**: Web API uses HTTPS which is more reliable
2. **Better error messages**: SendGrid API provides detailed error responses
3. **Faster**: No SMTP handshake required
4. **More reliable on cloud platforms**: HTTPS is rarely blocked
5. **Better debugging**: SendGrid dashboard shows detailed sending statistics

## Free Tier Limits

- **100 emails/day** (free forever)
- **Unlimited contacts**
- **Full API access**
- **Email analytics**

For production use with higher volume, consider upgrading to a paid plan.

## Support

- SendGrid Documentation: https://docs.sendgrid.com
- SendGrid Support: https://support.sendgrid.com
- Render Documentation: https://render.com/docs
