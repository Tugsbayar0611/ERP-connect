-- ==========================================
-- NUMBERING SEQUENCES
-- Concurrency-safe document numbering
-- ==========================================

-- Numbering Sequences Table
CREATE TABLE IF NOT EXISTS numbering_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL, -- 'invoice', 'sales_order', 'purchase_order', 'journal_entry', 'payment', 'reversal'
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL, -- Optional: branch-specific
  prefix text NOT NULL, -- 'INV', 'SO', 'PO', 'JE', 'REV', 'PAY'
  format text NOT NULL DEFAULT '{prefix}-{year}-{number:4}', -- Template format
  next_number integer NOT NULL DEFAULT 1,
  year integer, -- NULL = current year (auto-determined)
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, document_type, branch_id, year)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS numbering_sequences_tenant_type_idx 
  ON numbering_sequences(tenant_id, document_type, is_active);

-- Function: Get next number (concurrency-safe with SELECT FOR UPDATE)
CREATE OR REPLACE FUNCTION get_next_number(
  p_tenant_id uuid,
  p_document_type text,
  p_branch_id uuid DEFAULT NULL,
  p_year integer DEFAULT NULL
) RETURNS text AS $$
DECLARE
  v_seq_id uuid;
  v_prefix text;
  v_format text;
  v_year integer;
  v_next_number integer;
  v_result text;
  v_year_default integer;
BEGIN
  -- Default to current year if not specified
  v_year_default := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  
  -- Get or create sequence with row-level lock (FOR UPDATE)
  SELECT id, prefix, format, COALESCE(year, v_year_default), next_number
  INTO v_seq_id, v_prefix, v_format, v_year, v_next_number
  FROM numbering_sequences
  WHERE tenant_id = p_tenant_id
    AND document_type = p_document_type
    AND COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
        COALESCE(p_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(year, v_year_default) = v_year_default
    AND is_active = true
  FOR UPDATE; -- ✅ Row-level lock (concurrency-safe)

  -- If sequence doesn't exist, create it
  IF v_seq_id IS NULL THEN
    -- Auto-determine prefix from document type
    v_prefix := CASE p_document_type
      WHEN 'invoice' THEN 'INV'
      WHEN 'sales_order' THEN 'SO'
      WHEN 'purchase_order' THEN 'PO'
      WHEN 'journal_entry' THEN 'JE'
      WHEN 'reversal' THEN 'REV'
      WHEN 'payment' THEN 'PAY'
      ELSE UPPER(SUBSTRING(p_document_type, 1, 3))
    END;
    
    INSERT INTO numbering_sequences (
      tenant_id, 
      document_type, 
      branch_id, 
      prefix, 
      format, 
      year, 
      next_number
    )
    VALUES (
      p_tenant_id, 
      p_document_type, 
      p_branch_id, 
      v_prefix, 
      '{prefix}-{year}-{number:4}',
      v_year_default,
      1
    )
    RETURNING id, prefix, format, year, next_number
    INTO v_seq_id, v_prefix, v_format, v_year, v_next_number;
  END IF;

  -- Increment and update (within the locked row)
  UPDATE numbering_sequences
  SET next_number = next_number + 1,
      updated_at = now()
  WHERE id = v_seq_id;

  -- Format the number according to template
  -- Support: {prefix}, {year}, {number:N} (N = padding width)
  v_result := v_format;
  v_result := replace(v_result, '{prefix}', v_prefix);
  v_result := replace(v_result, '{year}', v_year::text);
  
  -- Handle {number:N} pattern (e.g., {number:4} = 0001, {number:5} = 00001)
  IF v_result ~ '{number:[0-9]+}' THEN
    DECLARE
      v_padding_width integer;
      v_number_str text;
    BEGIN
      -- Extract padding width from format (default 4)
      v_padding_width := COALESCE(
        (regexp_match(v_result, '{number:([0-9]+)}'))[1]::integer,
        4
      );
      v_number_str := LPAD(v_next_number::text, v_padding_width, '0');
      v_result := regexp_replace(v_result, '{number:[0-9]+}', v_number_str);
    END;
  ELSE
    -- Default: just replace {number} with padded number
    v_result := replace(v_result, '{number}', LPAD(v_next_number::text, 4, '0'));
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Test function (optional, can remove in production)
-- SELECT get_next_number('tenant-id', 'invoice', NULL, 2024);
-- Should return: 'INV-2024-0001'
