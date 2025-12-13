-- Migration: Add gst_rates column to shops table
-- This allows shops to store which GST rates they want to use
-- Stored as JSON array: ["0", "5", "12", "18"] or ["0"] for GST-free shops
-- NULL means all rates available (backward compatibility)

-- Add gst_rates field to shops table (check if column exists first)
SET @dbname = DATABASE();
SET @tablename = 'shops';
SET @columnname = 'gst_rates';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' JSON NULL AFTER gstin')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

