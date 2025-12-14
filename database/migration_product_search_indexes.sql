-- Migration: Add indexes for product search performance
-- This significantly improves search speed in POS billing screen

-- Index on product name (most commonly searched field)
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Composite indexes for shop-specific searches (most efficient for filtered searches)
CREATE INDEX IF NOT EXISTS idx_products_shop_name ON products(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_products_shop_sku ON products(shop_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_shop_barcode ON products(shop_id, barcode);

-- Combined index for multi-column searches (optimizes WHERE shop_id AND (name LIKE OR sku LIKE OR barcode LIKE))
CREATE INDEX IF NOT EXISTS idx_products_shop_search ON products(shop_id, name, sku, barcode);

