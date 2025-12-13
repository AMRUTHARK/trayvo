# SendGrid Email Setup Guide

This guide explains how to set up SendGrid for sending registration invitation emails. SendGrid is **recommended for Render deployments** as it works reliably without network restrictions.

## Why SendGrid?

- ✅ **Works reliably on Render** (no SMTP blocking issues)
- ✅ **Free forever** (100 emails/day, no credit card required)
- ✅ **Better deliverability** than Gmail SMTP
- ✅ **No 2-Step Verification needed**
- ✅ **Professional email service**

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

## Step 3: Verify Sender Email (Optional but Recommended)

1. Go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"**
3. Fill in your email details
4. Check your email and click the verification link
5. This improves email deliverability

## Step 4: Configure in Render

In your Render dashboard → Your Service → Environment Variables, set:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-actual-api-key-here
SMTP_FROM_EMAIL=your-verified-email@example.com
SMTP_FROM_NAME=Trayvo Billing
```

**Important Notes:**
- `SMTP_USER` must be exactly `apikey` (literal string, not your SendGrid username)
- `SMTP_PASSWORD` is your SendGrid API key (the long string starting with `SG.`)
- `SMTP_FROM_EMAIL` should be your verified email address

## Step 5: Test Email Sending

1. Restart your Render service (to load new environment variables)
2. Try sending a registration invitation from your application
3. Check the recipient's inbox (and spam folder)
4. Check Render logs for any errors

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Ensure `SMTP_USER=apikey` (exact string) and `SMTP_PASSWORD` is your full API key
2. **Check Render Logs**: Look for "Email sending error details" in logs
3. **Verify Sender**: Make sure sender email is verified in SendGrid
4. **Check Daily Limit**: Free tier allows 100 emails/day

### Authentication Errors

- **Error**: "SendGrid authentication failed"
- **Solution**: 
  - Verify `SMTP_USER` is exactly `apikey` (not your email)
  - Verify `SMTP_PASSWORD` is your complete API key (starts with `SG.`)
  - Check API key hasn't been revoked in SendGrid dashboard

### Connection Errors

- **Error**: "Cannot connect to SendGrid SMTP server"
- **Solution**: 
  - Verify `SMTP_HOST=smtp.sendgrid.net`
  - Verify `SMTP_PORT=587`
  - Check Render service is running

## SendGrid Free Tier Limits

- **100 emails per day** (resets every 24 hours)
- **Unlimited days** (free forever)
- **~3,000 emails per month** (if using full daily limit)

## Upgrade Options (If Needed)

If you need more than 100 emails/day:
- **Essentials Plan**: $19.95/month = 50,000 emails/month
- **Pro Plan**: $89.95/month = 100,000 emails/month

## Comparison: SendGrid vs Gmail

| Feature | SendGrid | Gmail SMTP |
|---------|----------|------------|
| Works on Render | ✅ Yes | ❌ Often blocked |
| Free Tier | 100/day | 500/day |
| Setup Complexity | Easy | Requires App Password |
| Deliverability | Excellent | Good |
| Professional | ✅ Yes | ⚠️ Personal email |

## Next Steps

After setting up SendGrid:
1. Test sending an invitation
2. Monitor SendGrid dashboard for email statistics
3. Check email deliverability in SendGrid analytics

For more help, visit: https://docs.sendgrid.com/

