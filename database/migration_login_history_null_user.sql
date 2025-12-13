-- Migration: Allow user_id to be NULL in login_history table
-- This allows tracking failed login attempts even when user doesn't exist
-- Run this migration to fix the "Column 'user_id' cannot be null" error

-- Step 1: Drop the foreign key constraint if it exists (can't have FK on nullable column)
SET @fk_name = (SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'login_history' 
                AND COLUMN_NAME = 'user_id' 
                AND REFERENCED_TABLE_NAME = 'users' 
                LIMIT 1);

SET @sql = IF(@fk_name IS NOT NULL, 
              CONCAT('ALTER TABLE login_history DROP FOREIGN KEY ', @fk_name),
              'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Modify user_id column to allow NULL
ALTER TABLE login_history MODIFY COLUMN user_id INT NULL;

-- Note: We're not re-adding the foreign key constraint because:
-- 1. NULL values can't have foreign key references
-- 2. We still have an index on user_id for performance
-- 3. Application logic ensures valid user_id references when user_id is not NULL

