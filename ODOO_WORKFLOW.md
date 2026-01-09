# Odoo Workflow - MonERP дээр хэрхэн ажилладаг

## 📋 Борлуулалтын процесс (Sales Workflow)

### Odoo-ийн статус дараалал:
```
Draft (Ноорог) 
  ↓
Quotation (Үнэлгээ) 
  ↓
Sent (Илгээсэн)
  ↓
Confirmed (Баталгаажсан) → Нөөц захиалагдана (Stock Reserved)
  ↓
Delivered (Хүргэгдсэн)
  ↓
Invoiced (Нэхэмжлэгдсэн)
```

### MonERP дээр хэрэгжүүлсэн:
- ✅ `POST /api/sales-orders` - Шинэ захиалга үүсгэх (draft статустай)
- ✅ `PUT /api/sales-orders/:id/send` - Үйлчлүүлэгч рүү илгээх (sent)
- ✅ `PUT /api/sales-orders/:id/confirm` - Захиалгыг баталгаажуулах (confirmed) → Нөөц автоматаар захиалагдана
- ✅ `POST /api/sales-orders/:id/create-invoice` - Нэхэмжлэх автоматаар үүсгэх

## 🛒 Худалдан авалтын процесс (Purchase Workflow)

### Odoo-ийн статус дараалал:
```
Draft (Ноорог)
  ↓
RFQ / Sent (Хаалгана)
  ↓
Confirmed (Баталгаажсан)
  ↓
Received (Хүлээн авсан) → Нөөц автоматаар нэмэгдэнэ (Stock In)
  ↓
Bill (Нэхэмжлэх)
```

### MonERP дээр хэрэгжүүлсэн:
- ✅ `POST /api/purchase-orders` - Шинэ захиалга үүсгэх (draft)
- ✅ `PUT /api/purchase-orders/:id/confirm` - Захиалгыг баталгаажуулах (confirmed)
- ✅ `PUT /api/purchase-orders/:id/receive` - Барааг хүлээн авах (received) → Нөөц автоматаар нэмэгдэнэ

## 📦 Нөөцийн удирдлага (Inventory Management)

### Odoo-ийн ажиллах зарчим:
1. **Stock Moves** (Нөөцийн шилжилт):
   - Sales Order confirm → Stock OUT (Нөөц буурах)
   - Purchase Order receive → Stock IN (Нөөц нэмэгдэх)
   - Manual adjustment → Stock adjustment

2. **Stock Levels** автоматаар шинэчлэгддэг

### MonERP дээр:
- ✅ Stock movements автоматаар бүртгэгддэг
- ✅ Stock levels автоматаар шинэчлэгддэг
- ✅ `GET /api/stock-levels` - Нөөцийн мэдээлэл харах

## 💰 Нэхэмжлэх (Invoices)

### Odoo-ийн процесс:
1. Sales Order-оос автоматаар Invoice үүсгэх
2. Invoice-ийн мэдээлэл Sales Order-оос авна
3. Төлбөрийн статус хянах (draft → sent → paid)

### MonERP дээр:
- ✅ Sales Order-оос Invoice автоматаар үүсгэх
- ✅ Invoice status удирдлага
- ✅ Төлбөрийн түүх хадгалах

## 🔄 Жишээ: Борлуулалтын бүтэн процесс

```javascript
// 1. Шинэ захиалга үүсгэх (Draft)
POST /api/sales-orders
{
  customerId: "123",
  orderDate: "2024-01-15",
  lines: [
    { productId: "p1", quantity: 10, unitPrice: 10000 }
  ]
}

// 2. Үйлчлүүлэгч рүү илгээх
PUT /api/sales-orders/{id}/send
→ Status: "sent"

// 3. Захиалгыг баталгаажуулах
PUT /api/sales-orders/{id}/confirm
→ Status: "confirmed"
→ Stock автоматаар захиалагдана (reserved)

// 4. Нэхэмжлэх үүсгэх
POST /api/sales-orders/{id}/create-invoice
→ Invoice автоматаар үүснэ
→ Sales Order status: "invoiced"

// 5. Нэхэмжлэхийг төлөх
PUT /api/invoices/{invoiceId}/status
{
  status: "paid",
  paidAmount: 110000
}
```

## 🎯 Монголын онцлог

- ✅ ХХОАТ 10% автоматаар тооцдог
- ✅ Монгол төгрөг форматлалт (₮)
- ✅ QR код төлбөр дэмжих (invoice.qrCode)
- ✅ Банкны данс мэдээлэл (contacts.bankAccount)

## 📊 Status Codes

### Sales Order:
- `draft` - Ноорог
- `quotation` - Үнэлгээ
- `sent` - Илгээсэн
- `confirmed` - Баталгаажсан (Нөөц захиалгдсан)
- `invoiced` - Нэхэмжлэгдсэн
- `cancelled` - Цуцлагдсан

### Purchase Order:
- `draft` - Ноорог
- `sent` - Илгээсэн
- `confirmed` - Баталгаажсан
- `received` - Хүлээн авсан (Нөөц нэмэгдсэн)
- `cancelled` - Цуцлагдсан

### Invoice:
- `draft` - Ноорог
- `sent` - Илгээсэн
- `paid` - Төлөгдсөн
- `cancelled` - Цуцлагдсан

## 🚀 Дараагийн алхам

1. ✅ Workflow endpoint-ууд нэмэгдсэн
2. ⏳ Frontend дээр workflow товчнууд нэмэх
3. ⏳ Stock movements history харах
4. ⏳ Delivery note (Хүргэлтийн баримт)
5. ⏳ Payment tracking
