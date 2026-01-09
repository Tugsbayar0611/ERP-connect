-- ==========================================
-- ACCOUNTING SCHEMA PATCHES
-- ==========================================
-- Критик засварууд (Production-ready)

-- 1. Currencies хүснэгт
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL, -- 'MNT', 'USD', 'CNY'
  name text NOT NULL,
  symbol text NOT NULL, -- '₮', '$', '¥'
  rate numeric(10,4) DEFAULT 1.0000,
  is_base boolean DEFAULT false,
  is_active boolean DEFAULT true,
  updated_at timestamp DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- 2. Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- asset, liability, equity, income, expense
  parent_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  level integer NOT NULL,
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, code)
);

-- 3. Journals
CREATE TABLE IF NOT EXISTS journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  type text NOT NULL, -- sales, purchase, bank, cash, general
  default_debit_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  default_credit_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, code)
);

-- 4. Fiscal Years
CREATE TABLE IF NOT EXISTS fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'open', -- open, closed
  closed_at timestamp,
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, year)
);

-- 5. Fiscal Periods
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid REFERENCES fiscal_years(id) ON DELETE CASCADE NOT NULL,
  period_number integer NOT NULL, -- 1-12
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'open', -- open, closed, locked
  locked_at timestamp,
  locked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(fiscal_year_id, period_number)
);

-- 6. Period Locks
CREATE TABLE IF NOT EXISTS period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid REFERENCES fiscal_periods(id) ON DELETE CASCADE NOT NULL,
  lock_type text NOT NULL, -- 'posting' | 'all'
  locked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  locked_at timestamp DEFAULT now(),
  notes text
);

-- 7. Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  journal_id uuid REFERENCES journals(id) ON DELETE SET NULL,
  entry_number text NOT NULL,
  entry_date date NOT NULL,
  description text,
  reference text,
  status text DEFAULT 'draft', -- draft, posted, cancelled, reversed
  posted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  posted_at timestamp,
  reversal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  reversed_by_entry_id uuid,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL, -- ✅ PATCH: currency_code → currency_id
  exchange_rate numeric(10,4) DEFAULT 1.0000,
  fiscal_period_id uuid REFERENCES fiscal_periods(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE(tenant_id, entry_number)
);

-- 8. Journal Lines
CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
  debit numeric(14,2) DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) DEFAULT 0 CHECK (credit >= 0),
  amount_currency numeric(14,2),
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL, -- ✅ PATCH: currency_code → currency_id
  currency_rate numeric(10,4) DEFAULT 1.0000,
  partner_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  description text,
  reference text,
  CONSTRAINT debit_or_credit CHECK (debit = 0 OR credit = 0),
  CONSTRAINT not_both_zero CHECK (debit != 0 OR credit != 0)
);

-- 9. Tax Codes (✅ PATCH: VAT accounts payable/receivable ялга)
CREATE TABLE IF NOT EXISTS tax_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  rate numeric(5,2) NOT NULL,
  type text NOT NULL, -- vat, income_tax
  tax_account_payable_id uuid REFERENCES accounts(id) ON DELETE SET NULL, -- ✅ ХХОАТ төлөх данс
  tax_account_receivable_id uuid REFERENCES accounts(id) ON DELETE SET NULL, -- ✅ ХХОАТ авах данс
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, code)
);

-- 10. Tax Lines
CREATE TABLE IF NOT EXISTS tax_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_line_id uuid REFERENCES journal_lines(id) ON DELETE CASCADE NOT NULL,
  tax_code_id uuid REFERENCES tax_codes(id) ON DELETE RESTRICT NOT NULL,
  tax_base numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL,
  source_type text NOT NULL, -- 'invoice_line' | 'manual'
  source_id uuid,
  reference text,
  reference_id uuid
);

-- 11. Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  payment_number text NOT NULL,
  payment_date date NOT NULL,
  type text NOT NULL, -- 'payment' | 'receipt'
  amount numeric(14,2) NOT NULL,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL, -- ✅ PATCH: currency_code → currency_id
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  payment_method text,
  status text DEFAULT 'draft',
  reference text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  posted_at timestamp,
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, payment_number)
);

-- 12. Payment Allocations (✅ PATCH: UPSERT + cap checks)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  allocated_amount numeric(14,2) NOT NULL CHECK (allocated_amount > 0),
  allocation_date date NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE(payment_id, invoice_id)
);

-- ✅ PATCH: Allocation cap check function
CREATE OR REPLACE FUNCTION check_allocation_cap()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_amount numeric;
  v_invoice_amount numeric;
  v_total_allocated numeric;
BEGIN
  -- Get payment amount
  SELECT amount INTO v_payment_amount FROM payments WHERE id = NEW.payment_id;
  
  -- Get invoice total
  SELECT total_amount INTO v_invoice_amount FROM invoices WHERE id = NEW.invoice_id;
  
  -- Get total allocated for this payment
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total_allocated
  FROM payment_allocations
  WHERE payment_id = NEW.payment_id;
  
  -- Check: total allocated <= payment amount
  IF v_total_allocated + NEW.allocated_amount > v_payment_amount THEN
    RAISE EXCEPTION 'Allocation exceeds payment amount: % > %', 
      v_total_allocated + NEW.allocated_amount, v_payment_amount;
  END IF;
  
  -- Check: allocated <= invoice remaining
  IF NEW.allocated_amount > (v_invoice_amount - COALESCE((SELECT SUM(allocated_amount) FROM payment_allocations WHERE invoice_id = NEW.invoice_id), 0)) THEN
    RAISE EXCEPTION 'Allocation exceeds invoice remaining amount';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_allocation_cap_trigger
BEFORE INSERT OR UPDATE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION check_allocation_cap();

-- 13. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL, -- ✅ PATCH: currency_code → currency_id
  balance numeric(14,2) DEFAULT 0,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL, -- GL account
  is_active boolean DEFAULT true
);

-- 14. Bank Statements
CREATE TABLE IF NOT EXISTS bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
  statement_date date NOT NULL,
  opening_balance numeric(14,2) NOT NULL,
  closing_balance numeric(14,2) NOT NULL,
  imported_at timestamp DEFAULT now(),
  imported_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 15. Bank Statement Lines (✅ PATCH: debit/credit constraint)
CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid REFERENCES bank_statements(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  description text,
  debit numeric(14,2) DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) DEFAULT 0 CHECK (credit >= 0),
  balance numeric(14,2) NOT NULL,
  reference text,
  reconciled boolean DEFAULT false,
  CONSTRAINT debit_or_credit_bank CHECK (debit = 0 OR credit = 0), -- ✅ PATCH: зөвхөн нэг тал
  CONSTRAINT not_both_zero_bank CHECK (debit != 0 OR credit != 0)
);

-- 16. Reconciliations
CREATE TABLE IF NOT EXISTS reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  statement_line_id uuid REFERENCES bank_statement_lines(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'draft',
  total_matched_amount numeric(14,2) DEFAULT 0,
  reconciled_at timestamp,
  reconciled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp DEFAULT now()
);

-- 17. Reconciliation Matches (✅ PATCH: 3 FK баганатай)
CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid REFERENCES reconciliations(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE, -- ✅ FK 1
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE, -- ✅ FK 2
  journal_line_id uuid REFERENCES journal_lines(id) ON DELETE CASCADE, -- ✅ FK 3
  matched_amount numeric(14,2) NOT NULL CHECK (matched_amount > 0),
  match_date date NOT NULL,
  notes text,
  created_at timestamp DEFAULT now(),
  CONSTRAINT one_match_type CHECK (
    (invoice_id IS NOT NULL)::int + (payment_id IS NOT NULL)::int + (journal_line_id IS NOT NULL)::int = 1
  )
);

-- 18. Double-entry integrity trigger (✅ PATCH: posting-time дээр)
CREATE OR REPLACE FUNCTION check_double_entry_on_post()
RETURNS TRIGGER AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  -- Зөвхөн post хийхэд шалгана (draft дээр биш)
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    SELECT 
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO total_debit, total_credit
    FROM journal_lines
    WHERE entry_id = NEW.id;

    IF ABS(total_debit - total_credit) > 0.01 THEN -- Float тэвчих
      RAISE EXCEPTION 'Double-entry violation: Debit (%) != Credit (%)', 
        total_debit, total_credit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_double_entry_on_post_trigger
BEFORE UPDATE ON journal_entries
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION check_double_entry_on_post();

-- 19. Posted journal_lines write хориглох trigger (✅ PATCH)
CREATE OR REPLACE FUNCTION prevent_posted_journal_line_write()
RETURNS TRIGGER AS $$
DECLARE
  entry_status text;
BEGIN
  SELECT status INTO entry_status FROM journal_entries WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
  
  IF entry_status = 'posted' THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Cannot modify journal lines of posted entry';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete journal lines of posted entry';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_posted_journal_line_write_trigger
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_journal_line_write();

-- 20. Period lock check (✅ PATCH: INSERT+UPDATE дээр, tenant-aware + period derive)
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id uuid;
  v_tenant_id uuid;
  v_lock_exists boolean;
BEGIN
  -- Зөвхөн post хийхэд шалгана
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    -- Period derive (entry_date-аас)
    SELECT fp.id, fp.fiscal_year_id INTO v_period_id, v_tenant_id
    FROM fiscal_periods fp
    JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
    WHERE fy.tenant_id = NEW.tenant_id
      AND fp.start_date <= NEW.entry_date
      AND fp.end_date >= NEW.entry_date
      AND fp.status IN ('closed', 'locked')
    LIMIT 1;

    IF v_period_id IS NOT NULL THEN
      -- Check lock (tenant-aware)
      SELECT EXISTS(
        SELECT 1 FROM period_locks pl
        JOIN fiscal_periods fp ON pl.period_id = fp.id
        JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
        WHERE pl.period_id = v_period_id
          AND fy.tenant_id = NEW.tenant_id
          AND pl.lock_type IN ('posting', 'all')
      ) INTO v_lock_exists;

      IF v_lock_exists THEN
        RAISE EXCEPTION 'Period is locked for posting: %', v_period_id;
      END IF;
    END IF;
    
    -- Set fiscal_period_id
    SELECT fp.id INTO NEW.fiscal_period_id
    FROM fiscal_periods fp
    JOIN fiscal_years fy ON fp.fiscal_year_id = fy.id
    WHERE fy.tenant_id = NEW.tenant_id
      AND fp.start_date <= NEW.entry_date
      AND fp.end_date >= NEW.entry_date
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_period_lock_trigger
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_period_lock();
