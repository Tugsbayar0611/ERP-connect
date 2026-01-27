-- Migration: Add Padan numbering system for idempotent Padan generation
-- Date: 2026-01-13
-- Description: Add padan_number_sequences table and padan number fields to invoices table

-- Create padan_number_sequences table for sequence management
CREATE TABLE IF NOT EXISTS padan_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'DISPATCH' or 'RECEIPT'
  period text NOT NULL, -- 'YYYYMM' format (e.g., '202401')
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, type, period)
);

COMMENT ON TABLE padan_number_sequences IS 'Паданы дугаарын sequence management (idempotent numbering)';
COMMENT ON COLUMN padan_number_sequences.type IS 'Паданы төрөл: DISPATCH (Зарлагын) эсвэл RECEIPT (Орлогын)';
COMMENT ON COLUMN padan_number_sequences.period IS 'Хугацаа YYYYMM формат (жиш: 202401)';
COMMENT ON COLUMN padan_number_sequences.last_number IS 'Сүүлийн ашигласан дугаар';

-- Add padan number fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS dispatch_padan_number text,
ADD COLUMN IF NOT EXISTS receipt_padan_number text;

COMMENT ON COLUMN invoices.dispatch_padan_number IS 'Зарлагын паданы дугаар (ЗП-YYYYMM-000123)';
COMMENT ON COLUMN invoices.receipt_padan_number IS 'Орлогын паданы дугаар (ОП-YYYYMM-000045)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_padan_sequences_tenant_type_period 
ON padan_number_sequences(tenant_id, type, period);

CREATE INDEX IF NOT EXISTS idx_invoices_dispatch_padan 
ON invoices(dispatch_padan_number) 
WHERE dispatch_padan_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_receipt_padan 
ON invoices(receipt_padan_number) 
WHERE receipt_padan_number IS NOT NULL;
