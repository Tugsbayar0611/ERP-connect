# API Test Guide: Salary Advances & Allowances

Энэхүү баримт бичиг нь Salary Advances болон Employee Allowances API-уудыг тестлэхэд зориулсан curl командуудыг агуулна.

## 🔐 Authentication

Эхлээд login хийж, cookie-г хадгалах хэрэгтэй:

```bash
# Login (cookie-г хадгалах)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}' \
  -c cookies.txt \
  -b cookies.txt
```

## 📋 Employee Allowances API

### 1. GET /api/employee-allowances
Ажилтны нэмэгдлүүдийг авах:

```bash
# Бүх нэмэгдлүүд
curl http://localhost:5000/api/employee-allowances \
  -b cookies.txt

# Тодорхой ажилтны нэмэгдлүүд
curl "http://localhost:5000/api/employee-allowances?employeeId=EMPLOYEE_ID" \
  -b cookies.txt
```

### 2. POST /api/employee-allowances
Шинэ нэмэгдэл үүсгэх:

```bash
curl -X POST http://localhost:5000/api/employee-allowances \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "employeeId": "EMPLOYEE_ID",
    "code": "TRANSPORT",
    "name": "Унааны мөнгө",
    "amount": 50000,
    "isTaxable": true,
    "isSHI": true,
    "isPIT": true,
    "isRecurring": true,
    "effectiveFrom": "2026-01-01"
  }'
```

**Жишээ Response:**
```json
{
  "id": "uuid",
  "employeeId": "uuid",
  "code": "TRANSPORT",
  "name": "Унааны мөнгө",
  "amount": "50000.00",
  "isTaxable": true,
  "isSHI": true,
  "isPIT": true,
  "isRecurring": true
}
```

### 3. PUT /api/employee-allowances/:id
Нэмэгдэл засах:

```bash
curl -X PUT http://localhost:5000/api/employee-allowances/ALLOWANCE_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "amount": 60000
  }'
```

### 4. DELETE /api/employee-allowances/:id
Нэмэгдэл устгах:

```bash
curl -X DELETE http://localhost:5000/api/employee-allowances/ALLOWANCE_ID \
  -b cookies.txt
```

---

## 💰 Salary Advances API

### 1. GET /api/salary-advances
Урьдчилгааны жагсаалт авах:

```bash
# Бүх урьдчилгаа
curl http://localhost:5000/api/salary-advances \
  -b cookies.txt

# Тодорхой ажилтны урьдчилгаа
curl "http://localhost:5000/api/salary-advances?employeeId=EMPLOYEE_ID" \
  -b cookies.txt

# Тодорхой статустай урьдчилгаа
curl "http://localhost:5000/api/salary-advances?status=approved" \
  -b cookies.txt
```

### 2. POST /api/salary-advances
Урьдчилгааны хүсэлт үүсгэх:

```bash
curl -X POST http://localhost:5000/api/salary-advances \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "employeeId": "EMPLOYEE_ID",
    "amount": 200000,
    "reason": "Яаралтай зардал",
    "deductionType": "monthly",
    "monthlyDeductionAmount": 50000,
    "totalDeductionMonths": 4,
    "isLoan": false
  }'
```

**Жишээ Response:**
```json
{
  "id": "uuid",
  "employeeId": "uuid",
  "amount": "200000.00",
  "status": "pending",
  "deductionType": "monthly",
  "monthlyDeductionAmount": "50000.00",
  "totalDeductionMonths": 4
}
```

### 3. POST /api/salary-advances/:id/approve
Урьдчилгаа баталгаажуулах:

```bash
curl -X POST http://localhost:5000/api/salary-advances/ADVANCE_ID/approve \
  -b cookies.txt
```

**Жишээ Response:**
```json
{
  "id": "uuid",
  "status": "approved",
  "approvedBy": "user_uuid",
  "approvedAt": "2026-01-16T...",
  "paidAt": "2026-01-16T..."
}
```

### 4. POST /api/salary-advances/:id/reject
Урьдчилгаа татгалзах:

```bash
curl -X POST http://localhost:5000/api/salary-advances/ADVANCE_ID/reject \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "rejectionReason": "Бюджет хангалтгүй"
  }'
```

### 5. PUT /api/salary-advances/:id
Урьдчилгаа засах:

```bash
curl -X PUT http://localhost:5000/api/salary-advances/ADVANCE_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "monthlyDeductionAmount": 60000
  }'
```

### 6. DELETE /api/salary-advances/:id
Урьдчилгаа устгах:

```bash
curl -X DELETE http://localhost:5000/api/salary-advances/ADVANCE_ID \
  -b cookies.txt
```

---

## 🧪 Complete Test Flow

### Test 1: Create Allowance → Create Advance → Approve → Verify Payroll

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  -c cookies.txt

# 2. Get employee ID
EMPLOYEE_ID=$(curl -s http://localhost:5000/api/employees -b cookies.txt | jq -r '.[0].id')
echo "Employee ID: $EMPLOYEE_ID"

# 3. Create allowance
ALLOWANCE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/employee-allowances \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"code\": \"MEAL-TEST\",
    \"name\": \"Хоолны мөнгө\",
    \"amount\": 30000,
    \"isTaxable\": false,
    \"isSHI\": false,
    \"isPIT\": false,
    \"isRecurring\": true,
    \"effectiveFrom\": \"$(date +%Y-%m-%d)\"
  }")
echo "Allowance created: $ALLOWANCE_RESPONSE"

# 4. Create advance request
ADVANCE_RESPONSE=$(curl -s -X POST http://localhost:5000/api/salary-advances \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"employeeId\": \"$EMPLOYEE_ID\",
    \"amount\": 150000,
    \"reason\": \"API Test\",
    \"deductionType\": \"monthly\",
    \"monthlyDeductionAmount\": 50000,
    \"totalDeductionMonths\": 3,
    \"isLoan\": false
  }")
echo "Advance created: $ADVANCE_RESPONSE"

# 5. Get advance ID and approve
ADVANCE_ID=$(echo $ADVANCE_RESPONSE | jq -r '.id')
curl -X POST http://localhost:5000/api/salary-advances/$ADVANCE_ID/approve \
  -b cookies.txt

# 6. Verify allowances and advances are returned
curl "http://localhost:5000/api/employee-allowances?employeeId=$EMPLOYEE_ID" -b cookies.txt
curl "http://localhost:5000/api/salary-advances?employeeId=$EMPLOYEE_ID&status=approved" -b cookies.txt
```

---

## ✅ Expected Results

### After creating allowance:
- Allowance appears in `GET /api/employee-allowances?employeeId=...`
- `isRecurring=true` allowances are automatically included in payroll calculation

### After creating and approving advance:
- Advance status changes to `approved`
- `paidAt` timestamp is set
- Advance appears in `GET /api/salary-advances?status=approved`
- Advance deduction is calculated in payroll

### Payroll calculation should include:
- Base salary
- Recurring allowances (if `effectiveFrom <= periodEnd` and `effectiveTo >= periodStart`)
- Approved advances (monthly deduction or one-time deduction)
- НДШ and ХХОАТ calculated correctly

---

## 🔍 Verification Checklist

- [ ] Allowance created successfully
- [ ] Allowance appears in GET request
- [ ] Advance request created (status: pending)
- [ ] Advance approved successfully (status: approved)
- [ ] Approved advance appears in GET request
- [ ] Payroll calculation includes allowance amount
- [ ] Payroll calculation includes advance deduction
- [ ] Net pay is calculated correctly (Gross - НДШ - ХХОАТ - Advances)

---

## 📝 Notes

1. **Cookie-based Auth**: All requests need `-b cookies.txt` to include session cookie
2. **Employee ID**: Replace `EMPLOYEE_ID` with actual employee UUID
3. **Date Format**: Use `YYYY-MM-DD` format for dates
4. **Amount Format**: Use numbers (not strings) for amounts
5. **Permissions**: Write operations (POST/PUT/DELETE) require appropriate permissions
