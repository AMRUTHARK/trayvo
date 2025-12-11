# Windows Setup Guide

This guide provides Windows-specific instructions for setting up the Multi-Shop Billing System.

## Prerequisites

1. **Node.js 18+** - Download from https://nodejs.org/
2. **MySQL** - Choose one:
   - **XAMPP** (Recommended - Easy): https://www.apachefriends.org/
   - **WAMP**: https://www.wampserver.com/
   - **MySQL Installer**: https://dev.mysql.com/downloads/installer/
   - **Or use cloud database** (PlanetScale - Free tier)

## Step 1: Install MySQL

### Option A: XAMPP (Easiest)

1. Download and install XAMPP from https://www.apachefriends.org/
2. Open XAMPP Control Panel
3. Start MySQL service (click "Start" next to MySQL)
4. MySQL will run on `localhost:3306`
5. Default username: `root`, password: (empty/blank)

### Option B: MySQL Installer

1. Download MySQL Installer from https://dev.mysql.com/downloads/installer/
2. Run installer and follow setup wizard
3. Remember the root password you set
4. MySQL will run as a Windows service

## Step 2: Install Project Dependencies

Open PowerShell or Command Prompt in the project directory:

```powershell
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

## Step 3: Configure Environment Variables

### Create `backend/.env` file:

```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=          # Leave empty if using XAMPP default
DB_NAME=multi_shop_billing
DB_PORT=3306
JWT_SECRET=change_this_to_a_random_string_in_production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

**Note**: If using XAMPP, leave `DB_PASSWORD` empty. If using MySQL Installer, use the password you set during installation.

### Create `.env.local` in root:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Step 4: Set Up Database

### Method 1: Using Node.js Script (Recommended - No MySQL CLI needed)

```powershell
node setup-db.js
```

This script will automatically:
- Connect to MySQL
- Create the database
- Import the schema

### Method 2: Using MySQL Workbench

1. **Download MySQL Workbench** (if not installed):
   - Usually comes with MySQL Installer
   - Or download separately: https://dev.mysql.com/downloads/workbench/

2. **Open MySQL Workbench**
3. **Connect to MySQL**:
   - Click "MySQL Connections" or the "+" icon
   - Connection Name: `Local MySQL`
   - Hostname: `localhost`
   - Port: `3306`
   - Username: `root`
   - Password: (your password or leave blank for XAMPP)
   - Click "Test Connection" then "OK"

4. **Create Database**:
   - Click the "Create a new schema" button (lightning bolt icon)
   - Schema Name: `multi_shop_billing`
   - Click "Apply"

5. **Import Schema**:
   - Click "Server" → "Data Import"
   - Select "Import from Self-Contained File"
   - Browse to `database/schema.sql` in your project folder
   - Under "Default Target Schema", select `multi_shop_billing`
   - Click "Start Import"
   - Wait for "Import completed successfully"

### Method 3: Using XAMPP phpMyAdmin

1. **Open phpMyAdmin**:
   - Open XAMPP Control Panel
   - Click "Admin" next to MySQL (or go to http://localhost/phpmyadmin)

2. **Create Database**:
   - Click "New" in the left sidebar
   - Database name: `multi_shop_billing`
   - Collation: `utf8mb4_general_ci`
   - Click "Create"

3. **Import Schema**:
   - Select `multi_shop_billing` database
   - Click "Import" tab
   - Click "Choose File"
   - Select `database/schema.sql` from your project
   - Click "Go" at the bottom

### Method 4: Using Command Line (if MySQL is in PATH)

If you added MySQL to Windows PATH:

```powershell
mysql -u root -p -e "CREATE DATABASE multi_shop_billing;"
mysql -u root -p multi_shop_billing < database/schema.sql
```

## Step 5: Start the Application

### Terminal 1 - Backend:

```powershell
cd backend
npm run dev
```

You should see: `Server running on port 5000`

### Terminal 2 - Frontend:

```powershell
npm run dev
```

You should see: `Ready on http://localhost:3000`

## Step 6: Access the Application

1. Open browser: http://localhost:3000
2. Click "Register your shop"
3. Fill in shop details
4. Create admin account
5. Login and start using!

## Troubleshooting

### "mysql is not recognized"
- **Solution**: Use Method 1 (Node.js script) or Method 2 (MySQL Workbench) above
- Don't need MySQL CLI for setup

### "Cannot connect to MySQL"
- **Check**: Is MySQL service running?
  - XAMPP: Check XAMPP Control Panel, MySQL should be green
  - MySQL Installer: Check Windows Services (services.msc), look for "MySQL80"
- **Check**: Credentials in `backend/.env` are correct
- **Check**: Port 3306 is not blocked by firewall

### "Access denied for user 'root'"
- XAMPP: Leave password empty in `.env`
- MySQL Installer: Use the password you set during installation
- Try resetting MySQL root password if needed

### "Database already exists"
- This is fine! The script will continue
- Or manually drop and recreate if needed

### Port 5000 or 3000 already in use
- Change `PORT=5000` in `backend/.env` to another port (e.g., 5001)
- Update `NEXT_PUBLIC_API_URL` in `.env.local` accordingly
- Or stop the service using the port

### Backend won't start
- Check `backend/.env` file exists
- Verify all dependencies installed: `cd backend && npm install`
- Check console for specific error messages

## Quick Test

After setup, test the connection:

```powershell
# Test backend
curl http://localhost:5000/health
# Should return: {"status":"ok","timestamp":"..."}

# Test frontend
# Open http://localhost:3000 in browser
```

## Next Steps

- Read [QUICK_START.md](./QUICK_START.md) for general setup
- Check [README.md](./README.md) for full documentation
- See [TESTING.md](./TESTING.md) for testing instructions

## Need Help?

- Check Windows Event Viewer for MySQL service errors
- Verify MySQL is running in Task Manager
- Check firewall settings for port 3306
- Review error messages in terminal/console

Happy billing! 🎉

