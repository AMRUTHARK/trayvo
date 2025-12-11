# Setup Instructions - Follow These Steps

## Issue Detected
Your npm installation has an issue. Let's fix it and complete the setup.

## Step 1: Fix npm (Choose One Method)

### Option A: Reinstall Node.js (Recommended)
1. Download Node.js from https://nodejs.org/
2. Install the LTS version
3. Restart your terminal/PowerShell
4. Verify: `node --version` and `npm --version`

### Option B: Fix npm via nvm
```powershell
nvm reinstall 18.19.0
nvm use 18.19.0
```

### Option C: Use yarn instead
```powershell
npm install -g yarn
yarn install
```

## Step 2: Create Environment Files

### Create `backend/.env` file:

**Method 1: Using PowerShell**
```powershell
cd "D:\Project 2025\multi-shopping-billing"
@"
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=multi_shop_billing
DB_PORT=3306
JWT_SECRET=change_this_to_a_random_string_in_production_min_32_characters
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
"@ | Out-File -FilePath "backend\.env" -Encoding utf8
```

### Create `.env.local` file in root:
```powershell
@"
NEXT_PUBLIC_API_URL=http://localhost:5000/api
"@ | Out-File -FilePath ".env.local" -Encoding utf8
```

**Method 2: Manual Creation**
1. Create `backend/.env` file manually
2. Copy the content from above
3. Create `.env.local` in root directory
4. Copy the content from above

## Step 3: Install Dependencies

After fixing npm, run:
```powershell
cd "D:\Project 2025\multi-shopping-billing"
npm install
cd backend
npm install
cd ..
```

## Step 4: Make Sure MySQL is Running

- **XAMPP**: Open XAMPP Control Panel → Click "Start" next to MySQL
- **MySQL Installer**: Check Windows Services (services.msc) → MySQL80 should be running

## Step 5: Run Database Setup

```powershell
node setup-db.js
```

You should see:
```
✓ Connected to MySQL server
✓ Database 'multi_shop_billing' created or already exists
✓ Connected to database
✓ Schema imported successfully
✅ Database setup complete!
```

## Step 6: Start the Application

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
npm run dev
```

## Step 7: Access Application

Open browser: http://localhost:3000

## Troubleshooting

### npm still not working?
- Try using `yarn` instead of `npm`
- Or reinstall Node.js completely

### MySQL connection error?
- Make sure MySQL service is running
- Check if password is correct in `backend/.env`
- For XAMPP, leave password empty

### Database setup fails?
- Verify MySQL is running
- Check `backend/.env` file exists and has correct values
- Try connecting with MySQL Workbench first to test credentials

## Quick Commands Summary

```powershell
# Navigate to project
cd "D:\Project 2025\multi-shopping-billing"

# Create .env files (if not done)
# Use Method 1 or 2 above

# Install dependencies
npm install
cd backend
npm install
cd ..

# Setup database
node setup-db.js

# Start backend (Terminal 1)
cd backend
npm run dev

# Start frontend (Terminal 2)
npm run dev
```

Good luck! 🚀

