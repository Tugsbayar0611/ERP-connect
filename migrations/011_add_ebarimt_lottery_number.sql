-- Migration: Add lottery number field to invoices table for E-barimt
-- Date: 2026-01-13
-- Description: Add ebarimt_lottery_number field to store lottery number from E-barimt system

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS ebarimt_lottery_number text;

COMMENT ON COLUMN invoices.ebarimt_lottery_number IS 'E-barimt сугалааны дугаар (8 орон)';
