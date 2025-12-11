# Quick Start Guide

Get the Multi-Shop Billing System running in 5 minutes!

## Step 1: Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

## Step 2: Set Up Database

### Option A: Using MySQL Command Line (if MySQL is in PATH)

```bash
# Create database (MySQL must be running)
mysql -u root -p -e "CREATE DATABASE multi_shop_billing;"

# Import schema
mysql -u root -p multi_shop_billing < database/schema.sql
```

### Option B: Windows - Using Full Path to MySQL

If MySQL is installed but not in PATH, use the full path:

```bash
# Typical MySQL installation paths:
# XAMPP: C:\xampp\mysql\bin\mysql.exe
# WAMP: C:\wamp64\bin\mysql\mysql8.x.x\bin\mysql.exe
# MySQL Installer: C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

# Example for XAMPP:
"C:\xampp\mysql\bin\mysql.exe" -u root -p -e "CREATE DATABASE multi_shop_billing;"
"C:\xampp\mysql\bin\mysql.exe" -u root -p multi_shop_billing < database/schema.sql
```

### Option C: Using MySQL Workbench (GUI - Recommended for Windows)

1. **Open MySQL Workbench**
2. **Connect to your MySQL server** (usually `localhost` with user `root`)
3. **Create database:**
   - Click the "Create a new schema" button (or press `Ctrl+Shift+N`)
   - Name it `multi_shop_billing`
   - Click "Apply"
4. **Import schema:**
   - Click "Server" → "Data Import"
   - Select "Import from Self-Contained File"
   - Browse to `database/schema.sql`
   - Under "Default Target Schema", select `multi_shop_billing`
   - Click "Start Import"

### Option D: Using Node.js Script (Easiest - No MySQL CLI needed)

1. **Make sure you have backend/.env file** (see Step 3)
2. **Install dependencies** (if not already done):
   ```bash
   npm install
   cd backend
   npm install
   cd ..
   ```
3. **Run the setup script**:
   ```bash
   node setup-db.js
   ```

This script will automatically:
- Connect to MySQL
- Create the database
- Import the schema

### Option E: Using Cloud Database (PlanetScale - Free Tier)

For development, you can use PlanetScale (free tier):
1. Sign up at https://planetscale.com
2. Create a database
3. Get connection string
4. Update `backend/.env` with PlanetScale credentials
5. Run the schema SQL in PlanetScale's web console

## Step 3: Configure Environment

**Backend** - Create `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=multi_shop_billing
DB_PORT=3306
JWT_SECRET=change_this_to_a_random_string_in_production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

**Frontend** - Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Step 4: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Step 5: Access the Application

1. Open http://localhost:3000
2. Click "Register your shop"
3. Fill in shop details and create admin account
4. Login and start using!

## First Steps After Login

1. **Add Categories** (optional but recommended)
2. **Add Products** - Go to Products page, click "Add Product"
3. **Start Billing** - Go to POS page, search products, add to cart, complete sale
4. **View Dashboard** - See your sales analytics
5. **Check Reports** - Generate various reports

## Database Setup Script (Alternative Method)

If you can't use MySQL command line, create `setup-db.js` in the root directory:

```javascript
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

async function setupDatabase() {
  try {
    // Connect without database first
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT) || 3306,
    });

    console.log('Connected to MySQL server');

    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'multi_shop_billing'}`);
    console.log('Database created or already exists');

    // Close connection and reconnect to the new database
    await connection.end();

    const dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'multi_shop_billing',
      port: parseInt(process.env.DB_PORT) || 3306,
      multipleStatements: true,
    });

    // Read and execute schema
    const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
    await dbConnection.query(schema);
    console.log('Schema imported successfully');

    await dbConnection.end();
    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error setting up database:', error.message);
    process.exit(1);
  }
}

setupDatabase();
```

Then run:
```bash
# Make sure backend/.env exists first with DB credentials
node setup-db.js
```

## Troubleshooting

### 'mysql' is not recognized (Windows)
- **Solution 1**: Use MySQL Workbench (Option C above) - Easiest!
- **Solution 2**: Use the Node.js setup script (Option D above)
- **Solution 3**: Add MySQL to PATH:
  1. Find MySQL installation (usually `C:\Program Files\MySQL\MySQL Server 8.0\bin`)
  2. Add to Windows PATH environment variable
  3. Restart terminal

### Database Connection Error
- Verify MySQL service is running (Windows Services or XAMPP/WAMP control panel)
- Check database credentials in `backend/.env`
- Test connection using MySQL Workbench
- Ensure database exists: Run `SHOW DATABASES;` in MySQL Workbench

### Backend Won't Start
- Check if port 5000 is available
- Verify all dependencies installed: `cd backend && npm install`
- Check `.env` file exists and has correct values

### Frontend Can't Connect to Backend
- Verify backend is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Open browser console for error messages

### CORS Errors
- Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- Restart backend after changing `.env`

## Next Steps

- Read [README.md](./README.md) for detailed documentation
- Check [API_DOCS.md](./API_DOCS.md) for API reference
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- Review [TESTING.md](./TESTING.md) for testing instructions

## Need Help?

- Check the console for error messages
- Review the documentation files
- Verify all environment variables are set correctly

Happy billing! 🎉

