# Deployment Guide

This guide covers deploying the Multi-Shop Billing System to production using Vercel (frontend), Render (backend), and PlanetScale (database).

## Prerequisites

- GitHub account
- Vercel account
- Render account
- PlanetScale account

## Step 1: Database Setup (PlanetScale)

1. **Create a PlanetScale account** at https://planetscale.com

2. **Create a new database**
   - Click "New database"
   - Name it `multi_shop_billing`
   - Choose a region close to your users
   - Click "Create database"

3. **Get connection credentials**
   - Go to your database dashboard
   - Click "Connect"
   - Copy the connection string (it looks like: `mysql://username:password@host:port/database`)

4. **Run the schema**
   - Use PlanetScale CLI or connect via MySQL client:
   ```bash
   mysql -h <host> -u <username> -p<password> -P <port> <database> < database/schema.sql
   ```
   - Or use PlanetScale's web console to run the SQL from `database/schema.sql`

## Step 2: Backend Deployment (Render)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Create a new Web Service on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure the service**
   - **Name**: `multi-shop-billing-api`
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Root Directory**: Leave empty (or set to `backend` if needed)

4. **Set Environment Variables**
   Click "Environment" and add:
   ```
   NODE_ENV=production
   PORT=10000
   DB_HOST=<your-planetscale-host>
   DB_USER=<your-planetscale-username>
   DB_PASSWORD=<your-planetscale-password>
   DB_NAME=multi_shop_billing
   DB_PORT=3306
   JWT_SECRET=<generate-a-strong-random-string>
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=https://your-frontend.vercel.app
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

   **Generate JWT_SECRET:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your backend
   - Note the service URL (e.g., `https://multi-shop-billing-api.onrender.com`)

## Step 3: Frontend Deployment (Vercel)

1. **Create a Vercel account** at https://vercel.com

2. **Import your GitHub repository**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the repository

3. **Configure the project**
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

4. **Set Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
   ```

   Replace `https://your-backend.onrender.com` with your actual Render backend URL.

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your frontend
   - Note the deployment URL (e.g., `https://multi-shop-billing.vercel.app`)

6. **Update Backend CORS**
   - Go back to Render dashboard
   - Update `FRONTEND_URL` environment variable to your Vercel URL
   - Redeploy the backend service

## Step 4: Post-Deployment

1. **Test the deployment**
   - Visit your Vercel frontend URL
   - Register a new shop
   - Test login and basic functionality

2. **Set up custom domain (optional)**
   - In Vercel: Add your custom domain in project settings
   - In Render: Update `FRONTEND_URL` to your custom domain
   - Update DNS records as instructed

3. **Enable HTTPS**
   - Vercel and Render provide HTTPS by default
   - No additional configuration needed

## Environment Variables Summary

### Backend (Render)
```
NODE_ENV=production
PORT=10000
DB_HOST=<planetscale-host>
DB_USER=<planetscale-user>
DB_PASSWORD=<planetscale-password>
DB_NAME=multi_shop_billing
DB_PORT=3306
JWT_SECRET=<strong-random-string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-frontend.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (Vercel)
```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

## Troubleshooting

### Backend won't start
- Check Render logs for errors
- Verify all environment variables are set
- Ensure database connection string is correct

### Database connection errors
- Verify PlanetScale credentials
- Check if database exists
- Ensure schema has been imported

### CORS errors
- Verify `FRONTEND_URL` in backend matches your Vercel URL exactly
- Check browser console for specific CORS error messages

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check if backend is running (visit backend URL/health endpoint)
- Ensure backend CORS allows your frontend domain

## Monitoring

- **Render**: View logs in the Render dashboard
- **Vercel**: View logs in the Vercel dashboard
- **PlanetScale**: Monitor database usage in PlanetScale dashboard

## Scaling

- **Render**: Upgrade to paid plan for better performance
- **PlanetScale**: Upgrade for higher connection limits
- **Vercel**: Free tier is sufficient for most use cases

## Backup

- **Database**: PlanetScale provides automatic backups
- **Code**: GitHub serves as your code backup
- **Environment Variables**: Keep a secure record of all environment variables

## Security Checklist

- [ ] Strong JWT_SECRET generated
- [ ] Database credentials are secure
- [ ] HTTPS enabled (automatic on Vercel/Render)
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Environment variables not exposed in code

