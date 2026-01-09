# Монголын ERP системд нэмж болох модулууд (Шинэчлэгдсэн)

## 🎯 Одоогийн байдал
✅ Байгаа модулууд:
- HR (Ажилтнууд, Цалин, Ирц)
- Бараа, Харилцагчид (CRM)
- Борлуулалт, Худалдан авалт
- Агуулах, Нэхэмжлэх

---

## 🏗️ PLATFORM МОДУЛУУД (Эхнээс нь заавал хэрэгтэй)

### ⚙️ Platform модулиудгүйгээр том ERP "том" харагддаггүй

Эдгээр нь модуль биш, **платформ** бөгөөд эхнээс нь зөв суулгахад дараагийн 10 модуль чинь хурдан нэмэгддэг.

---

### A. Settings & Master Data (Тохиргоо ба Үндсэн Өгөгдөл)
**Онцлог:**
- Company / Branch / Warehouse бүтэц (✅ аль хэдийн байна)
- **UoM (Unit of Measure)** - Нэгж хэмжээ (ш, кг, л, м²)
- **Currency** - Валют (₮, $, €, ¥)
- **Tax codes & Tax rates** - Татварын код, хувь (НӨАТ 10%, ОАТ)
- **Payment terms** - Төлбөрийн нөхцөл (30 хоног, 60 хоног)
- **Numbering sequences** - Баримтын дугаарлалт (SO-2024-001, INV-2024-001)

**Database:**
```sql
uom (unit, name, symbol)
currencies (code, name, symbol, rate)
tax_codes (code, name, rate, type)
payment_terms (days, name, description)
numbering_sequences (prefix, next_number, format)
```

---

### B. RBAC + ACL (Эрхийн систем)
**Онцлог:**
- **Role-based permissions** - Рольд эрх өгөх
- **Branch/Company level access** - Салбар/Компани түвшний эрх
- **Document-level access** - Баримтын түвшний эрх (өөрийн/бусдын баримт)
- **Field-level permissions** - Талбарын түвшний эрх

**Database:**
```sql
roles (name, description)
permissions (resource, action) -- sales_order.create, invoice.view
role_permissions (role_id, permission_id)
user_roles (user_id, role_id)
branch_permissions (user_id, branch_id, permissions)
```

**Үйлдлүүд:**
- Sales Order үүсгэх
- Invoice төлөх
- Цалин засах
- Баланс харах

---

### C. Workflow Engine (Батлах урсгал)
**Онцлог:**
- **Document workflow** - Баримтын workflow
- **Approval matrix** - Батлах матриц (дүн/төрөл/салбараар батлах)
- **Status transitions** - Статусын шилжилт
- **Auto-approval rules** - Автомат батлалт

**Workflow жишээ:**
```
Draft → Submitted → Approved → Posted → Reversed
```

**Database:**
```sql
workflows (name, model_type) -- sales_order, invoice, expense
workflow_steps (workflow_id, step_name, order, required_approval)
approval_rules (workflow_id, step_id, condition, approver_role)
workflow_instances (workflow_id, document_id, current_step, status)
approval_history (instance_id, user_id, step, action, timestamp)
```

**Жишээ:**
- Invoice > 1,000,000₮ → Дэд захирал батлах
- Expense > 500,000₮ → Менеджер батлах
- Sales Order → Автомат баталгаажуулах

---

### D. Audit Log + Change History (Хяналтын бүртгэл)
**Онцлог:**
- **Хэн, хэзээ, юу өөрчилсөн** - Бүх өөрчлөлт бүртгэх
- **Санхүү дээр заавал** - Санхүүгийн өөрчлөлт заавал бүртгэх
- **Rollback** - Өмнөх байдалд буцаах
- **History view** - Түүх харах

**Database:**
```sql
audit_logs (
  id, model_type, model_id, 
  user_id, action, field_name, 
  old_value, new_value, timestamp, ip_address
)
```

**Талбарууд:**
- model_type: 'sales_order', 'invoice', 'account'
- action: 'create', 'update', 'delete', 'post'
- field_name: 'total_amount', 'status'
- old_value, new_value: JSON

---

### E. Attachments + Document Management (Хавсралт)
**Онцлог:**
- **Баримт хавсаргах** - PDF, зураг, акт
- **Version/history** - Хувилбарын түүх
- **File storage** - Файл хадгалах (S3, local)
- **Preview** - Файлын урьдчилсан харах

**Database:**
```sql
attachments (
  id, model_type, model_id,
  file_name, file_path, file_type, file_size,
  uploaded_by, uploaded_at, version
)
```

**Жишээ:**
- Invoice-д баримт хавсаргах (PDF)
- Expense-д баримт бичгийн зураг
- Product-д зураг

---

### F. Import/Export + Data Migration Tools
**Онцлог:**
- **Excel import template manager** - Excel импорт загвар удирдлага
- **Mass update tools** - Олон баримт нэгэн зэрэг засах
- **Export templates** - Excel экспорт загвар
- **Data validation** - Өгөгдөл шалгах

**Database:**
```sql
import_templates (name, model_type, fields, validation_rules)
import_jobs (template_id, file_path, status, progress, errors)
export_templates (name, model_type, fields, format)
```

**Функцууд:**
- Бараа масс импорт (Excel)
- Харилцагч импорт
- Банкны хуулга импорт
- Татварын тайлан экспорт

---

## 💰 CORE FINANCE PACK (Санхүүгийн модуль - НЭГ ENGINE)

### ⚠️ ЧУХАЛ: Accounting, Tax, Reports гурав нэг хөдөлгүүр дээр сууна

**✅ Зөв бүтэц:**
```
Accounting = үндсэн GL/Journal/Posting engine
    ↓
Tax = Accounting дээр "tax rules + forms + export" давхарга
    ↓
Reports = бүх модуль дээр ажиллах "report engine"
```

**❌ Буруу бүтэц:**
- Accounting, Tax, Reports тусдаа модуль → өгөгдөл давтах, зөрүү гарах

---

### 1. Accounting Engine (GL + Journal + Posting)

**Database Schema:**
```sql
-- Chart of Accounts (Дансны төлөвлөлт)
accounts (
  id, tenant_id, code, name, type, -- asset, liability, equity, income, expense
  parent_id, level, is_active
)

-- Journals (Журнал)
journals (
  id, tenant_id, name, code, type, -- sales, purchase, bank, cash, general
  default_debit_account_id, default_credit_account_id
)

-- Journal Entries (Журналын бичилт)
journal_entries (
  id, tenant_id, journal_id, entry_number,
  entry_date, description, reference,
  status, -- draft, posted, cancelled
  posted_by, posted_at, created_by
)

-- Journal Lines (Журналын мөр)
journal_lines (
  id, entry_id, account_id,
  debit, credit,
  partner_id, -- customer/supplier
  description, reference
)

-- Tax Codes & Rates
tax_codes (
  id, tenant_id, code, name, rate, type, -- vat, income_tax
  tax_account_id, -- ХХОАТ данс
  is_active
)

-- Tax Lines (Journal lines дээр)
tax_lines (
  id, journal_line_id, tax_code_id,
  tax_base, tax_amount, -- ХХОАТ суурь, ХХОАТ дүн
  reference -- invoice_id, etc.
)
```

**Posting Rules (Журнал үүсгэх дүрэм):**
```typescript
// Invoice үүсгэхэд автоматаар journal үүсэх
Invoice → Journal Entry:
  - AR Account (Dr) ← Invoice total
  - Revenue Account (Cr) ← Invoice subtotal
  - VAT Payable Account (Cr) ← VAT amount

// Payment хийхэд
Payment → Journal Entry:
  - Cash/Bank Account (Dr)
  - AR Account (Cr)
```

**API:**
```typescript
POST /api/posting/preview
  // Баримт posted болохоос өмнө ямар journal үүсэхийг харах

POST /api/posting/post
  // Posting хийх

GET /api/accounts
POST /api/journal-entries
GET /api/journal-entries/:id
```

---

### 2. AR/AP (Авлага/Өглөг)

**Database:**
```sql
-- AR/AP нь Invoice + Payment-ээр удирдагдана
-- (аль хэдийн байгаа invoices хүснэгт дээр AR/AP тооцоолно)

-- Payment Allocations
payment_allocations (
  id, payment_id, invoice_id,
  allocated_amount, allocation_date
)
```

**Автомат AR/AP хаах:**
- Invoice үүсгэх → AR нэмэгдэнэ
- Payment хийх → AR буурна
- Invoice-д төлбөр төлөх → Автомат allocation

---

### 3. Cash/Bank + Reconciliation

**Database:**
```sql
-- Bank Accounts
bank_accounts (
  id, tenant_id, account_number, bank_name,
  currency, balance, is_active
)

-- Bank Statements
bank_statements (
  id, tenant_id, bank_account_id,
  statement_date, opening_balance, closing_balance,
  imported_at, imported_by
)

-- Bank Statement Lines
bank_statement_lines (
  id, statement_id, date, description,
  debit, credit, balance,
  reference, -- transaction reference
  reconciled, reconciled_with -- payment_id, invoice_id
)

-- Reconciliations
reconciliations (
  id, statement_line_id,
  payment_id, invoice_id,
  matched_amount, reconciled_at, reconciled_by
)
```

**Workflow:**
1. Bank statement импорт (Excel/CSV)
2. Statement lines автомат тааруулах (payment, invoice-тай)
3. Manual reconciliation
4. Journal автомат үүсэх

---

### 4. Tax Layer (Tатварын давхарга)

**Онцлог:**
- **Accounting дээр суурилна** - Tax lines journal дээр
- **VAT forms/export** - НӨАТ-ын тайлан, экспорт
- **Tax reports** - Татварын тайлангууд

**Database:**
```sql
-- Tax тайлан
tax_reports (
  id, tenant_id, report_type, -- vat, income_tax
  period_start, period_end,
  total_sales, total_purchases,
  vat_payable, vat_receivable,
  net_vat, status
)

-- Tax Report Lines
tax_report_lines (
  id, report_id, invoice_id, journal_line_id,
  tax_code_id, base_amount, tax_amount
)
```

**API:**
```typescript
POST /api/tax-reports/generate
  // НӨАТ-ын тайлан үүсгэх (period_start, period_end)

GET /api/tax-reports/:id
  // Татварын тайлан харах

POST /api/tax-reports/:id/export
  // Excel/PDF экспорт
```

---

### 5. Core Reports (Тайлангийн хөдөлгүүр)

**Report Engine:**
- Бүх модуль дээр ажиллана
- Accounting дээр суурилна
- Real-time data

**Тайлангууд:**
1. **Баланс (Balance Sheet)**
   - Assets = Liabilities + Equity
   - Accounts-аас тооцоолно

2. **Орлогын тайлан (Income Statement/P&L)**
   - Revenue - Expenses = Net Income
   - Income/Expense accounts-аас

3. **Trial Balance (Тэнцвэр)**
   - Бүх accounts-ын debit/credit тэнцвэр

4. **Aging Report (Хугацаа өнгөрсөн)**
   - AR/AP-ийн хугацаа өнгөрсөн дүн

5. **Cash Flow (Мөнгөний урсгал)**
   - Орлого, зарлага, үлдэгдэл

**API:**
```typescript
GET /api/reports/balance-sheet
GET /api/reports/income-statement
GET /api/reports/trial-balance
GET /api/reports/aging?type=ar|ap
GET /api/reports/cash-flow
```

---

## 📦 OPERATIONS PACK (Үйл ажиллагаа)

### 1. Delivery Note (Хүргэлтийн баримт) ✅
**Workflow:**
```
Sales Order → Delivery Note → Stock Out
```

**Database:**
```sql
delivery_notes (
  id, tenant_id, sales_order_id, delivery_number,
  delivery_date, warehouse_id, status,
  delivered_by, received_by
)

delivery_note_lines (
  id, delivery_note_id, product_id,
  quantity, delivered_quantity
)
```

---

### 2. Returns & Refunds ✅
**Database:**
```sql
returns (
  id, tenant_id, sales_order_id, invoice_id,
  return_number, return_date, reason,
  status, refund_amount
)

return_lines (
  id, return_id, product_id,
  quantity, refund_price
)
```

---

### 3. Quotations (Үнэлгээ) ✅
**Workflow:**
```
Quotation → Sales Order
```

**Database:**
```sql
quotations (
  id, tenant_id, customer_id, quote_number,
  quote_date, valid_until, status,
  converted_to_order_id
)

quotation_lines (
  id, quotation_id, product_id,
  quantity, unit_price, discount
)
```

---

### 4. Inventory Valuation + COGS
**Онцлог:**
- Барааны өртөг тооцоолох (FIFO, Average Cost)
- COGS (Cost of Goods Sold) тооцоолох
- **Санхүүтэй холбох** - Journal автомат үүсэх

**Database:**
```sql
-- Valuation Layers (Өртгийн давхарга)
valuation_layers (
  id, product_id, warehouse_id,
  quantity, cost, date, reference -- purchase_order_id
)

-- COGS Calculation
cogs_entries (
  id, sale_id, product_id,
  cost, quantity, total_cost
)
```

**Posting:**
```
Sale → Journal Entry:
  - COGS Account (Dr)
  - Inventory Account (Cr)
```

---

## 👥 PEOPLE & EXPENSE PACK

### 1. Expense Management + Petty Cash
**Workflow:**
```
Draft → Submitted → Approved → Posted
```

**Database:**
```sql
expenses (
  id, tenant_id, employee_id, expense_number,
  expense_date, category, amount,
  status, approved_by, posted, journal_entry_id
)

expense_lines (
  id, expense_id, description,
  amount, receipt_attachment_id
)

petty_cash (
  id, tenant_id, cashier_id,
  opening_balance, closing_balance,
  date, status
)

petty_cash_transactions (
  id, petty_cash_id, expense_id,
  amount, type, -- income, expense
  description
)
```

---

### 2. Payroll Posting → GL
**Онцлог:**
- Цалин бодоод дуусах биш
- **Санхүү рүү автоматаар журнал үүсэх**

**Posting:**
```typescript
Payroll Run → Journal Entry:
  - Salary Expense (Dr)
  - SHI Payable (Cr) -- 11.5%
  - PIT Payable (Cr) -- 10%
  - Cash/Bank (Cr) -- Net salary
```

---

## 🏢 LONG-TERM / ENTERPRISE PACK

### 1. Asset Management
**Онцлог:**
- Элэгдэл → Journal автомат үүсэх

**Posting:**
```
Depreciation → Journal Entry:
  - Depreciation Expense (Dr)
  - Accumulated Depreciation (Cr)
```

---

### 2. Budget Management
**Онцлог:**
- Budget vs Actual харьцуулалт
- Variance analysis

---

### 3. Project Management
**Онцлог:**
- Project P&L
- Project costs → Journal

---

### 4. Notifications (SMS/Email)
**Онцлог:**
- SMS илгээх (Mongolian SMS Gateway)
- Email илгээх
- Автомат мэдэгдэл

---

### 5. E-Signature
**Онцлог:**
- Цахим гарын үсэг зурах
- Гарын үсгийн баталгаа

---

### 6. Multi-language
**Онцлог:**
- Монгол, Англи, Орос хэл

---

## 🎯 PRIORITY (Шинэчлэгдсэн)

### Phase 0: Product Hardening (Заавал)
✅ **Эхнээс нь хийх:**
1. RBAC/ACL - Эрхийн систем
2. Workflow Engine - Батлах урсгал
3. Audit Log - Хяналтын бүртгэл
4. Attachments - Хавсралт
5. Numbering Sequences - Дугаарлалт
6. Import/Export - Өгөгдөл импорт/экспорт
7. Backup/Restore - Нөөцлөх
8. Activity Log - Үйл ажиллагааны бүртгэл

**Яагаад заавал:**
- Эдгээргүйгээр customization дандаа болоод дуусдаг
- Дараагийн модулууд эхнээс нь зөв сууж чадна

---

### Phase 1: "Зарагдах MVP" (Хамгийн эхлээд)
✅ **Accounting төвтэй MVP:**

1. **Accounting Engine**
   - GL + Journal + Posting rules
   - Chart of Accounts
   - Journal entries автомат үүсэх

2. **AR/AP + Invoice/Payment**
   - Invoice → AR journal автомат
   - Payment → AR хаах автомат

3. **Bank + Reconciliation**
   - Bank statement импорт
   - Автомат reconciliation

4. **Tax Layer**
   - VAT forms/export
   - НӨАТ-ын тайлан

5. **Delivery Note + Returns**
   - Ops талдаа хамгийн их хэрэглэгдэнэ

**Acceptance Criteria:**
- ✅ Invoice үүсгэхэд double-entry journal автоматаар үүсдэг
- ✅ Payment хийвэл AR/AP автомат хаагддаг
- ✅ Bank statement импорт → reconciliation хийж чаддаг
- ✅ VAT тайлангийн үндсэн дүн journal/tax_lines-тай 100% таардаг

---

### Phase 2: "Өрсөлдөх давуу тал"
1. QR Payment + Bank API (боломжтой бол)
2. Expense + Petty Cash (workflow-тэй)
3. Advanced Reporting
   - Drilldown
   - Pivot tables
   - Scheduled reports

---

### Phase 3: "Enterprise"
1. Assets (элэгдэл)
2. Budget (төсөв)
3. Projects (төсөл)
4. E-sign (цахим гарын үсэг)
5. Multi-language (олон хэл)

---

## 🗄️ DATABASE SCHEMA (Accounting төвтэй - Шинэчлэгдсэн)

> ⚠️ **Критик засварууд:** Дэлгэрэнгүй `ACCOUNTING_DESIGN_REVIEW.md` файлд байна

### Core Accounting Tables
```sql
-- Chart of Accounts
accounts (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  code text NOT NULL, -- "1000", "1100", "4000"
  name text NOT NULL,
  type text NOT NULL, -- asset, liability, equity, income, expense
  parent_id uuid REFERENCES accounts(id),
  level integer NOT NULL,
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, code)
);

-- Journals
journals (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  name text NOT NULL, -- "Sales Journal", "Purchase Journal"
  code text NOT NULL,
  type text NOT NULL, -- sales, purchase, bank, cash, general
  default_debit_account_id uuid REFERENCES accounts(id),
  default_credit_account_id uuid REFERENCES accounts(id),
  is_active boolean DEFAULT true
);

-- Journal Entries (✅ Reversal хамт)
journal_entries (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  journal_id uuid REFERENCES journals(id),
  entry_number text NOT NULL, -- "JE-2024-001"
  entry_date date NOT NULL,
  description text,
  reference text, -- invoice_number, payment_number
  status text DEFAULT 'draft', -- draft, posted, cancelled, reversed
  posted_by uuid REFERENCES users(id),
  posted_at timestamp,
  reversal_entry_id uuid REFERENCES journal_entries(id), -- ✅ Reversal entry
  reversed_by_entry_id uuid, -- Энэ entry-г хэн reverse хийсэн
  currency_code text REFERENCES currencies(code), -- ✅ Multi-currency
  exchange_rate numeric(10,4) DEFAULT 1.0000,
  fiscal_period_id uuid REFERENCES fiscal_periods(id), -- ✅ Fiscal period
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  UNIQUE(tenant_id, entry_number),
  CONSTRAINT immutable_posted CHECK (
    status != 'posted' OR (status = 'posted' AND posted_at IS NOT NULL)
  )
);

-- Journal Lines (✅ Double-entry integrity constraints)
journal_lines (
  id uuid PRIMARY KEY,
  entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id),
  debit numeric(14,2) DEFAULT 0,
  credit numeric(14,2) DEFAULT 0,
  amount_currency numeric(14,2), -- ✅ Foreign currency amount
  currency_code text, -- ✅ Foreign currency
  currency_rate numeric(10,4) DEFAULT 1.0000,
  partner_id uuid REFERENCES contacts(id), -- customer/supplier
  description text,
  reference text,
  CONSTRAINT non_negative_debit CHECK (debit >= 0),
  CONSTRAINT non_negative_credit CHECK (credit >= 0),
  CONSTRAINT debit_or_credit CHECK (debit = 0 OR credit = 0), -- Зөвхөн нэг тал
  CONSTRAINT not_both_zero CHECK (debit != 0 OR credit != 0) -- Хоёр тал тэг биш
);

-- ✅ Double-entry integrity trigger (DB түвшинд)
-- Дэлгэрэнгүй: ACCOUNTING_DESIGN_REVIEW.md

-- Tax Codes
tax_codes (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  code text NOT NULL, -- "VAT10", "VAT0"
  name text NOT NULL,
  rate numeric(5,2) NOT NULL, -- 10.00, 0.00
  type text NOT NULL, -- vat, income_tax
  tax_account_id uuid REFERENCES accounts(id), -- ХХОАТ төлөх данс
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, code)
);

-- Tax Lines (✅ Source of truth хамт)
tax_lines (
  id uuid PRIMARY KEY,
  journal_line_id uuid REFERENCES journal_lines(id),
  tax_code_id uuid REFERENCES tax_codes(id),
  tax_base numeric(14,2) NOT NULL, -- ХХОАТ суурь
  tax_amount numeric(14,2) NOT NULL, -- ХХОАТ дүн
  source_type text NOT NULL, -- 'invoice_line' | 'manual' ✅
  source_id uuid, -- invoice_line_id ✅
  reference text, -- invoice_number
  reference_id uuid -- invoice_id
);
```

### Payments (✅ Тусад нь хүснэгт)
```sql
-- Payments (✅ Тусад нь хүснэгт)
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
);

-- Payment Allocations (✅ FK засагдсан)
payment_allocations (
  id uuid PRIMARY KEY,
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE, -- ✅ ЗОХ
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  allocated_amount numeric(14,2) NOT NULL,
  allocation_date date NOT NULL,
  created_at timestamp DEFAULT now(),
  UNIQUE(payment_id, invoice_id)
);
```

### Bank Reconciliation (✅ Polymorphic шийдэл)
```sql
-- Bank Statements
bank_statements (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  bank_account_id uuid REFERENCES bank_accounts(id),
  statement_date date NOT NULL,
  opening_balance numeric(14,2) NOT NULL,
  closing_balance numeric(14,2) NOT NULL,
  imported_at timestamp DEFAULT now(),
  imported_by uuid REFERENCES users(id)
);

-- Bank Statement Lines
bank_statement_lines (
  id uuid PRIMARY KEY,
  statement_id uuid REFERENCES bank_statements(id) ON DELETE CASCADE,
  date date NOT NULL,
  description text,
  debit numeric(14,2) DEFAULT 0,
  credit numeric(14,2) DEFAULT 0,
  balance numeric(14,2) NOT NULL,
  reference text,
  reconciled boolean DEFAULT false
);

-- Reconciliations (✅ Header)
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
);

-- Reconciliation Matches (✅ Split payment, partial match, multi-invoice)
reconciliation_matches (
  id uuid PRIMARY KEY,
  reconciliation_id uuid REFERENCES reconciliations(id) ON DELETE CASCADE,
  match_type text NOT NULL, -- 'invoice' | 'payment' | 'journal_line'
  match_id uuid NOT NULL,
  matched_amount numeric(14,2) NOT NULL,
  match_date date NOT NULL,
  notes text,
  created_at timestamp DEFAULT now()
);
```

### Fiscal Periods + Period Lock (✅ Нэмсэн)
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
);

-- Fiscal Periods (Сар)
fiscal_periods (
  id uuid PRIMARY KEY,
  fiscal_year_id uuid REFERENCES fiscal_years(id) ON DELETE CASCADE,
  period_number integer NOT NULL, -- 1-12
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'open', -- open, closed, locked
  locked_at timestamp,
  locked_by uuid REFERENCES users(id),
  UNIQUE(fiscal_year_id, period_number)
);

-- Period Locks
period_locks (
  id uuid PRIMARY KEY,
  period_id uuid REFERENCES fiscal_periods(id) ON DELETE CASCADE,
  lock_type text NOT NULL, -- 'posting' | 'all'
  locked_by uuid REFERENCES users(id),
  locked_at timestamp DEFAULT now(),
  notes text
);
```

### Numbering Sequences (✅ Concurrency-Safe)
```sql
-- Numbering Sequences
numbering_sequences (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  document_type text NOT NULL, -- 'sales_order', 'invoice', 'payment'
  branch_id uuid REFERENCES branches(id), -- Optional: branch-specific
  prefix text NOT NULL, -- 'SO', 'INV', 'PAY'
  format text DEFAULT '{prefix}-{year}-{number:4}',
  next_number integer DEFAULT 1,
  year integer, -- NULL бол одоогийн жил
  is_active boolean DEFAULT true,
  UNIQUE(tenant_id, document_type, branch_id, year)
);

-- ✅ Function: get_next_number() - SELECT FOR UPDATE
-- Дэлгэрэнгүй: ACCOUNTING_DESIGN_REVIEW.md
```

### Posting Templates (✅ Config-based)
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
);

-- Account Resolvers
account_resolvers (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  resolver_key text NOT NULL, -- 'ar_account', 'revenue_account'
  resolver_type text NOT NULL, -- 'field', 'lookup', 'default'
  config jsonb NOT NULL,
  UNIQUE(tenant_id, resolver_key)
);
```

### Document Policies (✅ Close/Cancel/Reverse)
```sql
-- Document Policies
document_policies (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  document_type text NOT NULL, -- 'invoice', 'sales_order', 'payment'
  policy_config jsonb NOT NULL
);

-- Policy Config JSON structure: ACCOUNTING_DESIGN_REVIEW.md
```

### Invoice Lines (✅ Tax Source of Truth)
```sql
-- Invoice Lines (Tax source of truth)
invoice_lines (
  id uuid PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  tax_code_id uuid REFERENCES tax_codes(id), -- ✅ Tax source
  tax_base numeric(14,2) NOT NULL, -- ✅ ХХОАТ суурь
  tax_amount numeric(14,2) NOT NULL, -- ✅ ХХОАТ дүн
  subtotal numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL
);
```

### Bank Accounts
```sql
-- Bank Accounts
bank_accounts (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  account_number text NOT NULL,
  bank_name text NOT NULL,
  currency_code text DEFAULT 'MNT',
  balance numeric(14,2) DEFAULT 0,
  account_id uuid REFERENCES accounts(id), -- GL account
  is_active boolean DEFAULT true
);
```

### Ops ↔ Finance Link
```sql
-- Stock Valuation Layers
valuation_layers (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  product_id uuid REFERENCES products(id),
  warehouse_id uuid REFERENCES warehouses(id),
  quantity numeric(14,2) NOT NULL,
  cost numeric(14,2) NOT NULL,
  date date NOT NULL,
  reference text, -- purchase_order_id
  reference_id uuid
);

-- COGS Entries
cogs_entries (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  sale_id uuid REFERENCES sales_orders(id),
  product_id uuid REFERENCES products(id),
  cost numeric(14,2) NOT NULL,
  quantity numeric(14,2) NOT NULL,
  total_cost numeric(14,2) NOT NULL,
  journal_line_id uuid REFERENCES journal_lines(id)
);
```

---

## 🔌 API DESIGN (Шинэчлэгдсэн)

### Posting API
```typescript
// Preview posting (баримт posted болохоос өмнө журнал харах)
POST /api/v1/posting/preview
Body: {
  model_type: "invoice" | "payment" | "expense",
  model_id: string
}
Response: {
  journal_entry: {
    entry_number: string,
    lines: [
      { account: string, debit: number, credit: number }
    ]
  }
}

// Post (posting хийх)
POST /api/v1/posting/post
Body: {
  model_type: "invoice" | "payment" | "expense",
  model_id: string,
  journal_id?: string, // Optional: specific journal
  entry_date?: string // Optional: override date
}
Response: {
  journal_entry_id: string,
  entry_number: string,
  status: "posted"
}
```

### Audit API
```typescript
GET /api/v1/audit
Query: {
  model_type?: string,
  model_id?: string,
  user_id?: string,
  start_date?: string,
  end_date?: string
}
Response: {
  logs: [
    {
      user: string,
      action: string,
      field: string,
      old_value: any,
      new_value: any,
      timestamp: string
    }
  ]
}
```

### Import/Export API
```typescript
// Import template
GET /api/v1/import/templates/:model_type
POST /api/v1/import/:template_id/upload
GET /api/v1/import/jobs/:job_id

// Export
POST /api/v1/export/:model_type
Body: {
  filters: {...},
  format: "excel" | "pdf",
  template_id?: string
}
```

### Webhooks API
```typescript
POST /api/v1/webhooks
GET /api/v1/webhooks
PUT /api/v1/webhooks/:id
DELETE /api/v1/webhooks/:id
```

### Versioning & Idempotency
```typescript
// API versioning
/api/v1/...
/api/v2/...

// Idempotency key (төлбөр/баримт давхар үүсэхээс хамгаална)
POST /api/v1/invoices
Headers: {
  Idempotency-Key: "unique-key-123"
}
```

---

## ✅ ACCEPTANCE CRITERIA (MVP дуусгах шалгуур)

### Accounting/Tax MVP дууссан гэж хэлэх minimum:

1. ✅ **Invoice үүсгэхэд double-entry journal автоматаар үүсдэг**
   - AR Account (Dr) = Invoice total
   - Revenue Account (Cr) = Invoice subtotal
   - VAT Payable Account (Cr) = VAT amount

2. ✅ **Payment хийвэл AR/AP автомат хаагддаг**
   - Payment allocation автомат үүснэ
   - AR/AP баланс шинэчлэгдэнэ

3. ✅ **Bank statement импорт → reconciliation хийж чаддаг**
   - Excel/CSV импорт
   - Автомат тааруулах
   - Manual reconciliation

4. ✅ **VAT тайлангийн үндсэн дүн journal/tax_lines-тай 100% таардаг**
   - Tax report generate хийх
   - Journal-ийн tax_lines-тай харьцуулахад таардаг

---

## 🚀 Хэрэгжүүлэх дараалал (Sprint-ээр)

### Sprint 1: Platform Hardening (2-3 долоо хоног)
**Deliverables:**
- ✅ RBAC/ACL (resource_scope хамт)
- ✅ Numbering Sequences (concurrency-safe: SELECT FOR UPDATE)
- ✅ Attachments
- ✅ Audit Log (immutable)
- ✅ Basic Workflow (JSONB conditions)
- ✅ Document Policies (Close/Cancel/Reverse)

**Acceptance:**
- Хэрэглэгч эрхээр системд нэвтрэх
- Баримтын дугаар давхарддаггүй (concurrency-safe)
- Бүх өөрчлөлт audit log-д бүртгэгдэнэ
- Posted документ засахгүй (policy)

---

### Sprint 2: Accounting Engine + Posting API (2-3 долоо хоног)
**Deliverables:**
- ✅ Chart of Accounts (COA)
- ✅ Journals
- ✅ Journal Entries/Lines
- ✅ Double-entry integrity (DB constraint + trigger)
- ✅ Posting Preview API
- ✅ Posting API (template-based)
- ✅ Reversal API
- ✅ Fiscal Periods + Period Lock

**Acceptance:**
- Invoice үүсгэхэд journal preview харагдана
- Post хийхэд double-entry validation ажиллана (DB түвшинд)
- Posted journal reversal хийж чадна
- Locked period дээр posting хийхэд хориглодог

---

### Sprint 3: AR/AP + Bank + VAT + Reports (3 долоо хоног)
**Deliverables:**
- ✅ Payments хүснэгт (тусад нь)
- ✅ Payment Allocations (FK засагдсан)
- ✅ Invoice → Journal posting (template-based)
- ✅ Payment → AR/AP allocation
- ✅ Bank Statements import
- ✅ Reconciliation (matches хамт - polymorphic)
- ✅ VAT Report generate (tax_lines-тай 100% таарах)
- ✅ Core Reports (Trial Balance, Balance Sheet, P&L)

**Acceptance:**
- Invoice posted бол AR journal үүснэ
- Payment хийвэл AR/AP автомат хаагддаг
- Bank statement импорт → reconciliation хийж чадна (split payment, multi-invoice)
- VAT тайлан = Journal tax_lines 100% таардаг
- 3 core тайлан зөв тооцоолно

---

## 📝 Тэмдэглэл

- **Нэг л удаа posting хийж** - Бусад модулууд accounting дээр сууна
- **Tax = Accounting дээр давхарга** - Тусдаа модуль биш
- **Reports = Report engine** - Бүх модуль дээр ажиллана
- **Platform modules заавал** - Customization-аас зайлсхийх
- **Accounting төвтэй** - Бүх модулууд accounting-тэй холбогдоно

---

## ⚠️ КРИТИК ЗАСВАРУУД

**Дэлгэрэнгүй: `ACCOUNTING_DESIGN_REVIEW.md`**

### Гол засварууд:

1. **Payment Allocations FK** - `payments` тусад нь хүснэгт
2. **Bank Reconciliation** - Polymorphic шийдэл (`reconciliations` + `reconciliation_matches`)
3. **Journal Reversal** - Rollback биш, reversal entry
4. **Double-Entry Integrity** - DB constraint + trigger
5. **Numbering Sequences** - Concurrency-safe (SELECT FOR UPDATE)
6. **Fiscal Periods** - Period lock
7. **Multi-Currency** - Journal дээр currency
8. **Tax Source of Truth** - Invoice line дээр
9. **Posting Templates** - Config-based
10. **Document Policies** - Close/Cancel/Reverse бодлого

### Acceptance Criteria (8 шалгуур):
1. Invoice → Journal автомат (double-entry validated)
2. Payment → AR/AP allocation (FK integrity)
3. Bank reconciliation (polymorphic matches)
4. VAT тайлан = tax_lines 100% таардаг
5. Posted journal reversal
6. Period lock ажилладаг
7. Numbering concurrency-safe
8. Document policy хэрэгжинэ
