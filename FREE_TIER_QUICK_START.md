# Free Tier Quick Start - Zero Cost Deployment

## 🎯 Goal: Deploy for ₹0/month (Completely Free)

This is a simplified guide for **100% free** deployment. No credit cards, no payments, ever.

---

## ⚡ Quick Steps (30-45 minutes)

### 1. Database: TiDB Serverless (5 min) - FREE ✅

```
1. Go to https://tidbcloud.com
2. Sign up (free, no credit card required)
3. Create a cluster (select Serverless tier - FREE)
4. Create database: multi_shop_billing
5. Import schema from database/schema.sql
6. Save connection credentials (MySQL compatible)
```

**Cost: ₹0/month (5GB free per database)**

---

### 2. Backend: Render (10 min) - FREE ✅

```
1. Go to https://dashboard.render.com
2. Sign up (free, no credit card)
3. New Web Service → Connect GitHub
4. IMPORTANT: Select "Free" plan (not Starter!)
5. Root Directory: backend
6. Add environment variables (see env-templates/render.env.template)
7. Deploy
```

**Cost: ₹0/month**

**⚠️ Note:** Free tier spins down after 15 min. See keep-alive solution below.

---

### 3. Frontend: Vercel (5 min) - FREE ✅

```
1. Go to https://vercel.com
2. Sign up (free, no credit card)
3. Import GitHub repository
4. Add: NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
5. Deploy
```

**Cost: ₹0/month**

---

### 4. Email: Gmail (5 min) - FREE ✅

```
1. Enable 2-Step Verification in Gmail
2. Generate App Password
3. Add to Render environment variables
```

**Cost: ₹0/month**

---

### 5. Keep Render Alive (5 min) - FREE ✅

**Option A: UptimeRobot (Easiest)**
```
1. Sign up at https://uptimerobot.com (free)
2. Add monitor: https://your-backend.onrender.com/health
3. Interval: 5 minutes
4. Done! Backend stays alive 24/7
```

**Option B: GitHub Actions (Already Included)**
```
The .github/workflows/keepalive.yml file is already in your repo!
Just update the BACKEND_URL in the file after deployment.
GitHub Actions will ping your backend every 10 minutes for free.
```

**Cost: ₹0/month**

---

## 📋 Free Tier Checklist

- [ ] TiDB Serverless: Serverless tier selected (FREE)
- [ ] Render: "Free" plan selected (not Starter)
- [ ] Vercel: Free tier (automatic)
- [ ] Gmail: Free SMTP (500 emails/day)
- [ ] Keep-alive: Configured (UptimeRobot or GitHub Actions)
- [ ] All environment variables set
- [ ] Super admin created
- [ ] Application tested

---

## 💰 Cost Breakdown

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel | Free | ₹0 |
| Render | Free | ₹0 |
| TiDB Serverless | Serverless | ₹0 |
| Gmail SMTP | Free | ₹0 |
| Keep-Alive | Free | ₹0 |
| **TOTAL** | | **₹0/month** |

---

## ⚠️ Free Tier Limitations

### Render Free Tier:
- ✅ Spins down after 15 min inactivity
- ✅ First request: 30-60s wake-up time
- ✅ Solution: Use keep-alive service (free)

### TiDB Serverless Free Tier:
- ✅ 5GB storage per database
- ✅ Up to 5 databases
- ✅ MySQL compatible (no code changes needed)
- ✅ Usually enough for 50+ shops

### Vercel Free Tier:
- ✅ 100GB bandwidth/month
- ✅ Usually sufficient for many customers

---

## 🚀 When to Upgrade (Optional)

**Upgrade only when:**
- You have 2+ paying customers
- You need always-on backend (upgrade Render to ₹700/month)
- Database exceeds 5GB (upgrade TiDB to paid plan)

**Free tier is perfect for:**
- Getting started
- Testing
- 1-5 customers
- Proof of concept

---

## 📚 Detailed Guides

- **Complete Free Guide:** `FREE_DEPLOYMENT_GUIDE.md`
- **Full Deployment Plan:** `cloud-deployment-plan.plan.md`
- **Environment Templates:** `env-templates/`

---

## ✅ You're Ready!

Follow the steps above for **100% free deployment**. No credit cards needed, no hidden costs!

**Start with:** Database → Backend → Frontend → Keep-Alive → Test

Good luck! 🎉

