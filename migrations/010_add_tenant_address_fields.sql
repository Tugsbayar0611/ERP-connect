-- Migration: Add address fields to tenants table for E-barimt integration
-- Date: 2026-01-13
-- Description: Add address, district, and city fields to tenants table for E-barimt invoice generation

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS city text DEFAULT 'Улаанбаатар';

COMMENT ON COLUMN tenants.address IS 'Байгууллагын хаяг (E-barimt-д хэрэгтэй)';
COMMENT ON COLUMN tenants.district IS 'Дүүрэг (E-barimt-д хэрэгтэй)';
COMMENT ON COLUMN tenants.city IS 'Хот (E-barimt-д хэрэгтэй)';
