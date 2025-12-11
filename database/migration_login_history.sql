-- Migration: Add login_history table for tracking login attempts
-- Run this script to enable login history tracking

CREATE TABLE IF NOT EXISTS login_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  shop_id INT NULL,
  username VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  login_status ENUM('success', 'failed') NOT NULL,
  failure_reason VARCHAR(255) NULL,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_shop_id (shop_id),
  INDEX idx_login_at (login_at),
  INDEX idx_login_status (login_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

