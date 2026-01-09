# Schema Patch Summary - Критик Засварууд

## ✅ ХИЙГДСЭН ЗАСВАРУУД

### 1. ✅ currency_code FK → currency_id болгож засав
**Файл:** `shared/schema.ts`
- `currencies` хүснэгт үүсгэсэн
- `journalEntries.currencyId` → `currencies.id` FK
- `journalLines.currencyId` → `currencies.id` FK
- `payments.currencyId` → `currencies.id` FK
- `bankAccounts.currencyId` → `currencies.id` FK

---

### 2. ✅ reconciliation_matches polymorphic → 3 FK баганатай болгосон
**Файл:** `shared/schema.ts` (line ~804-817)
- `reconciliationMatches` хүснэгт:
  - `invoiceId` (FK → invoices)
  - `paymentId` (FK → payments)
  - `journalLineId` (FK → journal_lines)
- SQL trigger: Зөвхөн нэг FK байх ёстой (check constraint)

---

### 3. ✅ double-entry шалгалт → posting-time trigger рүү шилжүүлсэн
**Файл:** `migrations/001_accounting_patches.sql`
- `check_double_entry_on_post()` function
- Trigger: Зөвхөн `status = 'posted'` болоход шалгана
- Float тэвч: `ABS(total_debit - total_credit) > 0.01`

---

### 4. ✅ posted journal_lines write хориглох trigger нэмсэн
**Файл:** `migrations/001_accounting_patches.sql`
- `prevent_posted_journal_line_write()` function
- Trigger: `status = 'posted'` entry-ийн lines засах/устгах хориглоно

---

### 5. ✅ period lock → INSERT+UPDATE дээр, tenant-aware + period derive
**Файл:** `migrations/001_accounting_patches.sql`
- `check_period_lock()` function
- INSERT+UPDATE дээр trigger
- Tenant-aware: `fy.tenant_id = NEW.tenant_id`
- Period derive: `entry_date`-аас автомат олно
- Auto-set `fiscal_period_id`

---

### 6. ✅ VAT accounts → payable/receivable ялга
**Файл:** `shared/schema.ts` (line ~723-726)
- `taxCodes` хүснэгт:
  - `taxAccountPayableId` → ХХОАТ төлөх данс
  - `taxAccountReceivableId` → ХХОАТ авах данс

---

### 7. ✅ allocations дээр UPSERT + cap checks
**Файл:** `migrations/001_accounting_patches.sql`
- `check_allocation_cap()` function
- Check: `total_allocated <= payment_amount`
- Check: `allocated_amount <= invoice_remaining`
- UPSERT дэмжих (UPDATE дээр бас шалгана)

---

### 8. ✅ bank statement debit/credit constraint
**Файл:** `migrations/001_accounting_patches.sql`
- `check_bank_statement_line_debit_credit()` function
- Constraint: Зөвхөн нэг тал (debit OR credit)
- Constraint: Хоёр тал тэг биш

---

## 📁 ФАЙЛУУД

### 1. `shared/schema.ts`
- Accounting хүснэгтүүд нэмэгдсэн
- Бүх FK references засагдсан
- Types болон Zod schemas нэмэгдсэн

### 2. `migrations/001_accounting_patches.sql`
- Бүх SQL triggers болон functions
- Production-ready constraints

### 3. `shared/schema-accounting-patch.sql` (Reference)
- SQL CREATE TABLE statements (reference зориулалттай)

---

## 🚀 ДАРААГИЙН АЛХАМ

1. **Migration ажиллуулах:**
   ```bash
   # SQL файлыг PostgreSQL дээр ажиллуулах
   psql -d your_database -f migrations/001_accounting_patches.sql
   ```

2. **Drizzle push:**
   ```bash
   npm run db:push
   ```

3. **Schema validation:**
   - Linter errors шалгах
   - Type errors шалгах

---

## ⚠️ АНХААРУУЛГА

- **SQL triggers** нь Drizzle ORM-оос тусдаа ажиллана
- Migration-ийг production дээр ажиллуухаас өмнө test хийх
- Constraint violations нь exception өгнө (application level дээр catch хийх)

---

## ✅ ACCEPTANCE

Бүх 8 критик засвар хийгдсэн:
1. ✅ currency_code → currency_id
2. ✅ reconciliation_matches 3 FK
3. ✅ double-entry posting-time trigger
4. ✅ posted journal_lines write хориглох
5. ✅ period lock INSERT+UPDATE, tenant-aware, auto-derive
6. ✅ VAT accounts payable/receivable ялга
7. ✅ allocations UPSERT + cap checks
8. ✅ bank statement debit/credit constraint
