-- Migration: Invoice System Enhancements
-- Adds support for A4 invoices, HSN codes, shipping addresses, bank details, and invoice templates
-- Run this migration to enable professional invoice generation

-- Step 1: Add shop fields for invoice generation
ALTER TABLE shops ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL AFTER address;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255) NULL AFTER gstin;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255) NULL AFTER bank_name;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) NULL AFTER bank_branch;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20) NULL AFTER account_number;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_number_prefix VARCHAR(20) NULL DEFAULT 'BILL' AFTER ifsc_code;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_number_pattern VARCHAR(100) NULL DEFAULT '{PREFIX}-{DATE}-{SEQUENCE}' AFTER invoice_number_prefix;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_sequence_number INT DEFAULT 0 AFTER invoice_number_pattern;

-- Step 2: Add HSN code to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) NULL AFTER sku;

-- Step 3: Add shipping address and customer GSTIN to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(15) NULL AFTER customer_email;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_address TEXT NULL AFTER customer_gstin;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS shipping_address TEXT NULL AFTER customer_address;

-- Step 4: Add HSN code to bill_items (snapshot at time of sale)
ALTER TABLE bill_items 
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) NULL AFTER sku;

-- Step 5: Create invoice_templates table for flexible invoice formatting
CREATE TABLE IF NOT EXISTS invoice_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  template_name VARCHAR(100) NOT NULL DEFAULT 'default',
  template_type ENUM('thermal', 'a4') NOT NULL DEFAULT 'a4',
  is_default_for_type BOOLEAN DEFAULT FALSE,
  template_config JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  INDEX idx_shop_id (shop_id),
  INDEX idx_template_type (template_type),
  INDEX idx_shop_type_default (shop_id, template_type, is_default_for_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Step 6: Default templates are created automatically by the application
-- when shops access invoice settings or when templates are first needed.
-- See backend/routes/invoiceTemplates.js for the implementation.

