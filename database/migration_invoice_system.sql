-- Migration: Invoice System Enhancements
-- Adds support for A4 invoices, HSN codes, shipping addresses, bank details, and invoice templates
-- Run this migration to enable professional invoice generation

-- Step 1: Add shop fields for invoice generation
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL AFTER address,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255) NULL AFTER gstin,
ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255) NULL AFTER bank_name,
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) NULL AFTER bank_branch,
ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20) NULL AFTER account_number,
ADD COLUMN IF NOT EXISTS invoice_number_prefix VARCHAR(20) NULL DEFAULT 'BILL' AFTER ifsc_code,
ADD COLUMN IF NOT EXISTS invoice_number_pattern VARCHAR(100) NULL DEFAULT '{PREFIX}-{DATE}-{SEQUENCE}' AFTER invoice_number_prefix,
ADD COLUMN IF NOT EXISTS invoice_sequence_number INT DEFAULT 0 AFTER invoice_number_pattern;

-- Step 2: Add HSN code to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20) NULL AFTER sku;

-- Step 3: Add shipping address and customer GSTIN to bills table
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(15) NULL AFTER customer_email,
ADD COLUMN IF NOT EXISTS customer_address TEXT NULL AFTER customer_gstin,
ADD COLUMN IF NOT EXISTS shipping_address TEXT NULL AFTER customer_address;

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

-- Step 6: Insert default templates for existing shops
-- This will be handled by application logic, but we create a procedure for reference
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS create_default_templates_for_shop(IN p_shop_id INT)
BEGIN
  DECLARE thermal_template_count INT;
  DECLARE a4_template_count INT;
  
  -- Check if thermal template exists
  SELECT COUNT(*) INTO thermal_template_count 
  FROM invoice_templates 
  WHERE shop_id = p_shop_id AND template_type = 'thermal' AND is_default_for_type = TRUE;
  
  -- Check if A4 template exists
  SELECT COUNT(*) INTO a4_template_count 
  FROM invoice_templates 
  WHERE shop_id = p_shop_id AND template_type = 'a4' AND is_default_for_type = TRUE;
  
  -- Create default thermal template if not exists
  IF thermal_template_count = 0 THEN
    INSERT INTO invoice_templates (shop_id, template_name, template_type, is_default_for_type, template_config)
    VALUES (p_shop_id, 'Thermal Simple', 'thermal', TRUE, 
      JSON_OBJECT(
        'version', '1.0',
        'sections', JSON_OBJECT(
          'header', JSON_OBJECT('enabled', TRUE, 'showLogo', FALSE),
          'items', JSON_OBJECT('columns', JSON_ARRAY('item', 'qty', 'rate', 'amount')),
          'totals', JSON_OBJECT('showTaxBreakdown', FALSE)
        )
      )
    );
  END IF;
  
  -- Create default A4 professional template if not exists
  IF a4_template_count = 0 THEN
    INSERT INTO invoice_templates (shop_id, template_name, template_type, is_default_for_type, template_config)
    VALUES (p_shop_id, 'A4 Professional', 'a4', TRUE,
      JSON_OBJECT(
        'version', '1.0',
        'pageSize', 'a4',
        'sections', JSON_OBJECT(
          'header', JSON_OBJECT(
            'enabled', TRUE,
            'showLogo', TRUE,
            'logoPosition', 'right',
            'fields', JSON_ARRAY('name', 'address', 'phone', 'email', 'gstin', 'state')
          ),
          'billing', JSON_OBJECT(
            'enabled', TRUE,
            'title', 'Bill To',
            'fields', JSON_ARRAY('name', 'address', 'phone', 'gstin', 'state')
          ),
          'shipping', JSON_OBJECT(
            'enabled', TRUE,
            'title', 'Shipping To',
            'defaultToBilling', TRUE
          ),
          'items', JSON_OBJECT(
            'columns', JSON_ARRAY('sl_no', 'items', 'hsn', 'unit_price', 'quantity', 'amount')
          ),
          'totals', JSON_OBJECT(
            'showTaxBreakdown', TRUE,
            'showCGST', TRUE,
            'showSGST', TRUE
          ),
          'bankDetails', JSON_OBJECT(
            'enabled', TRUE,
            'position', 'bottom_left'
          ),
          'footer', JSON_OBJECT(
            'showQueryContact', TRUE,
            'showSignature', TRUE
          )
        ),
        'styling', JSON_OBJECT(
          'fontFamily', 'Arial, sans-serif',
          'primaryColor', '#000000',
          'borderStyle', 'solid'
        )
      )
    );
  END IF;
END//
DELIMITER ;

-- Note: The procedure above is for reference. Actual template creation should be handled
-- by the application when a shop is created or first accesses invoice settings.

