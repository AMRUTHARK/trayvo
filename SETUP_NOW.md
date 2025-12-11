# Quick Setup - Run These Commands

## Step 1: Create Environment Files

**Create `backend/.env` file** with this content:
```env
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
```

**Create `.env.local` file** in root with:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Step 2: Make Sure MySQL is Running

- **XAMPP**: Open XAMPP Control Panel → Start MySQL
- **MySQL Installer**: Check Windows Services (should be running automatically)

## Step 3: Install Dependencies & Run Setup

Open PowerShell in the project directory and run:

```powershell
# Install dependencies
npm install
cd backend
npm install
cd ..

# Run database setup
node setup-db.js
```

## Step 4: Start the Application

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
npm run dev
```

## Step 5: Access Application

Open browser: http://localhost:3000

## Step 6: Create Super Admin (First Time Only)

```powershell
npm run create-superadmin
```

Follow the instructions to create your first super admin account.

## Step 7: Email Configuration (Optional)

To enable email invitations for user registration, configure SMTP settings in `backend/.env`. See `EMAIL_SETUP.md` for detailed instructions.

**Note:** Registration now requires invitation tokens. Super admin can send invitations from the Super Admin dashboard.

