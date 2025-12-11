# Super Admin Setup Guide

This guide explains how to set up and use the Super Admin functionality to manage all shops in the system.

## Overview

Super Admin is a special role that can:
- View all shops in the system
- Create new shops
- Edit existing shops
- Manage users for any shop
- Access all shop data

## Database Setup

### For New Installations

If you're setting up a fresh database, the updated `schema.sql` already includes super admin support. Just run:

```bash
mysql -u root -p multi_shop_billing < database/schema.sql
```

### For Existing Installations

If you already have a database, run the migration script:

```bash
mysql -u root -p multi_shop_billing < database/migration_superadmin.sql
```

**Important**: The migration script will:
1. Add `super_admin` to the role ENUM
2. Make `shop_id` nullable for super admin users
3. Update foreign key constraints to allow NULL shop_id

## Creating the First Super Admin

### Method 1: Using the Script (Recommended)

1. Make sure your `backend/.env` file has the correct database credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=multi_shop_billing
   ```

2. Optionally, set super admin credentials in `backend/.env`:
   ```env
   SUPERADMIN_USERNAME=superadmin
   SUPERADMIN_EMAIL=superadmin@system.com
   SUPERADMIN_PASSWORD=YourSecurePassword123!
   SUPERADMIN_FULL_NAME=Super Administrator
   ```

3. Run the creation script:
   ```bash
   npm run create-superadmin
   ```

   Or directly:
   ```bash
   node create-superadmin.js
   ```

### Method 2: Manual SQL

If you prefer to create it manually:

```sql
-- Hash your password first (use bcrypt with 10 rounds)
-- For example, password "SuperAdmin123!" would be hashed

INSERT INTO users (shop_id, username, email, password_hash, role, full_name, is_active)
VALUES (
  NULL,
  'superadmin',
  'superadmin@system.com',
  '$2a$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
  'super_admin',
  'Super Administrator',
  TRUE
);
```

To generate a bcrypt hash, you can use Node.js:
```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('YourPassword', 10);
console.log(hash);
```

## Login as Super Admin

1. Go to the login page: `http://localhost:3000/login`
2. Enter your super admin username and password
3. You'll be redirected to the dashboard
4. You'll see a "Super Admin" menu item in the left sidebar

## Super Admin Features

### Shop Management

- **View All Shops**: See a list of all shops with statistics (users, products, bills)
- **Create Shop**: Register a new shop with an admin user
- **Edit Shop**: Update shop details (name, owner, contact info, etc.)
- **View Shop Users**: See all users for a specific shop
- **Create Shop Users**: Add new users (admin or cashier) to any shop

### Access Control

- Super admin can access all shops' data
- Super admin bypasses shop isolation middleware
- Super admin can specify `shop_id` in API requests to access specific shop data

## API Endpoints

All super admin endpoints are under `/api/superadmin`:

- `GET /api/superadmin/shops` - List all shops
- `GET /api/superadmin/shops/:id` - Get shop details
- `POST /api/superadmin/shops` - Create new shop
- `PUT /api/superadmin/shops/:id` - Update shop
- `DELETE /api/superadmin/shops/:id` - Delete shop (soft delete)
- `GET /api/superadmin/shops/:id/users` - Get shop users
- `POST /api/superadmin/shops/:id/users` - Create shop user

## Security Notes

1. **Change Default Password**: Always change the default super admin password after first login
2. **Limit Access**: Only trusted personnel should have super admin access
3. **Audit Logs**: Consider adding audit logging for super admin actions
4. **Strong Passwords**: Use strong, unique passwords for super admin accounts

## Troubleshooting

### "Super admin access required" error

- Make sure you're logged in as a user with `role = 'super_admin'`
- Check that the database migration was run successfully
- Verify the user's role in the database

### Cannot create super admin

- Ensure the database schema supports `super_admin` role
- Check that `shop_id` can be NULL in the users table
- Verify database connection credentials in `backend/.env`

### Super Admin menu not showing

- Clear browser cache and localStorage
- Logout and login again
- Check that `isSuperAdmin()` function returns true in browser console

## Next Steps

After creating your super admin:

1. Login and verify you can see the "Super Admin" menu
2. Create a test shop to verify functionality
3. Change the default password
4. Create additional super admin users if needed (manually via SQL)

