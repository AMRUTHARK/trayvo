-- Migration script to add Super Admin support
-- Run this script to enable super admin functionality

-- Step 1: Modify users table to support super_admin role
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'cashier', 'super_admin') NOT NULL DEFAULT 'cashier';

-- Step 2: Make shop_id nullable for super admin users
ALTER TABLE users MODIFY COLUMN shop_id INT NULL;

-- Step 3: Remove the foreign key constraint temporarily (if needed)
-- Note: This might fail if there are existing users, in which case we'll handle it differently
-- ALTER TABLE users DROP FOREIGN KEY users_ibfk_1;

-- Step 4: Update the foreign key to allow NULL shop_id
-- First, drop the existing foreign key
SET @fk_name = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'users' 
                AND COLUMN_NAME = 'shop_id' 
                AND REFERENCED_TABLE_NAME = 'shops' 
                LIMIT 1);

SET @sql = CONCAT('ALTER TABLE users DROP FOREIGN KEY ', @fk_name);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add new foreign key that allows NULL
ALTER TABLE users 
ADD CONSTRAINT users_ibfk_shop 
FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- Step 5: Update unique constraint to allow NULL shop_id for super admin
-- Drop existing unique constraint
ALTER TABLE users DROP INDEX unique_shop_username;

-- Add new unique constraint that allows multiple NULL shop_ids
ALTER TABLE users 
ADD UNIQUE KEY unique_shop_username (shop_id, username);

-- Note: MySQL allows multiple NULL values in a UNIQUE constraint, 
-- so super admins (with shop_id = NULL) can have the same username
-- We'll handle username uniqueness for super admins in application code

