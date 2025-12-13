-- Migration: Change logo_url column from VARCHAR(500) to TEXT
-- This allows storing base64-encoded images which can be much larger than 500 characters
-- Base64 encoding increases file size by ~33%, so a 2MB image becomes ~2.67MB when encoded
-- TEXT can hold up to 65,535 bytes, which is sufficient for base64-encoded images

-- Modify logo_url column to TEXT (safe to run even if already TEXT)
ALTER TABLE shops MODIFY COLUMN logo_url TEXT;

