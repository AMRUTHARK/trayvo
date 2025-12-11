# Cloud Deployment Plan - Multi-Shop Billing System

**Version:** 1.0  
**Last Updated:** December 2025  
**Estimated Setup Time:** 2-3 hours

This comprehensive guide provides exact step-by-step instructions to deploy your Multi-Shop Billing System to production cloud infrastructure, enabling you to sell to your first customer.

---

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Vercel    │──────│    Render    │──────│ PlanetScale │
│  (Frontend) │      │   (Backend)  │      │ (Database)  │
│  Next.js    │      │   Express    │      │   MySQL     │
│             │      │              │      │             │
│ Free Tier   │      │ Free/Paid    │      │ Free Tier   │
└─────────────┘      └─────────────┘      └─────────────┘
```

**Data Flow:**
- Users access frontend on Vercel
- Frontend makes API calls to backend on Render
- Backend queries PlanetScale MySQL database
- Email invitations sent via SMTP (Gmail)

---

## Prerequisites Checklist

Before starting deployment, ensure you have:

- [ ] **GitHub Account** (free) - https://github.com
- [ ] **Code Repository** - Your project pushed to GitHub
- [ ] **Gmail Account** - For sending registration invitations
- [ ] **2-3 Hours** - For complete setup and testing
- [ ] **All Project Files** - Verify project structure is complete

### Required Files Verification

Ensure these files exist in your project:
- ✅ `package.json` (root - frontend)
- ✅ `backend/package.json` (backend)
- ✅ `database/schema.sql` (database schema)
- ✅ `next.config.js` (Next.js config)
- ✅ `backend/server.js` (Express server)
- ✅ `create-superadmin.js` (super admin creation script)

---

## Step 1: Prepare Your Code Repository

### 1.1 Initialize Git Repository (If Not Already Done)

```bash
# Check if git is initialized
git status

# If not initialized, run:
git init
git add .
git commit -m "Initial commit - ready for deployment"
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `multi-shopping-billing` (or your preferred name)
3. **Visibility**: Set to **Private** (recommended for business applications)
4. **Description**: "Multi-Shop Billing & Inventory System"
5. **DO NOT** initialize with README, .gitignore, or license (you already have these)
6. Click **"Create repository"**

### 1.3 Push Code to GitHub

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/multi-shopping-billing.git

# Rename branch to main (if needed)
git branch -M main

# Push code
git push -u origin main
```

**Verify Push:**
- Go to your GitHub repository
- Confirm all files are present
- Check that `backend/`, `app/`, `database/` folders are visible

### 1.4 Verify Project Structure

Your repository should have this structure:
```
multi-shopping-billing/
├── app/                    # Next.js app directory
├── backend/                # Express backend
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   └── server.js
├── database/
│   └── schema.sql
├── components/
├── lib/
├── public/
├── package.json
├── next.config.js
└── create-superadmin.js
```

---

## Step 2: Database Setup (PlanetScale)

### 2.1 Create PlanetScale Account

1. Go to https://planetscale.com
2. Click **"Sign Up"** or **"Get Started"**
3. **Recommended**: Sign up with GitHub (easier integration)
4. Complete account verification if required

### 2.2 Create Database

1. In PlanetScale dashboard, click **"New database"** button
2. **Database name**: `multi_shop_billing`
3. **Region**: Choose closest to your users
   - For India: `ap-south-1` (Mumbai)
   - For US: `us-east-1` (Virginia)
   - For Europe: `eu-west-1` (Ireland)
4. **Plan**: Select **"Hobby"** (free tier)
   - 1 database
   - 1GB storage
   - 1 billion rows
   - Automatic backups
5. Click **"Create database"**
6. Wait 1-2 minutes for database provisioning

### 2.3 Get Connection Credentials

1. Click on your database name (`multi_shop_billing`)
2. Click **"Connect"** button (top right)
3. Select **"General"** connection string type
4. **Copy the connection string** - it looks like:
   ```
   mysql://username:password@host.psdb.cloud:3306/database_name?sslaccept=strict
   ```
5. **Parse and save these values separately:**
   - **Host**: `xxxx.psdb.cloud`
   - **Username**: `xxxx`
   - **Password**: `xxxx` (long random string)
   - **Port**: `3306`
   - **Database**: `multi_shop_billing`

**Important:** Save these credentials securely - you'll need them for Render environment variables.

### 2.4 Import Database Schema

You have three options to import the schema:

#### Option A: Using PlanetScale CLI (Recommended)

1. **Install PlanetScale CLI:**
   ```bash
   # Windows (PowerShell)
   winget install planetscale.cli
   
   # Or download from: https://github.com/planetscale/cli/releases
   ```

2. **Login to PlanetScale:**
   ```bash
   pscale auth login
   ```
   (Opens browser for authentication)

3. **Connect to your database:**
   ```bash
   pscale connect multi_shop_billing --port 3307
   ```
   This creates a local proxy connection. Note the password shown in output.

4. **In a new terminal, import schema:**
   ```bash
   mysql -h 127.0.0.1 -P 3307 -u root -p < database/schema.sql
   ```
   (Enter the password from step 3)

5. **Verify import:**
   ```bash
   mysql -h 127.0.0.1 -P 3307 -u root -p
   USE multi_shop_billing;
   SHOW TABLES;
   ```
   Should show: `shops`, `users`, `products`, `categories`, `bills`, `bill_items`, `inventory_transactions`, `login_history`, `registration_tokens`, `hold_bills`, `settings`

#### Option B: Using PlanetScale Web Console

1. Go to your database dashboard
2. Click **"Branches"** → **"main"** branch
3. Click **"Console"** tab
4. Open `database/schema.sql` file from your project
5. Copy entire contents
6. Paste into PlanetScale console
7. Click **"Run"** button
8. Wait for execution to complete
9. Verify tables were created (check "Tables" tab)

#### Option C: Using MySQL Client Directly

1. Use MySQL Workbench or command line
2. Connect using credentials from Step 2.3:
   ```bash
   mysql -h <host> -u <username> -p<password> -P 3306 <database> < database/schema.sql
   ```
3. Replace placeholders with actual values
4. Verify tables were created

### 2.5 Verify Schema Import

Run this query in PlanetScale console or MySQL client:

```sql
SHOW TABLES;
```

**Expected Tables (11 total):**
- `shops`
- `users`
- `categories`
- `products`
- `bills`
- `bill_items`
- `inventory_transactions`
- `login_history`
- `registration_tokens`
- `hold_bills`
- `settings`

If all tables are present, proceed to next step.

---

## Step 3: Email Setup (Gmail)

### 3.1 Enable Gmail 2-Step Verification

1. Go to https://myaccount.google.com
2. Click **"Security"** in left sidebar
3. Under **"How you sign in to Google"**, find **"2-Step Verification"**
4. If not enabled:
   - Click **"2-Step Verification"**
   - Follow setup wizard
   - Verify with phone number
   - Complete setup

### 3.2 Generate Gmail App Password

1. Go back to **"Security"** page
2. Under **"How you sign in to Google"**, click **"App passwords"**
   - If you don't see this option, 2-Step Verification must be enabled first
3. **Select app**: Choose **"Mail"**
4. **Select device**: Choose **"Other (Custom name)"**
5. **Enter name**: `Multi-Shop Billing System`
6. Click **"Generate"**
7. **Copy the 16-character password** displayed
   - Format: `xxxx xxxx xxxx xxxx` (4 groups of 4 characters)
   - **Important**: Remove spaces when using in environment variables
   - Example: `abcd efgh ijkl mnop` becomes `abcdefghijklmnop`
8. **Save this password securely** - you cannot view it again

### 3.3 Note Your Gmail Details

Save these for later use in Render environment variables:
- **Email**: `your-email@gmail.com`
- **App Password**: `abcdefghijklmnop` (16 characters, no spaces)

**Alternative Email Providers:**

If you prefer not to use Gmail:

**Outlook/Hotmail:**
- SMTP_HOST: `smtp-mail.outlook.com`
- SMTP_PORT: `587`
- Use your regular password (no app password needed)

**SendGrid (Recommended for Production):**
- Sign up at https://sendgrid.com
- Free tier: 100 emails/day
- Get API key from dashboard
- Use SMTP settings provided

---

## Step 4: Backend Deployment (Render)

### 4.1 Create Render Account

1. Go to https://dashboard.render.com
2. Click **"Get Started for Free"** or **"Sign Up"**
3. **Recommended**: Sign up with GitHub (easier repository access)
4. Complete account setup

### 4.2 Connect GitHub Repository

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. If GitHub not connected:
   - Click **"Connect GitHub"** or **"Configure account"**
   - Authorize Render to access your repositories
   - Select repositories to grant access (or all repositories)
3. **Select Repository**: Choose `multi-shopping-billing`
4. Click **"Connect"**

### 4.3 Configure Backend Service

Fill in the service configuration:

#### Basic Settings:

- **Name**: `multi-shop-billing-api`
- **Region**: Choose closest to your users
  - For India: `Singapore` or `Mumbai`
  - For US: `Oregon`
  - For Europe: `Frankfurt`
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend` ⚠️ **IMPORTANT!**
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: 
  - **Free** (for testing/1 customer)
  - **Starter ($7/month)** (recommended for production - always-on)

#### Environment Variables:

Click **"Environment"** tab and add these variables one by one:

**Database Configuration:**
```
NODE_ENV=production
PORT=10000
DB_HOST=<your-planetscale-host>
DB_USER=<your-planetscale-username>
DB_PASSWORD=<your-planetscale-password>
DB_NAME=multi_shop_billing
DB_PORT=3306
```

**Security:**
```
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=7d
```

**CORS & Frontend:**
```
FRONTEND_URL=https://your-app-name.vercel.app
```
(Update this after Vercel deployment)

**Rate Limiting:**
```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Email Configuration (Gmail):**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Multi-Shop Billing System
```

**Generate JWT_SECRET:**

Run this command locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (64-character hex string) and use as `JWT_SECRET` value.

**Important Notes:**
- Replace all `<placeholders>` with actual values
- For `DB_PASSWORD`, use the password from PlanetScale (not the connection string)
- For `SMTP_PASSWORD`, use the 16-character app password (no spaces)
- For `FRONTEND_URL`, use placeholder for now - update after Vercel deployment

### 4.4 Deploy Backend

1. Review all settings
2. Click **"Create Web Service"**
3. Render will start building:
   - Clones repository
   - Installs dependencies (`npm install` in `backend/` directory)
   - Starts service (`npm start`)
4. **Wait 5-10 minutes** for first deployment
5. Monitor build logs in real-time
6. When deployment completes, note the service URL:
   - Format: `https://multi-shop-billing-api.onrender.com`
   - Or custom name if you chose one

### 4.5 Verify Backend Deployment

1. **Check Health Endpoint:**
   - Visit: `https://your-backend-url.onrender.com/health`
   - Should return: `{"status":"ok","timestamp":"2025-..."}`

2. **Check Logs:**
   - In Render dashboard, click **"Logs"** tab
   - Look for: `Server running on port 10000`
   - Look for: `Database connected successfully`
   - If errors, review and fix

3. **Common Issues:**
   - **Build fails**: Check that `backend/package.json` exists and has correct `start` script
   - **Database connection error**: Verify PlanetScale credentials
   - **Port error**: Ensure `PORT=10000` is set (Render uses port 10000)

---

## Step 5: Frontend Deployment (Vercel)

### 5.1 Create Vercel Account

1. Go to https://vercel.com
2. Click **"Sign Up"**
3. **Recommended**: Sign up with GitHub
4. Complete account setup

### 5.2 Import Project

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. **Import Git Repository**: 
   - If GitHub not connected, click **"Connect GitHub"**
   - Authorize Vercel to access repositories
   - Select `multi-shopping-billing` repository
3. Click **"Import"**

### 5.3 Configure Frontend

Vercel should auto-detect Next.js, but verify these settings:

**Project Settings:**
- **Framework Preset**: `Next.js` (auto-detected)
- **Root Directory**: `./` (root - leave as is)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

**Environment Variables:**

Click **"Environment Variables"** and add:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com/api
```

**Important:**
- Replace `your-backend-url.onrender.com` with your actual Render backend URL from Step 4.4
- Include `/api` at the end
- Example: `https://multi-shop-billing-api.onrender.com/api`

### 5.4 Deploy Frontend

1. Review configuration
2. Click **"Deploy"**
3. Vercel will:
   - Clone repository
   - Install dependencies
   - Build Next.js application
   - Deploy to CDN
4. **Wait 2-5 minutes** for build and deployment
5. When complete, note the deployment URL:
   - Format: `https://multi-shopping-billing.vercel.app`
   - Or custom name if you chose one

### 5.5 Update Backend CORS

Now that you have the frontend URL, update backend to allow CORS:

1. Go back to **Render dashboard**
2. Open your backend service (`multi-shop-billing-api`)
3. Go to **"Environment"** tab
4. Find `FRONTEND_URL` variable
5. Click **"Edit"** or update value to your Vercel URL:
   ```
   FRONTEND_URL=https://your-app-name.vercel.app
   ```
   (No trailing slash)
6. Click **"Save Changes"**
7. Render will automatically redeploy (takes 2-3 minutes)

**Verify CORS Update:**
- After redeploy, check backend logs
- Should see no CORS errors when accessing from frontend

---

## Step 6: Create Super Admin User

### 6.1 Method A: Using PlanetScale CLI (Recommended)

1. **Connect to database:**
   ```bash
   pscale connect multi_shop_billing --port 3307
   ```
   Note the password shown in output.

2. **Set environment variables locally:**
   ```bash
   # Windows PowerShell
   $env:DB_HOST="127.0.0.1"
   $env:DB_PORT="3307"
   $env:DB_USER="root"
   $env:DB_PASSWORD="<password-from-pscale-output>"
   $env:DB_NAME="multi_shop_billing"
   $env:SUPERADMIN_USERNAME="superadmin"
   $env:SUPERADMIN_EMAIL="your-email@gmail.com"
   $env:SUPERADMIN_PASSWORD="YourStrongPassword123!"
   ```

3. **Run super admin creation script:**
   ```bash
   node create-superadmin.js
   ```

4. **Save credentials:**
   - Username: `superadmin` (or what you set)
   - Password: (the one you set)
   - **Keep these secure!**

### 6.2 Method B: Direct Database Connection

1. **Create temporary `.env` file in `backend/` directory:**
   ```env
   DB_HOST=<planetscale-host>
   DB_USER=<planetscale-username>
   DB_PASSWORD=<planetscale-password>
   DB_NAME=multi_shop_billing
   DB_PORT=3306
   SUPERADMIN_USERNAME=superadmin
   SUPERADMIN_EMAIL=your-email@gmail.com
   SUPERADMIN_PASSWORD=YourStrongPassword123!
   ```

2. **Run script:**
   ```bash
   node create-superadmin.js
   ```

3. **Verify output:**
   Should see:
   ```
   ✅ Super admin created successfully!
   
   📋 Login Credentials:
   Username: superadmin
   Email: your-email@gmail.com
   Password: YourStrongPassword123!
   ```

4. **Delete `.env` file** after creating super admin (for security)

### 6.3 Method C: Manual SQL Insert

If scripts don't work, create super admin manually:

1. Connect to PlanetScale database
2. Run this SQL (replace values):
   ```sql
   INSERT INTO users (shop_id, username, email, password_hash, role, full_name, is_active)
   VALUES (
     NULL,
     'superadmin',
     'your-email@gmail.com',
     '$2a$10$<bcrypt-hash>',  -- Generate using: node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 10))"
     'super_admin',
     'Super Administrator',
     TRUE
   );
   ```

**Generate password hash:**
```bash
node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 10))"
```

### 6.4 Verify Super Admin Creation

1. Login to your Vercel frontend: `https://your-app.vercel.app/login`
2. Check **"Login as Super Admin"** checkbox
3. Enter super admin credentials
4. Should redirect to Super Admin dashboard
5. If successful, proceed to verification step

---

## Step 7: Post-Deployment Verification

### 7.1 Test Frontend Access

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. **Expected**: Login page loads
3. **Test**: Try accessing `/register` - should work
4. **Test**: Try accessing `/dashboard` without login - should redirect to login

### 7.2 Test Backend Connection

1. Visit: `https://your-backend.onrender.com/health`
2. **Expected**: `{"status":"ok","timestamp":"2025-..."}`
3. If error, check Render logs

### 7.3 Test Super Admin Login

1. Go to: `https://your-app.vercel.app/login`
2. Check **"Login as Super Admin"** checkbox
3. Enter super admin credentials
4. **Expected**: Redirects to Super Admin dashboard
5. **Verify**: Can see shops list (may be empty initially)

### 7.4 Test Shop Registration Flow

1. **As Super Admin:**
   - Login to super admin dashboard
   - Click **"Create Shop"** or **"Add Shop"**
   - Fill in shop details:
     - Shop Name: `Test Shop`
     - Owner Name: `Test Owner`
     - Email: `test@example.com`
     - Phone: `1234567890`
   - Click **"Create"**

2. **Send Registration Invitation:**
   - Find the shop in the list
   - Click **"Invite"** button
   - Enter email address (use your own for testing)
   - Click **"Send Invitation"**

3. **Check Email:**
   - Open email inbox
   - Look for invitation email
   - Click registration link

4. **Complete Registration:**
   - Registration page should open
   - Fill in:
     - Username: `admin`
     - Password: `Admin123!`
     - Confirm Password: `Admin123!`
     - Full Name: `Shop Admin`
   - Click **"Register"**

5. **Login as Shop Admin:**
   - Go to login page
   - Enter shop admin credentials
   - **Expected**: Redirects to shop dashboard

### 7.5 Test Basic Functionality

1. **Add Category:**
   - Go to Categories page
   - Click **"Add Category"**
   - Name: `Test Category`
   - Save

2. **Add Product:**
   - Go to Products page
   - Click **"Add Product"**
   - Fill in product details
   - Save

3. **Create Bill:**
   - Go to POS page
   - Add product to cart
   - Create bill
   - **Expected**: Bill created, stock deducted

4. **View Reports:**
   - Go to Reports page
   - Check different report types
   - **Expected**: Reports generate correctly

### 7.6 Verify Email Sending

1. In Super Admin dashboard, send another test invitation
2. Check email inbox
3. **If email not received:**
   - Check Render logs for email errors
   - Verify SMTP credentials in Render environment variables
   - Test with different email provider if needed

---

## Step 8: Custom Domain Setup (Optional)

### 8.1 Add Domain to Vercel

1. In Vercel project dashboard, go to **"Settings"** → **"Domains"**
2. Enter your domain (e.g., `billing.yourdomain.com`)
3. Click **"Add"**
4. Vercel will show DNS configuration instructions

### 8.2 Configure DNS Records

1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Add DNS records as instructed by Vercel:
   - **Type**: `CNAME`
   - **Name**: `billing` (or subdomain you chose)
   - **Value**: `cname.vercel-dns.com`
3. Save DNS changes
4. Wait 5-30 minutes for DNS propagation

### 8.3 Update Environment Variables

1. **In Vercel:**
   - No changes needed (auto-detects custom domain)

2. **In Render:**
   - Update `FRONTEND_URL` to your custom domain:
     ```
     FRONTEND_URL=https://billing.yourdomain.com
     ```
   - Save and redeploy

### 8.4 Verify Custom Domain

1. Visit your custom domain
2. Should load your application
3. SSL certificate is automatically provisioned by Vercel

---

## Step 9: Production Checklist

Before going live with your first customer, verify:

### Infrastructure
- [ ] All environment variables set correctly in Render
- [ ] All environment variables set correctly in Vercel
- [ ] Database schema imported successfully
- [ ] Super admin created and tested
- [ ] Frontend accessible and loading correctly
- [ ] Backend health check passing
- [ ] CORS configured correctly

### Functionality
- [ ] Email invitations working
- [ ] Shop registration flow tested end-to-end
- [ ] Login working for all user types (super admin, admin, cashier)
- [ ] POS billing tested
- [ ] Inventory management tested
- [ ] Reports generating correctly
- [ ] PDF/CSV export working
- [ ] Thermal printing tested (if applicable)

### Security
- [ ] Strong JWT_SECRET generated
- [ ] Database credentials secure
- [ ] HTTPS enabled (automatic on Vercel/Render)
- [ ] Rate limiting enabled
- [ ] Environment variables not exposed in code
- [ ] Super admin password changed from default

### Monitoring
- [ ] Render logs accessible
- [ ] Vercel logs accessible
- [ ] PlanetScale metrics accessible
- [ ] Error tracking set up (optional)

---

## Step 10: Monitoring & Maintenance

### 10.1 Set Up Monitoring

**Render Logs:**
- Access: Render dashboard → Your service → "Logs" tab
- Monitor for errors, connection issues
- Set up email alerts (Render Pro feature)

**Vercel Analytics:**
- Access: Vercel dashboard → Your project → "Analytics" tab
- View page views, performance metrics
- Enable in project settings (optional)

**PlanetScale Metrics:**
- Access: PlanetScale dashboard → Your database → "Metrics" tab
- Monitor database usage, connections
- Set up alerts for storage limits

### 10.2 Backup Strategy

**Database Backups:**
- PlanetScale provides automatic daily backups (free tier)
- Backups retained for 7 days
- Can restore from any backup point
- For manual backup, export data via PlanetScale console

**Code Backups:**
- GitHub serves as primary backup
- Regular commits ensure code safety
- Consider branching strategy for production

**Environment Variables:**
- Keep secure record of all environment variables
- Store in password manager
- Document in secure location

### 10.3 Upgrade Considerations

**When to Upgrade Render (Free → Paid):**

**Free Tier Limitations:**
- Spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- Not suitable for production with active users

**Upgrade to Starter Plan ($7/month):**
- Always-on service (no spin-down)
- Faster response times
- Better for production use
- **Recommended**: Upgrade when you have 1+ paying customers

**When to Upgrade PlanetScale:**

**Free Tier Limits:**
- 1 database
- 1GB storage
- 1 billion rows
- Usually sufficient for 10-50 shops

**Upgrade to Scaler Plan ($29/month):**
- More storage (5GB)
- Better performance
- More connections
- **Consider**: When approaching storage limits or performance issues

**Vercel:**
- Free tier usually sufficient for many customers
- 100GB bandwidth/month
- Unlimited projects
- Upgrade only if exceeding bandwidth limits

---

## Troubleshooting Guide

### Backend Won't Start

**Symptoms:**
- Render shows "Deploy failed" or service won't start
- Logs show errors

**Solutions:**
1. **Check Render logs:**
   - Go to Render dashboard → Your service → "Logs"
   - Look for specific error messages

2. **Verify environment variables:**
   - Ensure all required variables are set
   - Check for typos in variable names
   - Verify values are correct (no extra spaces)

3. **Check package.json:**
   - Ensure `start` script exists: `"start": "node server.js"`
   - Verify `server.js` file exists in `backend/` directory

4. **Verify database connection:**
   - Check PlanetScale credentials
   - Test connection string locally
   - Ensure database exists

5. **Check Root Directory:**
   - Must be set to `backend` in Render settings
   - Not empty, not root directory

### Database Connection Errors

**Symptoms:**
- Backend logs show "Database connection error"
- Health endpoint works but API calls fail

**Solutions:**
1. **Verify PlanetScale credentials:**
   - Check `DB_HOST`, `DB_USER`, `DB_PASSWORD` in Render
   - Ensure password is correct (long random string)
   - Verify database name matches

2. **Check database exists:**
   - Go to PlanetScale dashboard
   - Verify database `multi_shop_billing` exists
   - Check if database is paused (free tier)

3. **Verify schema imported:**
   - Check PlanetScale console
   - Run `SHOW TABLES;`
   - Should show 11 tables

4. **Check network connectivity:**
   - PlanetScale requires SSL connection
   - Verify `sslaccept=strict` in connection string
   - Some networks block MySQL ports

### CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- Frontend can't make API calls
- "Access-Control-Allow-Origin" errors

**Solutions:**
1. **Verify FRONTEND_URL in Render:**
   - Must match Vercel URL exactly
   - No trailing slash
   - Include `https://` protocol
   - Example: `https://your-app.vercel.app`

2. **Check browser console:**
   - Look for specific CORS error message
   - Note which origin is being blocked

3. **Verify backend CORS configuration:**
   - Check `backend/server.js`
   - CORS should allow `FRONTEND_URL`
   - Redeploy backend after changing `FRONTEND_URL`

4. **Test with curl:**
   ```bash
   curl -H "Origin: https://your-app.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        https://your-backend.onrender.com/api/health
   ```

### Email Not Sending

**Symptoms:**
- Registration invitations not received
- Render logs show email errors

**Solutions:**
1. **Verify SMTP credentials:**
   - Check `SMTP_USER` and `SMTP_PASSWORD` in Render
   - For Gmail, ensure using App Password (not regular password)
   - Remove spaces from app password

2. **Check Render logs:**
   - Look for specific email error messages
   - Common errors:
     - "Invalid login" - Wrong credentials
     - "Connection timeout" - Firewall blocking SMTP
     - "Self-signed certificate" - SSL issue

3. **Test SMTP connection:**
   - Use email testing tool
   - Verify Gmail app password is correct
   - Check if 2-Step Verification is enabled

4. **Try different email provider:**
   - Test with Outlook/Hotmail
   - Consider SendGrid for production
   - Free tier: 100 emails/day

5. **Check email limits:**
   - Gmail: 500 emails/day (free)
   - If exceeded, wait 24 hours or upgrade

### Frontend Can't Connect to Backend

**Symptoms:**
- Frontend loads but API calls fail
- Browser console shows network errors
- "Failed to fetch" errors

**Solutions:**
1. **Verify NEXT_PUBLIC_API_URL:**
   - Check in Vercel environment variables
   - Must be: `https://your-backend.onrender.com/api`
   - Include `/api` at the end
   - No trailing slash

2. **Check backend is running:**
   - Visit: `https://your-backend.onrender.com/health`
   - Should return `{"status":"ok"}`
   - If not, check Render logs

3. **Verify backend CORS:**
   - Check `FRONTEND_URL` in Render matches Vercel URL
   - Redeploy backend if changed

4. **Check browser console:**
   - Look for specific error messages
   - Check Network tab for failed requests
   - Verify request URLs are correct

5. **Test API directly:**
   ```bash
   curl https://your-backend.onrender.com/api/health
   ```

### Slow Performance (Free Tier)

**Symptoms:**
- First request takes 30-60 seconds
- Subsequent requests are fast
- Service appears "sleeping"

**Solutions:**
1. **This is normal for Render free tier:**
   - Service spins down after 15 min inactivity
   - First request "wakes up" the service
   - Consider upgrading to paid plan

2. **Upgrade to Render Starter ($7/month):**
   - Always-on service
   - No spin-down delays
   - Better for production

3. **Use keep-alive service (free):**
   - Set up external ping service
   - Pings backend every 10 minutes
   - Prevents spin-down
   - Services: UptimeRobot (free), cron-job.org

### Build Failures

**Symptoms:**
- Vercel/Render build fails
- Deployment doesn't complete

**Solutions:**
1. **Check build logs:**
   - Look for specific error messages
   - Common issues:
     - Missing dependencies
     - TypeScript errors
     - Build command errors

2. **Verify package.json:**
   - Ensure all dependencies listed
   - Check Node.js version compatibility
   - Verify build scripts are correct

3. **Test build locally:**
   ```bash
   npm run build
   ```
   - Fix any local build errors first
   - Then redeploy

4. **Check for environment-specific issues:**
   - Some packages may not work in cloud
   - Check for platform-specific dependencies

---

## Cost Summary

### Free Tier Setup (Current)

| Service | Cost | Limits |
|---------|------|--------|
| Vercel | ₹0/month | Unlimited projects, 100GB bandwidth |
| Render | ₹0/month | Spins down after 15 min inactivity |
| PlanetScale | ₹0/month | 1 database, 1GB storage, 1B rows |
| Gmail SMTP | ₹0/month | 500 emails/day |
| **Total** | **₹0/month** | Good for testing/1 customer |

### Paid Tier (Recommended for Production)

| Service | Cost | Benefits |
|---------|------|----------|
| Vercel | ₹0/month | Free tier usually sufficient |
| Render Starter | ₹700/month (~$7) | Always-on, no spin-down |
| PlanetScale | ₹0/month | Free tier sufficient initially |
| Gmail SMTP | ₹0/month | 500 emails/day sufficient |
| **Total** | **₹700/month** | Better for 2+ customers |

### Break-Even Analysis

**With Free Hosting:**
- 1 customer at ₹699/month = ₹699 profit/month
- Break-even: Immediate

**With Paid Hosting (₹700/month):**
- 1 customer at ₹699/month = -₹1 loss/month
- 2 customers at ₹699/month = ₹698 profit/month
- **Break-even: 2 customers**

**Recommendation:**
- Start with free tier for first customer
- Upgrade to paid Render when you have 2+ customers
- Total cost remains low even with paid hosting

---

## Security Best Practices

### Environment Variables
- ✅ Never commit `.env` files to Git
- ✅ Use strong, random values for secrets
- ✅ Rotate secrets periodically
- ✅ Use different secrets for dev/prod

### Database Security
- ✅ Use strong database passwords
- ✅ Enable SSL for database connections (PlanetScale default)
- ✅ Limit database access to backend only
- ✅ Regular backups (automatic on PlanetScale)

### Application Security
- ✅ HTTPS enabled (automatic on Vercel/Render)
- ✅ JWT tokens with expiration
- ✅ Rate limiting enabled
- ✅ CORS configured correctly
- ✅ Input validation on all endpoints
- ✅ SQL injection prevention (parameterized queries)

### Access Control
- ✅ Strong super admin password
- ✅ Change default passwords
- ✅ Use role-based access control
- ✅ Monitor login history
- ✅ Regular security audits

---

## Next Steps After Deployment

### Immediate (Day 1)
1. ✅ Complete all verification tests
2. ✅ Create first shop via super admin
3. ✅ Test end-to-end workflow
4. ✅ Document any issues found

### Short Term (Week 1)
1. ✅ Onboard your first customer
2. ✅ Provide training/support
3. ✅ Monitor performance and errors
4. ✅ Collect feedback
5. ✅ Make necessary adjustments

### Medium Term (Month 1)
1. ✅ Evaluate upgrade needs (Render paid plan)
2. ✅ Set up monitoring/alerting
3. ✅ Create customer support process
4. ✅ Plan for scaling
5. ✅ Gather customer testimonials

### Long Term (Ongoing)
1. ✅ Regular backups verification
2. ✅ Security updates
3. ✅ Feature enhancements
4. ✅ Performance optimization
5. ✅ Customer growth planning

---

## Support Resources

### Documentation
- **Project README**: [README.md](README.md)
- **API Documentation**: [API_DOCS.md](API_DOCS.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Email Setup**: [EMAIL_SETUP.md](EMAIL_SETUP.md)

### External Resources
- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **PlanetScale Docs**: https://planetscale.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Express Docs**: https://expressjs.com/

### Getting Help
1. Check troubleshooting section above
2. Review service provider documentation
3. Check application logs for errors
4. Test locally to isolate issues
5. Contact service provider support if needed

---

## Quick Reference: Environment Variables

### Backend (Render) - Complete List

```env
# Application
NODE_ENV=production
PORT=10000

# Database (PlanetScale)
DB_HOST=<planetscale-host>
DB_USER=<planetscale-username>
DB_PASSWORD=<planetscale-password>
DB_NAME=multi_shop_billing
DB_PORT=3306

# Security
JWT_SECRET=<64-char-hex-string>
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=https://your-app.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Multi-Shop Billing System
```

### Frontend (Vercel) - Complete List

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

---

## Deployment Timeline

**Estimated Time Breakdown:**

| Step | Time | Notes |
|------|------|-------|
| 1. Prepare Repository | 10 min | Git setup, GitHub push |
| 2. Database Setup | 20 min | PlanetScale account, schema import |
| 3. Email Setup | 15 min | Gmail app password |
| 4. Backend Deployment | 15 min | Render setup, first deploy |
| 5. Frontend Deployment | 10 min | Vercel setup, deploy |
| 6. Super Admin Creation | 10 min | Run script, verify |
| 7. Verification | 30 min | Test all functionality |
| 8. Custom Domain (Optional) | 20 min | DNS configuration |
| **Total** | **2-3 hours** | First-time setup |

**Subsequent Deployments:**
- Code updates: 5-10 minutes (automatic via Git push)
- Environment variable changes: 2-3 minutes (redeploy)

---

## Conclusion

You now have a complete, production-ready deployment of your Multi-Shop Billing System in the cloud. The application is:

✅ **Deployed** on reliable cloud infrastructure  
✅ **Secure** with HTTPS, JWT, and proper authentication  
✅ **Scalable** with room to grow  
✅ **Monitored** with logging and metrics  
✅ **Ready** for your first customer  

**Next Action:** Complete the verification steps (Step 7) and then proceed to onboard your first customer!

---

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Maintained By:** Development Team

