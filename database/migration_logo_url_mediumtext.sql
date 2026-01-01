-- Migration: Change logo_url column from TEXT to MEDIUMTEXT
-- This allows storing larger base64-encoded images
-- Base64 encoding increases file size by ~33%, so a 1.4MB image becomes ~1.86MB when encoded
-- TEXT can hold up to 65,535 bytes (64KB) - too small for large logos
-- MEDIUMTEXT can hold up to 16,777,215 bytes (16MB) - sufficient for large base64-encoded logos

-- Modify logo_url column to MEDIUMTEXT (safe to run even if already MEDIUMTEXT or LONGTEXT)
ALTER TABLE shops MODIFY COLUMN logo_url MEDIUMTEXT;

