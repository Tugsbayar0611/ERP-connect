-- ==========================================
-- ADD EXPIRY/BATCH TRACKING TO INVENTORY
-- Барааны хугацаа/баглааны мэдээлэл нэмэх
-- ==========================================

-- Phase 1.1: Add batch_number and expiry_date to stock_movements
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS expiry_date date;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch 
  ON stock_movements(batch_number) 
  WHERE batch_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_expiry 
  ON stock_movements(expiry_date) 
  WHERE expiry_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN stock_movements.batch_number IS 'Баглааны дугаар (Batch/Lot number)';
COMMENT ON COLUMN stock_movements.expiry_date IS 'Хугацаа дуусах огноо (Expiry date)';

-- Phase 1.2: Add track_expiry toggle to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS track_expiry boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN products.track_expiry IS 'Expiry date tracking шаардлагатай эсэх (хүнс/эм/гоо сайхан)';

-- Add index for faster queries on track_expiry
CREATE INDEX IF NOT EXISTS idx_products_track_expiry 
  ON products(track_expiry) 
  WHERE track_expiry = true;
