# 100% Free Cloud Deployment Guide

This guide ensures **completely free** deployment using free tiers only. No credit card required!

## ✅ Free Tier Services Used

| Service | Free Tier | Limitations |
|---------|-----------|-------------|
| **Vercel** (Frontend) | ✅ Free Forever | Unlimited projects, 100GB bandwidth/month |
| **Render** (Backend) | ✅ Free Tier | Spins down after 15 min inactivity (wakes up in 30-60s) |
| **TiDB Serverless** (Database) | ✅ Free Forever | 5 databases, 5GB storage each, MySQL compatible |
| **Gmail SMTP** | ✅ Free | 500 emails/day |

**Total Cost: ₹0/month (Completely Free!)**

---

## 🚨 Important: Render Free Tier Limitation

**Render's free tier spins down after 15 minutes of inactivity.**

**What this means:**
- First request after inactivity: Takes 30-60 seconds to wake up
- Subsequent requests: Fast (normal speed)
- **Solution:** Use a free keep-alive service (see below)

**Alternative Free Backend Options:**
1. **Railway** - $5 free credit/month (enough for small apps)
2. **Fly.io** - Free tier available
3. **Cyclic** - Free tier available
4. **Render with Keep-Alive** - Free + free keep-alive service

---

## 📋 Free Deployment Steps

### Step 1: Database (TiDB Serverless) - FREE ✅

1. Go to https://tidbcloud.com
2. Sign up (free, no credit card required)
3. Create a new cluster
4. **Select:** **"Serverless"** tier (free tier)
5. Create database: `multi_shop_billing`
6. Import schema from `database/schema.sql`
7. Get connection credentials (MySQL compatible)

**Free Tier Includes:**
- Up to 5 databases
- 5GB storage per database
- MySQL compatible (works with existing code)
- Automatic backups
- **No credit card required**

---

### Step 2: Backend (Render) - FREE ✅

1. Go to https://dashboard.render.com
2. Sign up (free, no credit card)
3. **New Web Service** → Connect GitHub
4. **Important Settings:**
   - **Plan:** Select **"Free"** (not Starter)
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables (see template)
6. Deploy

**Free Tier Includes:**
- Web services (spins down after 15 min)
- Automatic deployments
- HTTPS
- **No credit card required**

**⚠️ Spin-Down Issue:** First request after 15 min inactivity takes 30-60s. See "Keep-Alive Solution" below.

---

### Step 3: Frontend (Vercel) - FREE ✅

1. Go to https://vercel.com
2. Sign up (free, no credit card)
3. Import GitHub repository
4. Add environment variable: `NEXT_PUBLIC_API_URL`
5. Deploy

**Free Tier Includes:**
- Unlimited projects
- 100GB bandwidth/month
- Automatic HTTPS
- Global CDN
- **No credit card required**

---

### Step 4: Email (Gmail) - FREE ✅

1. Enable 2-Step Verification in Gmail
2. Generate App Password
3. Use in Render environment variables

**Free Tier Includes:**
- 500 emails/day
- SMTP access
- **No credit card required**

---

## 🔧 Solution: Keep Render Alive (Free)

Since Render free tier spins down, use a **free keep-alive service** to ping your backend every 10 minutes.

### Option 1: UptimeRobot (Recommended - Free)

1. Sign up at https://uptimerobot.com (free)
2. Add new monitor:
   - **Type:** HTTP(s)
   - **URL:** `https://your-backend.onrender.com/health`
   - **Interval:** 5 minutes
3. This keeps your backend alive 24/7 for free!

### Option 2: cron-job.org (Free)

1. Sign up at https://cron-job.org (free)
2. Create new cron job:
   - **URL:** `https://your-backend.onrender.com/health`
   - **Schedule:** Every 5 minutes
3. Keeps backend alive for free!

### Option 3: GitHub Actions (Free)

Create `.github/workflows/keepalive.yml`:

```yaml
name: Keep Render Alive

on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render
        run: |
          curl -f https://your-backend.onrender.com/health || exit 0
```

This uses GitHub's free Actions (2000 minutes/month - more than enough).

---

## 🆓 Alternative Free Backend Options

If Render's spin-down is unacceptable, consider these alternatives:

### Option A: Railway (Recommended Alternative)

1. Sign up at https://railway.app
2. **Free tier:** $5 credit/month (enough for small apps)
3. **Benefits:**
   - Always-on (no spin-down)
   - Better performance
   - Easy deployment
4. **Cost:** Free (uses $5 credit, resets monthly)

### Option B: Fly.io

1. Sign up at https://fly.io
2. **Free tier:** 3 shared-cpu VMs
3. **Benefits:**
   - Always-on
   - Good performance
4. **Cost:** Free (with usage limits)

### Option C: Cyclic

1. Sign up at https://cyclic.sh
2. **Free tier:** Always-on apps
3. **Benefits:**
   - No spin-down
   - Easy deployment
4. **Cost:** Free (with usage limits)

---

## 📝 Free Tier Environment Variables

### Render (Backend) - Free Tier

```env
NODE_ENV=production
PORT=10000
DB_HOST=<tidb-host>
DB_USER=<tidb-username>
DB_PASSWORD=<tidb-password>
DB_NAME=multi_shop_billing
DB_PORT=4000
JWT_SECRET=<generate-using-script>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-app.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Multi-Shop Billing System
```

### Vercel (Frontend) - Free Tier

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

---

## ✅ Free Deployment Checklist

- [ ] TiDB Cloud account created (free)
- [ ] TiDB Serverless cluster created (free tier)
- [ ] Render account created (free)
- [ ] Backend deployed on free tier
- [ ] Vercel account created (free)
- [ ] Frontend deployed (free tier)
- [ ] Gmail app password generated (free)
- [ ] Keep-alive service configured (free - optional but recommended)
- [ ] All environment variables set
- [ ] Super admin created
- [ ] Application tested

---

## 💡 Free Tier Best Practices

1. **Use Keep-Alive:** Prevents spin-down delays
2. **Monitor Usage:** Check TiDB Serverless storage (5GB free)
3. **Optimize:** Keep database queries efficient
4. **Backup:** TiDB Serverless auto-backups are free
5. **Scale When Needed:** Upgrade only when you have paying customers

---

## 🚀 When to Upgrade (Optional)

**Upgrade only when:**
- You have 2+ paying customers
- Render spin-down becomes a problem
- Database approaches 1GB limit
- You need better performance

**Upgrade Costs:**
- Render Starter: ₹700/month (~$7)
- TiDB Paid Plan: ₹2,900/month (~$29) (only if needed)
- **Total:** ₹3,600/month (only when needed)

**Free tier is sufficient for:**
- 1-5 customers
- Testing and development
- Small-scale production
- Getting started

---

## 🎯 Summary

**100% Free Setup:**
- ✅ Vercel: Free forever
- ✅ Render: Free (with keep-alive solution)
- ✅ TiDB Serverless: Free forever
- ✅ Gmail: Free
- ✅ Keep-Alive: Free (UptimeRobot/cron-job.org)

**Total Monthly Cost: ₹0**

**Ready to deploy for free?** Follow the main deployment plan but ensure you select **"Free"** plans on all services!

