-- Migration: Add Purchase, Purchase Return, and Sales Return tables
-- This enables purchase management, purchase returns, and sales returns functionality

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  purchase_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255),
  supplier_phone VARCHAR(20),
  supplier_email VARCHAR(255),
  supplier_address TEXT,
  user_id INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  discount_percent DECIMAL(5, 2) DEFAULT 0.00,
  gst_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_mode ENUM('cash', 'upi', 'card', 'credit') DEFAULT 'cash',
  payment_details JSON,
  status ENUM('completed', 'pending', 'cancelled') DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY unique_shop_purchase_number (shop_id, purchase_number),
  INDEX idx_shop_id (shop_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Purchase Items table
CREATE TABLE IF NOT EXISTS purchase_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  gst_rate DECIMAL(5, 2) DEFAULT 0.00,
  gst_amount DECIMAL(10, 2) DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_purchase_id (purchase_id),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Purchase Returns table
CREATE TABLE IF NOT EXISTS purchase_returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  purchase_return_number VARCHAR(50) NOT NULL,
  purchase_id INT NOT NULL,
  supplier_name VARCHAR(255),
  user_id INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  gst_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  return_reason TEXT,
  status ENUM('completed', 'pending', 'cancelled') DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY unique_shop_purchase_return_number (shop_id, purchase_return_number),
  INDEX idx_shop_id (shop_id),
  INDEX idx_purchase_id (purchase_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Purchase Return Items table
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  purchase_return_id INT NOT NULL,
  purchase_item_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  gst_rate DECIMAL(5, 2) DEFAULT 0.00,
  gst_amount DECIMAL(10, 2) DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_purchase_return_id (purchase_return_id),
  INDEX idx_purchase_item_id (purchase_item_id),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sales Returns table
CREATE TABLE IF NOT EXISTS sales_returns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  sales_return_number VARCHAR(50) NOT NULL,
  bill_id INT NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  user_id INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  gst_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  return_reason TEXT,
  refund_mode ENUM('cash', 'upi', 'card', 'credit') DEFAULT 'cash',
  refund_details JSON,
  status ENUM('completed', 'pending', 'cancelled') DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY unique_shop_sales_return_number (shop_id, sales_return_number),
  INDEX idx_shop_id (shop_id),
  INDEX idx_bill_id (bill_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sales Return Items table
CREATE TABLE IF NOT EXISTS sales_return_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sales_return_id INT NOT NULL,
  bill_item_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  gst_rate DECIMAL(5, 2) DEFAULT 0.00,
  gst_amount DECIMAL(10, 2) DEFAULT 0.00,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_item_id) REFERENCES bill_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  INDEX idx_sales_return_id (sales_return_id),
  INDEX idx_bill_item_id (bill_item_id),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Update stock_ledger reference_type enum to include new reference types
ALTER TABLE stock_ledger MODIFY COLUMN reference_type ENUM('bill', 'purchase', 'purchase_return', 'sales_return', 'adjustment') DEFAULT 'bill';

