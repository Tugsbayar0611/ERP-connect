-- Migration: Create E-barimt settings table
-- Date: 2026-01-13
-- Description: Create ebarimt_settings table (similar to qpay_settings)

CREATE TABLE IF NOT EXISTS ebarimt_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
  pos_endpoint text, -- POS API endpoint URL
  api_key text, -- API authentication key
  api_secret text, -- API secret (encrypted in production)
  auto_send boolean NOT NULL DEFAULT false, -- Auto-send invoice when paid
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ebarimt_settings_tenant ON ebarimt_settings(tenant_id);

COMMENT ON TABLE ebarimt_settings IS 'E-barimt (И-баримт) системийн тохиргоо';
COMMENT ON COLUMN ebarimt_settings.pos_endpoint IS 'POS API endpoint URL';
COMMENT ON COLUMN ebarimt_settings.api_key IS 'API authentication key';
COMMENT ON COLUMN ebarimt_settings.api_secret IS 'API secret (production дээр encrypted)';
COMMENT ON COLUMN ebarimt_settings.auto_send IS 'Invoice paid болоход автоматаар E-barimt руу илгээх';
