# Deployment Checklist

Use this checklist to track your deployment progress.

## Step 1: Repository Setup ✅
- [x] Git initialized
- [x] Initial commit created
- [x] Branch renamed to main
- [ ] **GitHub repository created** (Manual step - go to https://github.com/new)
- [ ] **Code pushed to GitHub** (Run: `git remote add origin <url>` then `git push -u origin main`)

## Step 2: Database Setup (PlanetScale)
- [ ] PlanetScale account created (https://planetscale.com)
- [ ] Database `multi_shop_billing` created
- [ ] Connection credentials saved
- [ ] Schema imported (using CLI, web console, or MySQL client)
- [ ] Tables verified (run `SHOW TABLES;`)

## Step 3: Email Setup (Gmail)
- [ ] Gmail 2-Step Verification enabled
- [ ] App Password generated
- [ ] App Password saved securely (16 characters, no spaces)

## Step 4: Backend Deployment (Render)
- [ ] Render account created (https://dashboard.render.com)
- [ ] GitHub connected to Render
- [ ] Web Service created
- [ ] Root Directory set to `backend`
- [ ] All environment variables added (see `env-templates/render.env.template`)
- [ ] JWT_SECRET generated (run: `node generate-jwt-secret.js`)
- [ ] Service deployed successfully
- [ ] Health endpoint verified (visit `/health`)

## Step 5: Frontend Deployment (Vercel)
- [ ] Vercel account created (https://vercel.com)
- [ ] GitHub connected to Vercel
- [ ] Project imported
- [ ] Environment variable added (see `env-templates/vercel.env.template`)
- [ ] Project deployed successfully
- [ ] Frontend URL noted

## Step 6: Configuration Updates
- [ ] Backend `FRONTEND_URL` updated in Render
- [ ] Backend redeployed after CORS update

## Step 7: Super Admin Creation
- [ ] Connected to PlanetScale database
- [ ] Super admin created (run: `node create-superadmin.js`)
- [ ] Credentials saved securely

## Step 8: Verification
- [ ] Frontend accessible
- [ ] Backend health check passing
- [ ] Super admin login working
- [ ] Shop creation tested
- [ ] Email invitation sent and received
- [ ] Shop registration completed
- [ ] Basic functionality tested (add product, create bill)

## Step 9: Production Readiness
- [ ] All environment variables verified
- [ ] Database schema confirmed
- [ ] Security checklist reviewed
- [ ] Monitoring set up
- [ ] Backup strategy confirmed

## Quick Commands Reference

```bash
# Generate JWT Secret
node generate-jwt-secret.js

# Verify Deployment
node verify-deployment.js <frontend-url> <backend-url>

# Create Super Admin
node create-superadmin.js
```

## Environment Variable Templates

- Backend (Render): `env-templates/render.env.template`
- Frontend (Vercel): `env-templates/vercel.env.template`

