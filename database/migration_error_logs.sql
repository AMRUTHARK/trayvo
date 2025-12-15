-- Migration: Create error_logs table for tracking application errors
-- This table stores all application errors for debugging and monitoring

CREATE TABLE IF NOT EXISTS error_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  error_type VARCHAR(50) NOT NULL DEFAULT 'application',
  error_level ENUM('error', 'warning', 'critical', 'info') NOT NULL DEFAULT 'error',
  error_message TEXT NOT NULL,
  error_stack TEXT,
  request_path VARCHAR(500),
  request_method VARCHAR(10),
  request_body JSON,
  request_query JSON,
  request_headers JSON,
  user_id INT NULL,
  shop_id INT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status_code INT,
  response_time_ms INT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP NULL,
  resolved_by INT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_error_type (error_type),
  INDEX idx_error_level (error_level),
  INDEX idx_user_id (user_id),
  INDEX idx_shop_id (shop_id),
  INDEX idx_resolved (resolved),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

