-- Migration: Add admin_user_id to shops table
-- This allows tracking which user is the shop admin and ensures one admin per shop

SET @dbname = DATABASE();
SET @tablename = 'shops';

-- Add admin_user_id column (without foreign key first, as users table might not have data yet)
SET @columnname = 'admin_user_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL AFTER status')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key constraint separately (check if it exists first)
SET @fkname = 'shops_ibfk_admin_user_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (CONSTRAINT_NAME = @fkname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ', @fkname, ' FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_shop_admin_user_id ON shops(admin_user_id);

-- Update existing shops: if they have an admin user, set admin_user_id
-- Find the first admin user for each shop and set it
UPDATE shops s
INNER JOIN (
  SELECT shop_id, MIN(id) as admin_id
  FROM users
  WHERE role = 'admin' AND shop_id IS NOT NULL
  GROUP BY shop_id
) u ON s.id = u.shop_id
SET s.admin_user_id = u.admin_id
WHERE s.admin_user_id IS NULL;
