# Мэдэгдэж Байгаа Асуудал Ба Дараагийн Алхам

## Одоогийн Бэлэн Байдлын Үнэлгээ

Сүүлийн review-ээр систем pilot байдлаар ашиглаж эхлэхэд ойртсон. Гэхдээ full production go-live хийхээс өмнө production readiness болон UAT заавал хийнэ.

Санал болгож буй төлөв:

- Pilot readiness: ойролцоогоор 75-80%.
- Full production readiness: final audit, backup/restore test, permission audit, real-user UAT хэрэгтэй.

## Анхаарах Гол Хэсгүүд

### Mobile Layout

Зарим page сайжирсан ч mobile QA өндөр ач холбогдолтой хэвээр:

- Dashboard widget-үүд.
- Documents tab/table.
- Payroll date field болон form.
- Roster calendar/template builder.
- Purchase order modal.
- Employee table-ууд.

### Цалингийн Бодолт

Payroll-ийг production дээр бодитоор ашиглахаас өмнө нягтлангаар баталгаажуулах ёстой.

Шалгах зүйлс:

- НДШ.
- ХХОАТ.
- Татварын хөнгөлөлт.
- Нэмэгдэл.
- Суутгал.
- Урьдчилгаа.
- Илүү цаг.
- Хэсэгчилсэн хугацааны бодолт, ашиглаж байгаа бол.

### Role Ба Permission Audit

RBAC сайжирсан, workwear болон Warehouse/Нярав access нэмэгдсэн. Гэхдээ production-оос өмнө:

- Role бүрээр login хийж шалгах.
- Direct URL access шалгах.
- Backend write action шалгах.
- Employee restricted salary/admin data харахгүй байгаа эсэхийг баталгаажуулах.

### Purchase Ба Inventory

Сүүлд purchase order дээр warehouse заавал сонгодог болсон. Ингэснээр receive хийхэд бараа зөв warehouse руу орно.

Дараагийн developer дараахыг regression test хийнэ:

- Supplier selection.
- Warehouse selection.
- Product selection.
- Unit price auto-fill.
- Tax/discount total.
- Confirm/receive status transition.
- Receive хийсний дараах stock movement.

### Data Import

Одоогоор universal import workflow бүрэн баримтжуулаагүй. Байгууллага олон ажилтан, бараа, customer-той бол mass onboarding-оос өмнө CSV/Excel import procedure эсвэл template-ийг тодорхой болгох хэрэгтэй.

### Encoding

Зарим хуучин script-ийн console message дээр Unicode тэмдэгт эвдэрсэн харагдаж магадгүй. Логик заавал эвдэрсэн гэсэн үг биш, гэхдээ developer-facing message-үүдийг цаашдаа цэвэрлэх хэрэгтэй.

## Санал Болгох Дараагийн Ажил

1. Staging environment үүсгэх.
2. Бодит sample data бэлтгэх.
3. Admin, HR, Finance, Warehouse/Нярав, Employee user-үүдээр UAT хийх.
4. Бодит утсан дээр mobile QA хийх.
5. Data import template эсвэл procedure бэлдэх.
6. Purchase/inventory болон payroll critical calculation дээр automated test нэмэх.
7. Backup болон restore баталгаажуулах.
8. Сонгосон hosting аргадаа зориулж production deployment document эцэслэх.
9. Open backlog болон owner-уудыг бичиж үлдээх.

## Дараах Нөхцөлд Go-Live Хийж Болохгүй

- Payroll result нягтлангаар sign-off хийгдээгүй.
- Backup restore туршигдаагүй.
- Admin/employee permission boundary тодорхой биш.
- Production secret сул эсвэл development secret-тэй адил.
- Demo/test data production data-тай холилдсон.
- Purchase/inventory receive бодит warehouse flow дээр баталгаажаагүй.
