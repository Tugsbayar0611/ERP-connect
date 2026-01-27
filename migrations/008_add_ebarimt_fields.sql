-- Migration: Add E-barimt fields to invoices table
-- Date: 2026-01-13
-- Description: Add E-barimt integration fields to store document ID, QR code, and receipt number

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS ebarimt_document_id text,
ADD COLUMN IF NOT EXISTS ebarimt_qr_code text,
ADD COLUMN IF NOT EXISTS ebarimt_receipt_number text,
ADD COLUMN IF NOT EXISTS ebarimt_sent_at timestamp;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_ebarimt_document_id ON invoices(ebarimt_document_id) WHERE ebarimt_document_id IS NOT NULL;

COMMENT ON COLUMN invoices.ebarimt_document_id IS 'E-barimt системийн баримтын ID';
COMMENT ON COLUMN invoices.ebarimt_qr_code IS 'E-barimt QR код (баталгаажуулалт)';
COMMENT ON COLUMN invoices.ebarimt_receipt_number IS 'E-barimt receipt number';
COMMENT ON COLUMN invoices.ebarimt_sent_at IS 'E-barimt руу илгээсэн огноо';
