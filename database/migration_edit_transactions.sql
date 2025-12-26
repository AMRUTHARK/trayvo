-- Migration: Add Edit Transaction Support
-- Enables editing of bills and purchases with audit trail and lock functionality

-- Add edit tracking fields to bills table
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_reason VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS locked_by INT NULL,
ADD COLUMN IF NOT EXISTS gst_period_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_edited_by INT NULL,
ADD COLUMN IF NOT EXISTS edit_count INT DEFAULT 0;

-- Add foreign keys for edit tracking (if columns don't exist)
-- Note: We'll add these with ALTER TABLE separately if needed
-- ALTER TABLE bills ADD FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL;
-- ALTER TABLE bills ADD FOREIGN KEY (last_edited_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add edit tracking fields to purchases table
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_reason VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS locked_by INT NULL,
ADD COLUMN IF NOT EXISTS gst_period_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_edited_by INT NULL,
ADD COLUMN IF NOT EXISTS edit_count INT DEFAULT 0;

-- Create transaction_edit_history table for audit trail
CREATE TABLE IF NOT EXISTS transaction_edit_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_type ENUM('bill', 'purchase') NOT NULL,
  transaction_id INT NOT NULL,
  edit_number INT NOT NULL DEFAULT 1,
  edited_by INT NOT NULL,
  edit_reason TEXT,
  changes_summary JSON,
  original_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_transaction (transaction_type, transaction_id),
  INDEX idx_edited_by (edited_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

