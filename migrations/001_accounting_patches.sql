-- ==========================================
-- ACCOUNTING SCHEMA PATCHES
-- Critical fixes for production-ready schema
-- ==========================================

-- Note: Drizzle ORM дээр check constraints болон triggers нь SQL migration-оор нэмэгдэнэ

-- ✅ PATCH 1: currency_code FK → currency_id болгож зас
-- (Journal entries, journal lines, payments, bank accounts дээр)

-- ✅ PATCH 2: reconciliation_matches polymorphic → 3 FK баганатай болго
-- (Дээр schema.ts дээр хийгдсэн)

-- ✅ PATCH 3: double-entry шалгалт → posting-time trigger рүү шилжүүл
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

DROP TRIGGER IF EXISTS check_double_entry_on_post_trigger ON journal_entries;
CREATE TRIGGER check_double_entry_on_post_trigger
BEFORE UPDATE ON journal_entries
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION check_double_entry_on_post();

-- ✅ PATCH 4: posted journal_lines write хориглох trigger нэм
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

DROP TRIGGER IF EXISTS prevent_posted_journal_line_write_trigger ON journal_lines;
CREATE TRIGGER prevent_posted_journal_line_write_trigger
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION prevent_posted_journal_line_write();

-- ✅ PATCH 5: period lock → INSERT+UPDATE дээр, tenant-aware + period derive
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id uuid;
  v_lock_exists boolean;
BEGIN
  -- Зөвхөн post хийхэд шалгана
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    -- Period derive (entry_date-аас) + tenant-aware
    SELECT fp.id INTO v_period_id
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
    
    -- Auto-set fiscal_period_id
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

DROP TRIGGER IF EXISTS check_period_lock_trigger ON journal_entries;
CREATE TRIGGER check_period_lock_trigger
BEFORE INSERT OR UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_period_lock();

-- ✅ PATCH 6: VAT accounts → payable/receivable ялга
-- (Дээр schema.ts дээр хийгдсэн: tax_account_payable_id, tax_account_receivable_id)

-- ✅ PATCH 7: allocations дээр UPSERT + cap checks
CREATE OR REPLACE FUNCTION check_allocation_cap()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_amount numeric;
  v_invoice_amount numeric;
  v_total_allocated numeric;
  v_invoice_allocated numeric;
BEGIN
  -- Get payment amount
  SELECT amount INTO v_payment_amount FROM payments WHERE id = NEW.payment_id;
  
  -- Get invoice total
  SELECT total_amount INTO v_invoice_amount FROM invoices WHERE id = NEW.invoice_id;
  
  -- Get total allocated for this payment
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_total_allocated
  FROM payment_allocations
  WHERE payment_id = NEW.payment_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid); -- Exclude current row for UPDATE
  
  -- Get total allocated for this invoice
  SELECT COALESCE(SUM(allocated_amount), 0) INTO v_invoice_allocated
  FROM payment_allocations
  WHERE invoice_id = NEW.invoice_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid); -- Exclude current row for UPDATE
  
  -- Check: total allocated <= payment amount
  IF v_total_allocated + NEW.allocated_amount > v_payment_amount THEN
    RAISE EXCEPTION 'Allocation exceeds payment amount: % > %', 
      v_total_allocated + NEW.allocated_amount, v_payment_amount;
  END IF;
  
  -- Check: allocated <= invoice remaining
  IF NEW.allocated_amount > (v_invoice_amount - v_invoice_allocated) THEN
    RAISE EXCEPTION 'Allocation exceeds invoice remaining amount: % > %', 
      NEW.allocated_amount, v_invoice_amount - v_invoice_allocated;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_allocation_cap_trigger ON payment_allocations;
CREATE TRIGGER check_allocation_cap_trigger
BEFORE INSERT OR UPDATE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION check_allocation_cap();

-- ✅ PATCH 8: bank statement debit/credit constraint
CREATE OR REPLACE FUNCTION check_bank_statement_line_debit_credit()
RETURNS TRIGGER AS $$
BEGIN
  -- Зөвхөн нэг тал байх ёстой
  IF NEW.debit > 0 AND NEW.credit > 0 THEN
    RAISE EXCEPTION 'Bank statement line cannot have both debit and credit';
  END IF;
  
  -- Хоёр тал тэг биш байх ёстой
  IF NEW.debit = 0 AND NEW.credit = 0 THEN
    RAISE EXCEPTION 'Bank statement line must have either debit or credit';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_bank_statement_line_debit_credit_trigger ON bank_statement_lines;
CREATE TRIGGER check_bank_statement_line_debit_credit_trigger
BEFORE INSERT OR UPDATE ON bank_statement_lines
FOR EACH ROW
EXECUTE FUNCTION check_bank_statement_line_debit_credit();

-- ✅ PATCH 9: reconciliation_matches - зөвхөн нэг FK байх ёстой
CREATE OR REPLACE FUNCTION check_reconciliation_match_one_fk()
RETURNS TRIGGER AS $$
DECLARE
  fk_count integer;
BEGIN
  fk_count := 0;
  IF NEW.invoice_id IS NOT NULL THEN fk_count := fk_count + 1; END IF;
  IF NEW.payment_id IS NOT NULL THEN fk_count := fk_count + 1; END IF;
  IF NEW.journal_line_id IS NOT NULL THEN fk_count := fk_count + 1; END IF;
  
  IF fk_count != 1 THEN
    RAISE EXCEPTION 'Reconciliation match must have exactly one FK (invoice_id, payment_id, or journal_line_id)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_reconciliation_match_one_fk_trigger ON reconciliation_matches;
CREATE TRIGGER check_reconciliation_match_one_fk_trigger
BEFORE INSERT OR UPDATE ON reconciliation_matches
FOR EACH ROW
EXECUTE FUNCTION check_reconciliation_match_one_fk();

-- ✅ PATCH 10: journal_lines constraints (non-negative, debit_or_credit)
CREATE OR REPLACE FUNCTION check_journal_line_constraints()
RETURNS TRIGGER AS $$
BEGIN
  -- Non-negative
  IF NEW.debit < 0 OR NEW.credit < 0 THEN
    RAISE EXCEPTION 'Journal line debit and credit must be non-negative';
  END IF;
  
  -- Зөвхөн нэг тал
  IF NEW.debit > 0 AND NEW.credit > 0 THEN
    RAISE EXCEPTION 'Journal line cannot have both debit and credit';
  END IF;
  
  -- Хоёр тал тэг биш
  IF NEW.debit = 0 AND NEW.credit = 0 THEN
    RAISE EXCEPTION 'Journal line must have either debit or credit';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_journal_line_constraints_trigger ON journal_lines;
CREATE TRIGGER check_journal_line_constraints_trigger
BEFORE INSERT OR UPDATE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION check_journal_line_constraints();
