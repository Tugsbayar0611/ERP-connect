-- QPay Integration Schema
-- QPay төлбөрийн системийн интеграци

-- QPay Settings (tenant бүр өөрийн credential)
CREATE TABLE IF NOT EXISTS qpay_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
  client_id text,
  client_secret text, -- Encrypted in production
  invoice_code text, -- QPay invoice code
  callback_secret text, -- Webhook verification secret
  webhook_url text, -- Auto-generated webhook URL
  auto_posting boolean NOT NULL DEFAULT false, -- Auto-post payment to journal
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(tenant_id)
);

-- QPay Invoices (Invoice бүр дээр QR үүсгэхэд)
CREATE TABLE IF NOT EXISTS qpay_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  qpay_invoice_id text, -- QPay-аас буцаж ирсэн invoice ID
  qr_image text, -- Base64 QR code image
  qr_text text, -- QR code text
  amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'expired' | 'cancelled'
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL, -- Payment үүсэхэд холбоно
  callback_url text, -- Invoice-specific callback URL
  expires_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(invoice_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qpay_settings_tenant ON qpay_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qpay_invoices_tenant ON qpay_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qpay_invoices_invoice ON qpay_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_qpay_invoices_status ON qpay_invoices(status);
CREATE INDEX IF NOT EXISTS idx_qpay_invoices_qpay_id ON qpay_invoices(qpay_invoice_id);
