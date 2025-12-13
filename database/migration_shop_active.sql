-- Migration: Add is_active column to shops table
-- This allows super admin to disable shops and prevent access for shop admin and cashier users

-- Add is_active column to shops table if it doesn't exist
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_shop_active ON shops(is_active);

-- Update existing shops to be active by default (if column was just added)
UPDATE shops SET is_active = TRUE WHERE is_active IS NULL;

