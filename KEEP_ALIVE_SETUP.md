# Keep-Alive Setup for Render Free Tier

## Why Keep-Alive?

Render's **free tier** spins down after 15 minutes of inactivity. The first request after spin-down takes 30-60 seconds to wake up the service.

**Solution:** Ping your backend every 10 minutes to keep it alive 24/7!

---

## ✅ Option 1: GitHub Actions (Already Included!)

**Easiest option - already in your repository!**

### Setup Steps:

1. **After deploying to Render**, get your backend URL:
   - Example: `https://multi-shop-billing-api.onrender.com`

2. **Update `.github/workflows/keepalive.yml`:**
   - Replace `https://your-backend.onrender.com` with your actual URL
   - Or set it as a GitHub secret (see below)

3. **Push to GitHub:**
   ```bash
   git add .github/workflows/keepalive.yml
   git commit -m "Configure keep-alive for Render backend"
   git push
   ```

4. **Enable GitHub Actions:**
   - Go to your GitHub repository
   - Click "Actions" tab
   - The workflow will start automatically
   - Runs every 10 minutes (free on GitHub!)

**Cost: ₹0/month** (GitHub Actions free tier: 2000 minutes/month - more than enough!)

---

## ✅ Option 2: UptimeRobot (Recommended - Easiest)

**Best for beginners - no code changes needed!**

### Setup Steps:

1. **Sign up at https://uptimerobot.com** (free, no credit card)

2. **Add New Monitor:**
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Render Backend Keep-Alive
   - **URL:** `https://your-backend.onrender.com/health`
   - **Monitoring Interval:** 5 minutes
   - Click "Create Monitor"

3. **Done!** Your backend will stay alive 24/7

**Cost: ₹0/month** (Free tier: 50 monitors)

---

## ✅ Option 3: cron-job.org

**Simple cron job service**

### Setup Steps:

1. **Sign up at https://cron-job.org** (free)

2. **Create Cron Job:**
   - **Title:** Render Keep-Alive
   - **Address:** `https://your-backend.onrender.com/health`
   - **Schedule:** Every 5 minutes
   - Click "Create Cronjob"

3. **Done!**

**Cost: ₹0/month** (Free tier available)

---

## ✅ Option 4: Manual Script (Advanced)

If you have a server or VPS, you can run a simple cron job:

```bash
# Add to crontab (runs every 10 minutes)
*/10 * * * * curl -f https://your-backend.onrender.com/health > /dev/null 2>&1
```

---

## 🎯 Which Option to Choose?

| Option | Difficulty | Setup Time | Best For |
|--------|-----------|------------|----------|
| **GitHub Actions** | Easy | 2 min | Already have GitHub repo |
| **UptimeRobot** | Very Easy | 1 min | Beginners, no code changes |
| **cron-job.org** | Easy | 2 min | Simple cron jobs |
| **Manual Script** | Medium | 5 min | Have your own server |

**Recommendation:** Use **UptimeRobot** (easiest) or **GitHub Actions** (already in repo).

---

## 🔧 Configuration

### For GitHub Actions:

**Method 1: Edit File Directly**
1. Edit `.github/workflows/keepalive.yml`
2. Replace `https://your-backend.onrender.com` with your URL
3. Commit and push

**Method 2: Use GitHub Secrets (Recommended)**
1. Go to repository → Settings → Secrets and variables → Actions
2. Add new secret:
   - **Name:** `RENDER_BACKEND_URL`
   - **Value:** `https://your-backend.onrender.com`
3. Update workflow to use: `${{ secrets.RENDER_BACKEND_URL }}`

---

## ✅ Verification

After setting up keep-alive:

1. **Wait 15 minutes** (time for Render to spin down)
2. **Check your backend:** `https://your-backend.onrender.com/health`
3. **Should respond immediately** (not 30-60s delay)
4. **Check keep-alive service logs** to confirm it's pinging

---

## 🚨 Troubleshooting

### Backend Still Spinning Down?

- **Check keep-alive is running:** Look at service logs
- **Verify URL is correct:** Test the health endpoint manually
- **Check interval:** Should be less than 15 minutes (10 min recommended)
- **Verify service is active:** Check UptimeRobot/GitHub Actions status

### GitHub Actions Not Running?

- **Check Actions are enabled:** Repository → Settings → Actions
- **Verify workflow file exists:** `.github/workflows/keepalive.yml`
- **Check workflow syntax:** Should be valid YAML
- **Look at Actions tab:** Should show workflow runs

---

## 💡 Pro Tips

1. **Use health endpoint:** `/health` is lightweight, perfect for keep-alive
2. **10-minute interval:** Keeps backend alive without excessive requests
3. **Monitor logs:** Check that keep-alive is working
4. **Test manually:** Visit health endpoint to verify backend is up

---

## 📊 Cost Comparison

| Service | Cost | Setup Time |
|--------|------|------------|
| GitHub Actions | ₹0 | 2 min |
| UptimeRobot | ₹0 | 1 min |
| cron-job.org | ₹0 | 2 min |
| Manual Script | ₹0 | 5 min |

**All options are free!** Choose the one that's easiest for you.

---

## ✅ Summary

**Keep-alive is essential for Render free tier!**

- **Without keep-alive:** First request takes 30-60s (bad user experience)
- **With keep-alive:** Always responds immediately (good user experience)
- **Cost:** ₹0/month (all options are free)

**Recommended:** Use **UptimeRobot** (easiest) or **GitHub Actions** (already configured).

---

**Ready to set up?** Choose an option above and follow the steps. Your backend will stay alive 24/7! 🚀

