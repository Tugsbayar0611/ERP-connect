# Accounting Design Review - Критик Засварууд

## 🚨 КРИТИК ЗАСВАРУУД (Буруу засаагүй бол "bug" гарна)

### A) Payment Allocations - FK засах

**❌ Буруу:**
```sql
payment_allocations (
  payment_id uuid REFERENCES invoices(id),  -- БУРУУ!
  invoice_id uuid REFERENCES invoices(id)
)
```

**✅ Зөв шийдэл:**

```sql
-- Payments тусад нь хүснэгт
payments (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  payment_number text NOT NULL,
  payment_date date NOT NULL,
  type text NOT NULL, -- 'payment' | 'receipt'
  amount numeric(14,2) NOT NULL,
  currency_code text DEFAULT 'MNT',
  bank_account_id uuid REFERENCES bank_accounts(id),
  payment_method text, -- cash, bank_transfer, qr_code
  status text DEFAULT 'draft', -- draft, posted, cancelled
  reference text,
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  posted_at timestamp,
  journal_entry_id uuid REFERENCES journal_entries(id), -- Posted payment journal
  UNIQUE(tenant_id, payment_number)
)

-- Allocations
payment_allocations (
  id uuid PRIMARY KEY,
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,  -- ✅ ЗОХ
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  allocated_amount numeric(14,2) NOT NULL,
  allocation_date date NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE(payment_id, invoice_id)
)
```

---

### B) Bank Statement Lines - Polymorphic засах

**❌ Буруу:**
```sql
reconciled_with uuid -- payment_id, invoice_id  -- БУРУУ! FK integrity эвдэнэ
```

**✅ Зөв шийдэл - Reconciliations хүснэгт:**

```sql
-- Reconciliations (Header)
reconciliations (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  statement_line_id uuid REFERENCES bank_statement_lines(id) ON DELETE CASCADE,
  status text DEFAULT 'draft', -- draft, partial, reconciled
  total_matched_amount numeric(14,2) DEFAULT 0,
  reconciled_at timestamp,
  reconciled_by uuid REFERENCES users(id),
  notes text,
  created_at timestamp DEFAULT now()
)

-- Reconciliation Matches (Split payment, partial match, multi-invoice)
reconciliation_matches (
  id uuid PRIMARY KEY,
  reconciliation_id uuid REFERENCES reconciliations(id) ON DELETE CASCADE,
  match_type text NOT NULL, -- 'invoice' | 'payment' | 'journal_line'
  match_id uuid NOT NULL,  -- invoice_id, payment_id, journal_line_id
  matched_amount numeric(14,2) NOT NULL,
  match_date date NOT NULL,
  notes text,
  created_at timestamp DEFAULT now(),
  -- Constraint: match_id нь match_type-тай тааруулах
  CHECK (
    (match_type = 'invoice' AND match_id IN (SELECT id FROM invoices)) OR
    (match_type = 'payment' AND match_id IN (SELECT id FROM payments)) OR
    (match_type = 'journal_line' AND match_id IN (SELECT id FROM journal_lines))
  )
)
```

---

### C) Posted Journal - Reversal (Rollback биш!)

**❌ Буруу:**
- "Rollback" гэдэг production дээр санхүүгийн стандарт биш
- Audit trail эвдэнэ

**✅ Зөв дүрэм:**

```sql
-- Journal Entries
journal_entries (
  id uuid PRIMARY KEY,
  ...
  status text DEFAULT 'draft', -- draft, posted, cancelled, reversed
  reversal_entry_id uuid REFERENCES journal_entries(id), -- ✅ Reversal entry
  reversed_by_entry_id uuid, -- Энэ entry-г хэн reverse хийсэн
  ...
  CONSTRAINT immutable_posted CHECK (
    status != 'posted' OR (status = 'posted' AND posted_at IS NOT NULL)
  )
)
```

**Reversal процесс:**
1. Posted journal-г засах хэрэггүй
2. Шинэ reversal entry үүсгэх
3. Бүх lines-ийг эсрэгээр (debit ↔ credit)
4. `reversal_entry_id` холбох
5. Анхны entry-д `reversed_by_entry_id` гэж тэмдэглэх

**API:**
```typescript
POST /api/v1/journal-entries/:id/reverse
Body: {
  entry_date: string,
  description: string
}
Response: {
  original_entry_id: string,
  reversal_entry_id: string,
  status: "reversed"
}
```

---

### D) Double-Entry Integrity - DB түвшинд хамгаал

**✅ Минимум хамгаалалт:**

```sql
-- Journal Lines constraint
journal_lines (
  id uuid PRIMARY KEY,
  entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id),
  debit numeric(14,2) DEFAULT 0,
  credit numeric(14,2) DEFAULT 0,
  ...
  CONSTRAINT non_negative_debit CHECK (debit >= 0),
  CONSTRAINT non_negative_credit CHECK (credit >= 0),
  CONSTRAINT debit_or_credit CHECK (debit = 0 OR credit = 0), -- Зөвхөн нэг тал
  CONSTRAINT not_both_zero CHECK (debit != 0 OR credit != 0) -- Хоёр тал тэг биш
)

-- Double-entry integrity trigger/function
CREATE OR REPLACE FUNCTION check_double_entry()
RETURNS TRIGGER AS $$
DECLARE
  total_debit numeric;
  total_credit numeric;
BEGIN
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_lines
  WHERE entry_id = NEW.entry_id;

  IF total_debit != total_credit THEN
    RAISE EXCEPTION 'Double-entry violation: Debit (%) != Credit (%)', 
      total_debit, total_credit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_double_entry_trigger
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION check_double_entry();

-- Materialized check (entry post хийхэд)
ALTER TABLE journal_entries
ADD CONSTRAINT balanced_entry CHECK (
  status != 'posted' OR (
    (SELECT COALESCE(SUM(debit), 0) FROM journal_lines WHERE entry_id = id) =
    (SELECT COALESCE(SUM(credit), 0) FROM journal_lines WHERE entry_id = id)
  )
);
```

**Posting API дээр ч шалгах:**
```typescript
async function validateDoubleEntry(entryId: string) {
  const lines = await db.select()
    .from(journalLines)
    .where(eq(journalLines.entryId, entryId));
  
  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) { // Float тэвчих
    throw new Error(`Double-entry violation: Debit ${totalDebit} != Credit ${totalCredit}`);
  }
}
```

---

### E) Numbering Sequences - Concurrency-Safe

**❌ Буруу:**
- `next_number++` → 2 хүн зэрэг үүсгэхэд duplicate дугаар

**✅ Зөв шийдэл - PostgreSQL SEQUENCE:**

```sql
-- Numbering Sequences
numbering_sequences (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  document_type text NOT NULL, -- 'sales_order', 'invoice', 'payment'
  branch_id uuid REFERENCES branches(id), -- Optional: branch-specific
  prefix text NOT NULL, -- 'SO', 'INV', 'PAY'
  format text DEFAULT '{prefix}-{year}-{number:4}', -- 'SO-2024-0001'
  next_number integer DEFAULT 1,
  year integer, -- NULL бол одоогийн жил
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, document_type, branch_id, year)
)

-- Function: Generate next number (concurrency-safe)
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
BEGIN
  -- Get or create sequence
  SELECT id, prefix, format, COALESCE(year, EXTRACT(YEAR FROM CURRENT_DATE)::integer), next_number
  INTO v_seq_id, v_prefix, v_format, v_year, v_next_number
  FROM numbering_sequences
  WHERE tenant_id = p_tenant_id
    AND document_type = p_document_type
    AND COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
        COALESCE(p_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(year, EXTRACT(YEAR FROM CURRENT_DATE)::integer) = 
        COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer)
  FOR UPDATE; -- ✅ Row-level lock (concurrency-safe)

  IF v_seq_id IS NULL THEN
    -- Create new sequence
    INSERT INTO numbering_sequences (tenant_id, document_type, branch_id, prefix, format, year, next_number)
    VALUES (p_tenant_id, p_document_type, p_branch_id, 
            UPPER(SUBSTRING(p_document_type, 1, 2)), 
            '{prefix}-{year}-{number:4}',
            COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer),
            1)
    RETURNING id, prefix, format, year, next_number
    INTO v_seq_id, v_prefix, v_format, v_year, v_next_number;
  END IF;

  -- Increment and update
  UPDATE numbering_sequences
  SET next_number = next_number + 1
  WHERE id = v_seq_id;

  -- Format number
  v_result := replace(replace(replace(v_format,
    '{prefix}', v_prefix),
    '{year}', v_year::text),
    '{number:4}', LPAD(v_next_number::text, 4, '0'));

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT get_next_number('tenant-id', 'invoice', NULL, 2024);
-- Returns: 'IN-2024-0001'
```

---

## 📋 SCHEMA ДЭЭР НЭМЭХ ЗААВЛЫН БАЙНГА

### A) Fiscal Period + Period Lock

```sql
-- Fiscal Years
fiscal_years (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  year integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'open', -- open, closed
  closed_at timestamp,
  closed_by uuid REFERENCES users(id),
  UNIQUE(tenant_id, year)
)

-- Fiscal Periods (Сар)
fiscal_periods (
  id uuid PRIMARY KEY,
  fiscal_year_id uuid REFERENCES fiscal_years(id) ON DELETE CASCADE,
  period_number integer NOT NULL, -- 1-12 (сар)
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'open', -- open, closed, locked
  locked_at timestamp,
  locked_by uuid REFERENCES users(id),
  UNIQUE(fiscal_year_id, period_number)
)

-- Period Locks
period_locks (
  id uuid PRIMARY KEY,
  period_id uuid REFERENCES fiscal_periods(id) ON DELETE CASCADE,
  lock_type text NOT NULL, -- 'posting' | 'all'
  locked_by uuid REFERENCES users(id),
  locked_at timestamp DEFAULT now(),
  notes text
)

-- Constraint: Posted entry дээр period lock шалгах
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id uuid;
  v_lock_exists boolean;
BEGIN
  IF NEW.status = 'posted' THEN
    -- Find period
    SELECT id INTO v_period_id
    FROM fiscal_periods
    WHERE start_date <= NEW.entry_date
      AND end_date >= NEW.entry_date
      AND status IN ('closed', 'locked')
    LIMIT 1;

    IF v_period_id IS NOT NULL THEN
      -- Check lock
      SELECT EXISTS(
        SELECT 1 FROM period_locks
        WHERE period_id = v_period_id
          AND lock_type IN ('posting', 'all')
      ) INTO v_lock_exists;

      IF v_lock_exists THEN
        RAISE EXCEPTION 'Period is locked for posting';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_period_lock_trigger
BEFORE UPDATE ON journal_entries
FOR EACH ROW
WHEN (NEW.status = 'posted')
EXECUTE FUNCTION check_period_lock();
```

**API:**
```typescript
POST /api/v1/fiscal-periods/:id/lock
Body: { lock_type: 'posting' | 'all', notes?: string }

POST /api/v1/fiscal-periods/:id/unlock
```

---

### B) Multi-Currency

```sql
-- Currencies (аль хэдийн байгаа)
currencies (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  code text NOT NULL, -- 'MNT', 'USD', 'CNY'
  name text NOT NULL,
  symbol text NOT NULL, -- '₮', '$', '¥'
  rate numeric(10,4) DEFAULT 1.0000, -- Base currency (MNT) дээрх ханш
  is_base boolean DEFAULT false, -- Base currency зөвхөн 1 байна
  is_active boolean DEFAULT true,
  updated_at timestamp DEFAULT now(),
  UNIQUE(tenant_id, code)
)

-- Journal Entries - Currency
journal_entries (
  ...
  currency_code text REFERENCES currencies(code), -- NULL = base currency
  exchange_rate numeric(10,4) DEFAULT 1.0000, -- Entry хийхэд ханш
  ...
)

-- Journal Lines - Multi-currency amounts
journal_lines (
  ...
  amount_currency numeric(14,2), -- Foreign currency amount
  currency_code text, -- Foreign currency
  currency_rate numeric(10,4) DEFAULT 1.0000, -- Entry хийхэд ханш
  debit numeric(14,2), -- Base currency (MNT)
  credit numeric(14,2), -- Base currency (MNT)
  ...
)
```

**Posting дүрэм:**
- GL нь зөвхөн base currency дээр (MNT)
- Foreign currency entry: `amount_currency * exchange_rate = debit/credit`
- Currency gain/loss тооцоолох (revaluation)

---

### C) Tax Source of Truth - Invoice Line дээр

**✅ Зөв бүтэц:**

```sql
-- Invoice Lines (source of truth)
invoice_lines (
  id uuid PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  ...
  tax_code_id uuid REFERENCES tax_codes(id),
  tax_base numeric(14,2) NOT NULL, -- ХХОАТ суурь
  tax_amount numeric(14,2) NOT NULL, -- ХХОАТ дүн
  ...
)

-- Tax Lines (Journal дээр - posted tax)
tax_lines (
  id uuid PRIMARY KEY,
  journal_line_id uuid REFERENCES journal_lines(id),
  tax_code_id uuid REFERENCES tax_codes(id),
  tax_base numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL,
  source_type text NOT NULL, -- 'invoice_line' | 'manual'
  source_id uuid, -- invoice_line_id
  reference text, -- invoice_number
  reference_id uuid -- invoice_id
)
```

**Posting процесс:**
1. Invoice үүсгэх: `invoice_lines` дээр tax тооцоолно
2. Posting хийх: `invoice_lines.tax_amount` → `journal_lines` + `tax_lines` үүсэнэ
3. Audit: Invoice tax = Posted tax шалгах боломжтой

---

## 🔧 POSTING ENGINE - Mapping + Templates

**✅ Зөв арга - Config-based:**

```sql
-- Posting Templates
posting_templates (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  document_type text NOT NULL, -- 'invoice', 'payment', 'expense'
  name text NOT NULL,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  template_config jsonb NOT NULL -- Template definition
)

-- Template Config JSON structure:
{
  "journal_type": "sales", // journal.code
  "lines": [
    {
      "side": "debit",
      "account_resolver": "ar_account", // customer.arAccountId
      "amount_field": "total",
      "description": "AR from invoice"
    },
    {
      "side": "credit",
      "account_resolver": "revenue_account", // product.category.revenueAccountId
      "amount_field": "subtotal",
      "description": "Revenue"
    },
    {
      "side": "credit",
      "account_resolver": "tax_payable_account", // tax_code.taxAccountId
      "amount_field": "tax_amount",
      "description": "VAT Payable",
      "create_tax_line": true
    }
  ]
}

-- Account Resolvers (Config)
account_resolvers (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  resolver_key text NOT NULL, -- 'ar_account', 'revenue_account'
  resolver_type text NOT NULL, -- 'field', 'lookup', 'default'
  config jsonb NOT NULL,
  UNIQUE(tenant_id, resolver_key)
)
```

**Account Resolver жишээ:**
```json
{
  "resolver_key": "ar_account",
  "resolver_type": "field",
  "config": {
    "source": "contact",
    "field": "arAccountId",
    "fallback": "default_ar_account_id"
  }
}

{
  "resolver_key": "revenue_account",
  "resolver_type": "lookup",
  "config": {
    "source": "product.category",
    "field": "revenueAccountId",
    "fallback": "default_revenue_account_id"
  }
}
```

**Posting API:**
```typescript
// 1. Preview posting
POST /api/v1/posting/preview
Body: {
  document_type: "invoice",
  document_id: "invoice-id",
  template_id?: "template-id" // Optional: override template
}
Response: {
  journal_entry: {
    lines: [
      { account: "1100", debit: 100000, credit: 0, description: "AR" },
      { account: "4000", debit: 0, credit: 90909, description: "Revenue" },
      { account: "2100", debit: 0, credit: 9091, description: "VAT Payable" }
    ]
  }
}

// 2. Post
POST /api/v1/posting/post
Body: {
  document_type: "invoice",
  document_id: "invoice-id",
  entry_date?: "2024-01-15", // Optional: override
  template_id?: "template-id" // Optional: override
}
```

---

## 🔐 WORKFLOW/RBAC САЙЖРУУЛАЛТ

### A) RBAC - Resource Scope

```sql
permissions (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  resource text NOT NULL, -- 'sales_order', 'invoice'
  action text NOT NULL, -- 'create', 'view', 'edit', 'delete', 'approve'
  resource_scope text DEFAULT 'all', -- 'tenant' | 'branch' | 'own' | 'all'
  description text,
  UNIQUE(tenant_id, resource, action, resource_scope)
)
```

**Resource Scope:**
- `tenant`: Бүх tenant дээр эрхтэй
- `branch`: Зөвхөн өөрийн branch дээр
- `own`: Зөвхөн өөрийн баримт
- `all`: Бүх баримт

**UI дээр эрх дутуу харуулах:**
```typescript
// Hook: Check permission
const { hasPermission, missingPermission } = usePermission('invoice', 'create');

if (!hasPermission) {
  return (
    <Tooltip>
      <p>Энэ үйлдлийг хийх эрхгүй байна</p>
      <p>Хэрэгтэй эрх: {missingPermission}</p>
    </Tooltip>
  );
}
```

---

### B) Workflow - Condition JSONB

**❌ Буруу:**
```sql
approval_rules (
  condition text -- "amount > 1000000" -- String нь аюултай!
)
```

**✅ Зөв:**
```sql
approval_rules (
  id uuid PRIMARY KEY,
  workflow_id uuid REFERENCES workflows(id),
  step_id uuid REFERENCES workflow_steps(id),
  condition jsonb NOT NULL, -- Structured condition
  approver_role_id uuid REFERENCES roles(id),
  approver_user_id uuid REFERENCES users(id), -- Optional: specific user
  order integer NOT NULL
)

-- Condition JSON structure:
{
  "field": "total_amount",
  "operator": ">",
  "value": 1000000
}

-- Complex condition:
{
  "logic": "AND",
  "conditions": [
    { "field": "total_amount", "operator": ">", "value": 1000000 },
    { "field": "branch_id", "operator": "equals", "value": "branch-id" }
  ]
}

-- Operators: "equals", ">", ">=", "<", "<=", "in", "contains", "startsWith"
```

**Condition evaluator:**
```typescript
function evaluateCondition(document: any, condition: any): boolean {
  if (condition.logic) {
    // AND/OR logic
    const results = condition.conditions.map(c => evaluateCondition(document, c));
    return condition.logic === 'AND' 
      ? results.every(r => r)
      : results.some(r => r);
  }
  
  const fieldValue = getNestedField(document, condition.field);
  const { operator, value } = condition;
  
  switch (operator) {
    case 'equals': return fieldValue === value;
    case '>': return Number(fieldValue) > Number(value);
    case '>=': return Number(fieldValue) >= Number(value);
    case '<': return Number(fieldValue) < Number(value);
    case '<=': return Number(fieldValue) <= Number(value);
    case 'in': return Array.isArray(value) && value.includes(fieldValue);
    case 'contains': return String(fieldValue).includes(String(value));
    case 'startsWith': return String(fieldValue).startsWith(String(value));
    default: return false;
  }
}
```

---

## 📅 MVP SPRINT-ЭЭР ЗАДЛАХ

### Sprint 1: Platform Hardening (2-3 долоо хоног)
**Deliverables:**
- ✅ RBAC/ACL (resource_scope хамт)
- ✅ Numbering Sequences (concurrency-safe)
- ✅ Attachments
- ✅ Audit Log (immutable)
- ✅ Basic Workflow (JSONB conditions)

**Acceptance:**
- Хэрэглэгч эрхээр системд нэвтрэх
- Баримтын дугаар давхарддаггүй
- Бүх өөрчлөлт audit log-д бүртгэгдэнэ

---

### Sprint 2: Accounting Engine + Posting API (2-3 долоо хоног)
**Deliverables:**
- ✅ Chart of Accounts (COA)
- ✅ Journals
- ✅ Journal Entries/Lines
- ✅ Double-entry integrity (DB constraint)
- ✅ Posting Preview API
- ✅ Posting API
- ✅ Reversal API
- ✅ Fiscal Periods + Period Lock

**Acceptance:**
- Invoice үүсгэхэд journal preview харагдана
- Post хийхэд double-entry validation ажиллана
- Posted journal reversal хийж чадна
- Locked period дээр posting хийхэд хориглодог

---

### Sprint 3: AR/AP + Bank + VAT + Reports (3 долоо хоног)
**Deliverables:**
- ✅ Payments хүснэгт + Payment Allocations
- ✅ Invoice → Journal posting (template-based)
- ✅ Payment → AR/AP allocation
- ✅ Bank Statements import
- ✅ Reconciliation (matches хамт)
- ✅ VAT Report generate
- ✅ Core Reports (Trial Balance, Balance Sheet, P&L)

**Acceptance:**
- Invoice posted бол AR journal үүснэ
- Payment хийвэл AR/AP автомат хаагддаг
- Bank statement импорт → reconciliation хийж чадна
- VAT тайлан = Journal tax_lines 100% таардаг
- 3 core тайлан зөв тооцоолно

---

## 📋 CLOSE/CANCEL/REVERSE POLICY

**Энэ бодлого байхгүй бол production дээр "өгөгдөл зөрдөг"!**

```sql
-- Document Policy Table
document_policies (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  document_type text NOT NULL, -- 'invoice', 'sales_order', 'payment'
  policy_config jsonb NOT NULL
)

-- Policy Config JSON:
{
  "delete": {
    "allowed": true,
    "only_status": ["draft"],
    "cascade": false // Cascade delete related records?
  },
  "edit": {
    "allowed": true,
    "only_status": ["draft", "submitted"],
    "not_allowed_status": ["posted", "cancelled"]
  },
  "cancel": {
    "allowed": true,
    "allowed_status": ["draft", "submitted", "approved"],
    "create_reversal": false // Accounting reversal хийх эсэх?
  },
  "reverse": {
    "allowed": true,
    "only_status": ["posted"],
    "auto_reverse_related": true, // Холбоотой баримтуудыг автомат reverse
    "reverse_inventory": true // Inventory хөдөлгөөн reverse хийх эсэх?
  },
  "close": {
    "allowed": true,
    "only_status": ["posted"],
    "final_status": "closed"
  }
}
```

**Policy Checker:**
```typescript
async function checkDocumentPolicy(
  documentType: string,
  action: 'delete' | 'edit' | 'cancel' | 'reverse' | 'close',
  document: { status: string, [key: string]: any }
): Promise<{ allowed: boolean, reason?: string }> {
  const policy = await getDocumentPolicy(documentType);
  const actionPolicy = policy[action];
  
  if (!actionPolicy.allowed) {
    return { allowed: false, reason: `${action} is not allowed for ${documentType}` };
  }
  
  // Status check
  if (actionPolicy.only_status && !actionPolicy.only_status.includes(document.status)) {
    return { 
      allowed: false, 
      reason: `Can only ${action} when status is ${actionPolicy.only_status.join(' or ')}` 
    };
  }
  
  if (actionPolicy.not_allowed_status?.includes(document.status)) {
    return { 
      allowed: false, 
      reason: `Cannot ${action} when status is ${document.status}` 
    };
  }
  
  return { allowed: true };
}
```

**Inventory Cancel дээр Accounting:**
```typescript
// Inventory movement cancel → Auto reversal
async function cancelInventoryMovement(movementId: string) {
  const movement = await getStockMovement(movementId);
  const policy = await getDocumentPolicy('stock_movement', 'cancel');
  
  // Cancel movement
  await updateStockMovement(movementId, { status: 'cancelled' });
  
  // Reverse inventory
  await updateStock(movement.warehouseId, movement.productId, 
    -movement.quantity, 'adjustment', 'Cancelled movement');
  
  // Auto reverse accounting if policy allows
  if (policy.reverse_inventory && movement.journalEntryId) {
    await reverseJournalEntry(movement.journalEntryId, 
      `Auto-reversed for cancelled inventory movement ${movement.reference}`);
  }
}
```

---

## ✅ ACCEPTANCE CRITERIA (Шинэчлэгдсэн)

### Accounting/Tax MVP дууссан гэж хэлэх minimum:

1. ✅ **Invoice үүсгэхэд double-entry journal автоматаар үүсдэг**
   - Posting template ашиглана
   - Double-entry integrity DB constraint-аар баталгаажсан
   - AR Account (Dr) = Invoice total
   - Revenue Account (Cr) = Invoice subtotal
   - VAT Payable Account (Cr) = VAT amount

2. ✅ **Payment хийвэл AR/AP автомат хаагддаг**
   - Payment allocations автомат үүснэ
   - AR/AP баланс шинэчлэгдэнэ
   - FK integrity хадгалагдана

3. ✅ **Bank statement импорт → reconciliation хийж чаддаг**
   - Excel/CSV импорт
   - Reconciliation matches (split payment, multi-invoice)
   - Manual reconciliation

4. ✅ **VAT тайлангийн үндсэн дүн journal/tax_lines-тай 100% таардаг**
   - Tax source of truth = invoice_lines
   - Posted tax = tax_lines
   - VAT report = tax_lines aggregate 100% таардаг

5. ✅ **Posted journal reversal хийж чаддаг**
   - Posted journal засахгүй
   - Reversal entry үүсгэнэ
   - Audit trail хадгалагдана

6. ✅ **Period lock ажилладаг**
   - Closed/locked period дээр posting хийхэд хориглодог
   - Constraint/trigger ашиглана

7. ✅ **Numbering sequences concurrency-safe**
   - 2 хүн зэрэг үүсгэхэд duplicate дугаар гарахгүй
   - SELECT FOR UPDATE эсвэл SEQUENCE

8. ✅ **Document policy хэрэгжинэ**
   - Delete зөвхөн draft дээр
   - Posted документ засахгүй (reversal)
   - Inventory cancel → accounting auto-reverse
