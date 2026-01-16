# Монголын Зах Зээлд Зориулсан Шинэ Функцүүд

## 🎯 Нэмэгдсэн Модулууд

Монголд зарахад шаардлагатай дараах функцүүдийг нэмлээ:

---

## 1. e-Barimt Интеграци (Цахим Баримт) ✅

**Файл:** `server/ebarimt.ts`

Татварын Ерөнхий Газрын e-Barimt системтэй холбогдох модуль.

### Функцүүд:
- `registerInvoice()` - Нэхэмжлэхийг e-Barimt-д бүртгэх
- `cancelInvoice()` - Баримт цуцлах/буцаах
- `getOrganizationByTin()` - ТТД-ээр байгууллага хайх
- `checkLottery()` - Сугалаа шалгах

### API Endpoints:
```
POST /api/ebarimt/register      - Нэхэмжлэх бүртгэх
POST /api/ebarimt/cancel        - Баримт цуцлах
GET  /api/ebarimt/organization/:tin - ТТД хайх
```

### Хэрхэн ашиглах:
```typescript
// Нэхэмжлэх үүсгэсний дараа e-Barimt бүртгэх
POST /api/ebarimt/register
{ "invoiceId": "invoice-uuid" }

// Response:
{
  "success": true,
  "billId": "EB-1234567890-ABCD",
  "lottery": "123456",
  "qrData": "base64-qr-data"
}
```

### Тохиргоо (.env):
```env
EBARIMT_POS_NO=your-pos-number
EBARIMT_MERCHANT_ID=your-merchant-id
EBARIMT_BRANCH_NO=001
EBARIMT_API_URL=https://ebarimt.mn/api/v1
EBARIMT_API_KEY=your-api-key
```

---

## 2. QPay/SocialPay Интеграци (QR Төлбөр) ✅

**Файл:** `server/qpay.ts`

Монголын банкуудын QR төлбөрийн системтэй холбогдох модуль.

### Дэмжигдэх банкууд:
- Хаан банк
- Голомт банк
- Худалдаа хөгжлийн банк
- Төрийн банк
- Хас банк
- Богд банк
- Капитрон банк

### Функцүүд:
- `createInvoice()` - QPay нэхэмжлэх үүсгэх
- `checkPayment()` - Төлбөр шалгах
- `cancelInvoice()` - Нэхэмжлэх цуцлах
- `handleCallback()` - Төлбөрийн callback боловсруулах

### API Endpoints:
```
POST /api/qpay/create-invoice   - QR нэхэмжлэх үүсгэх
POST /api/qpay/check-payment    - Төлбөр шалгах
POST /api/qpay/callback         - Callback endpoint
```

### Хэрхэн ашиглах:
```typescript
// QR нэхэмжлэх үүсгэх
POST /api/qpay/create-invoice
{ "invoiceId": "invoice-uuid" }

// Response:
{
  "success": true,
  "invoiceId": "QPAY-123...",
  "qrText": "QPay:...",
  "qPayShortUrl": "https://qpay.mn/q/...",
  "urls": [
    { "name": "Khan Bank", "link": "khanbank://qpay?..." },
    { "name": "Golomt Bank", "link": "golomt://qpay?..." },
    ...
  ]
}
```

### Тохиргоо (.env):
```env
QPAY_USERNAME=your-username
QPAY_PASSWORD=your-password
QPAY_INVOICE_CODE=your-invoice-code
QPAY_CALLBACK_URL=https://your-domain/api/qpay/callback
QPAY_API_URL=https://merchant.qpay.mn/v2
```

---

## 3. Монгол Хэлний Дэмжлэг (i18n) ✅

**Файл:** `client/src/lib/i18n/mn.ts`

Бүрэн Монгол хэлний орчуулга.

### Агуулга:
- Бүх модулийн орчуулга (HR, Sales, Purchase, Accounting, Reports)
- Татвар, шимтгэлийн нэр томъёо
- Банкуудын нэр
- Алдааны мэдэгдлүүд
- Validation мессежүүд

### Хэрхэн ашиглах:
```typescript
import { t, mn } from '@/lib/i18n/mn';

// Орчуулга авах
const label = t('payroll.socialInsurance'); // "НДШ"
const buttonText = mn.common.save; // "Хадгалах"

// Параметртэй орчуулга
const message = t('validation.minLength', { min: 5 }); // "5 тэмдэгтээс дээш байх ёстой"
```

---

## 4. НӨАТ Тайлан (VAT Report) ✅

**Файл:** `server/vat-report.ts`

Татварын албанд илгээх НӨАТ тайлан үүсгэх модуль.

### Функцүүд:
- `generateVATReport()` - НӨАТ тайлан үүсгэх
- `exportVATReportToExcel()` - Excel формат
- `formatForTaxAuthority()` - ТЕГ-ийн формат
- `validateVATWithJournal()` - Журналтай баталгаажуулах

### API Endpoints:
```
GET /api/reports/vat           - НӨАТ тайлан авах
GET /api/reports/vat/export    - Экспортлох
GET /api/reports/vat/validate  - Журналтай шалгах
```

### Хэрхэн ашиглах:
```typescript
// НӨАТ тайлан авах
GET /api/reports/vat?startDate=2024-01-01&endDate=2024-01-31

// Response:
{
  "companyName": "Миний компани",
  "companyTIN": "1234567",
  "reportPeriod": "2024-01",
  "sales": {
    "total": 10000000,
    "vatAmount": 1000000,
    "invoiceCount": 15
  },
  "purchases": {
    "total": 5000000,
    "vatAmount": 500000,
    "invoiceCount": 8
  },
  "summary": {
    "outputVat": 1000000,
    "inputVat": 500000,
    "netVat": 500000,
    "payable": true
  }
}
```

---

## 5. Монголын Цалингийн Тооцоолол ✅

**Файл:** `server/mn-payroll.ts`

Монголын хууль тогтоомжийн дагуу цалин бодох модуль.

### Татвар, шимтгэлийн хувь (2024):
- **ХХОАТ**: 10%
- **НДШ (Ажилтан)**: 12.5%
  - Тэтгэвэр: 7%
  - ЭМДШ: 3.5%
  - Ажилгүйдэл: 0.5%
  - Тэтгэмж: 0.5%
  - ҮОМШ: 1%
- **НДШ (Ажил олгогч)**: 13.5%

### Функцүүд:
- `calculatePayroll()` - Цалин бодох
- `generateEarningsBreakdown()` - Орлогын задаргаа
- `generateDeductionsBreakdown()` - Суутгалын задаргаа
- `generateMonthlyReport()` - Сарын тайлан

### API Endpoints:
```
POST /api/payroll/calculate    - Нэг ажилтны цалин бодох
POST /api/payroll/run-batch    - Олон ажилтны цалин бодох
```

### Хэрхэн ашиглах:
```typescript
// Цалин бодох
POST /api/payroll/calculate
{
  "baseSalary": 2000000,
  "overtime": 100000,
  "bonus": 200000
}

// Response:
{
  "grossSalary": 2300000,
  "socialInsurance": {
    "pension": 161000,
    "healthInsurance": 80500,
    "total": 287500
  },
  "pit": 201250,
  "netSalary": 1811250,
  "totalEmployerCost": 2610500
}
```

---

## 6. Банкны Хуулга Импорт ✅

**Файл:** `server/bank-import.ts`

Монголын банкуудын хуулга импортлох модуль.

### Дэмжигдэх банкууд:
- Хаан банк
- Голомт банк
- Худалдаа хөгжлийн банк
- Төрийн банк
- Хас банк
- Богд банк
- Капитрон банк

### Функцүүд:
- `parseBankStatement()` - Хуулга унших
- `detectBankFormat()` - Банкны формат таних
- `suggestReconciliations()` - Автомат тааруулах санал
- `parseCSV()` - CSV унших

### API Endpoints:
```
GET  /api/bank-import/formats              - Дэмжигдэх форматууд
POST /api/bank-import/parse                - Хуулга унших
POST /api/bank-import/suggest-reconciliation - Тааруулах санал
POST /api/bank-import/import               - Хуулга импортлох
```

### Хэрхэн ашиглах:
```typescript
// Хуулга унших
POST /api/bank-import/parse
{
  "data": [[...]], // 2D array (Excel-ээс)
  "bankCode": "KHANBANK"
}

// Response:
{
  "success": true,
  "bankCode": "KHANBANK",
  "openingBalance": 5000000,
  "closingBalance": 7500000,
  "lines": [
    {
      "date": "2024-01-15",
      "description": "Борлуулалт INV-2024-001",
      "debit": 0,
      "credit": 1000000,
      "balance": 6000000
    },
    ...
  ],
  "lineCount": 25
}
```

---

## 📋 Нэмэлт Шаардлагатай Зүйлс

### Дараагийн Алхамууд:

1. **Frontend UI**
   - e-Barimt бүртгэх товч нэхэмжлэх хуудсанд
   - QPay QR харуулах модал
   - НӨАТ тайлангийн хуудас
   - Банкны хуулга импортлох хуудас

2. **Production Тохиргоо**
   - e-Barimt POS гэрээ байгуулах (ТЕГ)
   - QPay Merchant бүртгүүлэх
   - SocialPay API нэвтрэлт авах

3. **Нэмэлт Тайлангууд**
   - НДШ тайлан (Нийгмийн даатгалын албанд)
   - ХХОАТ тайлан (Татварын албанд)
   - Цалингийн жагсаалт

---

## 🔧 Техникийн Шаардлага

### Environment Variables (.env):
```env
# e-Barimt
EBARIMT_POS_NO=
EBARIMT_MERCHANT_ID=
EBARIMT_BRANCH_NO=
EBARIMT_API_URL=
EBARIMT_API_KEY=

# QPay
QPAY_USERNAME=
QPAY_PASSWORD=
QPAY_INVOICE_CODE=
QPAY_CALLBACK_URL=
QPAY_API_URL=

# SocialPay (optional)
SOCIALPAY_MERCHANT_ID=
SOCIALPAY_TERMINAL_ID=
SOCIALPAY_API_KEY=
```

---

## ✅ Давуу Талууд

1. **Хууль дүрэмд нийцсэн**
   - e-Barimt заавал шаардлага биелэгдэнэ
   - НӨАТ, ХХОАТ, НДШ зөв тооцоолно

2. **Хэрэглэгчдэд тохиромжтой**
   - QPay, SocialPay төлбөр хүлээн авна
   - Банкны хуулга хялбар импортлоно

3. **Монгол хэлээр**
   - Бүрэн Монгол интерфэйс
   - Монгол нэр томъёо

4. **Интеграцлагдсан**
   - Санхүүгийн модультай холбогдсон
   - Тайлангууд автоматаар үүснэ

---

**Статус: Бэлэн ✅**

Бүх модулууд хэрэгжүүлэгдсэн. Production-д ашиглахын тулд ТЕГ болон банкуудын API гэрээ байгуулах шаардлагатай.
