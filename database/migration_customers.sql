-- Migration: Customers Management System
-- Adds customer management for B2B and repeat customers
-- Allows both quick billing (direct entry) and customer selection (auto-fill)

-- Step 1: Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  gstin VARCHAR(15),
  address TEXT,
  shipping_address TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  INDEX idx_shop_id (shop_id),
  INDEX idx_phone (phone),
  INDEX idx_gstin (gstin),
  INDEX idx_status (status),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Step 2: Add customer_id to bills table (nullable for backward compatibility)
ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_id INT NULL AFTER user_id;

