-- Migration: Add registration_tokens table for email invitation system
-- Run this script to enable invitation-based registration

CREATE TABLE IF NOT EXISTS registration_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_shop_id (shop_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

