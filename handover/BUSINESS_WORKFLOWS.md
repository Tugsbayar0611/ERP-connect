# Бизнес Workflow-ууд

## Admin Setup Flow

1. Admin эрхээр login хийх.
2. Company settings тохируулах.
3. Branch болон location/geofence тохируулах.
4. Department үүсгэх.
5. Job title үүсгэх.
6. Employee үүсгэх.
7. Шаардлагатай бол employee-г system user-тэй холбох.
8. Role болон permission оноох.
9. Ашиглах module-уудыг тохируулах: attendance, payroll, canteen, workwear, inventory, documents.

## Employee Flow

Employee хэрэглэгч ихэвчлэн дараах хэсгийг ашиглана:

- Dashboard.
- My profile.
- Attendance/my attendance.
- Requests.
- Canteen/my meal rights.
- My workwear.
- News/announcements.
- Documents, эрхтэй бол.

Employee хэрэглэгч admin-only menu эсвэл бусад ажилтны хувийн salary data харах ёсгүй.

## Ирцийн Flow

1. Admin/HR branch болон radius тохируулна.
2. Employee өөрийн ирцийг бүртгэнэ, хэрэв enabled бол.
3. HR/Admin гар бүртгэл эсвэл correction хийж болно.
4. Admin user-ийг энгийн employee ирцийн жагсаалтад оруулахгүй, байгууллага тусгайлан хүсвэл өөрөөр шийднэ.
5. HR/Admin calendar/table view-ээр ирц хянана.

Mobile date/timezone behavior-ийг бодит iPhone Safari болон Android Chrome дээр шалгах шаардлагатай.

## Цалингийн Flow

1. Employee үндсэн цалинг тохируулна.
2. Ирц, нэмэгдэл, суутгал, урьдчилгаа зэргийг шалгана.
3. Payroll run үүсгэнэ.
4. Татвар, НДШ, гар дээр авах дүнг шалгана.
5. Нягтлан гараар бодсон тооцоотой тулгаж баталгаажуулна.
6. Шаардлагатай бол payslip/export гаргана.

Бодит цалин ашиглахаас өмнө хэд хэдэн жишээ цалингаар нягтлангаар sign-off хийлгэнэ.

## Inventory Ба Purchase Flow

1. Product category үүсгэх.
2. `Бараа` цэс дээр product үүсгэх.
3. Warehouse үүсгэх.
4. Supplier-г contacts дээр үүсгэх.
5. `Худалдан авалт` цэс дээр purchase order үүсгэх.
6. Supplier, warehouse, order date, expected date, product line сонгох.
7. Захиалгыг confirm/receive хийх.
8. Бараа сонгосон warehouse-ийн үлдэгдэлд нэмэгдсэн байх ёстой.

Purchase дээрх product dropdown нь `/api/products`-оос ирдэг. Purchase modal дотор тусдаа бараа үүсгэдэггүй.

## Нормын Хувцасны Flow

1. Admin/HR хувцасны төрөл, entitlement rule тохируулна.
2. Admin/HR entitlement олгоно эсвэл бөөнөөр үүсгэнэ.
3. Warehouse/Нярав warehouse workwear fulfillment page нээнэ.
4. Warehouse/Нярав хувцас олгох эсвэл авсан төлөвт оруулна.
5. Employee өөрийн workwear status-ийг My Workwear дээр харна.
6. Admin/HR Workwear Reports дээр тайлан харна.

Санал болгож буй role:

- Admin/HR: тохируулах, эрх олгох.
- Warehouse/Нярав: олгох, авсан төлөвт оруулах.
- Employee: өөрийн төлөв харах.

## Цайны Газар / Canteen Flow

1. Admin/canteen operator menu болон wallet rule тохируулна.
2. Employee өөрийн хоолны эрх, wallet харна.
3. Canteen operator meal serve эсвэл transaction бүртгэнэ.
4. Meal deduction ашиглах бол payroll link-ийг хянана.

## Баримт Бичгийн Flow

1. Document create permission-тэй хэрэглэгч document үүсгэх эсвэл upload хийнэ.
2. Workflow-оос хамаарч forward/sign/archive хийнэ.
3. Audit-д logs/history-г шалгана.
4. Mobile дээр document tab/table overflow гарч болох тул тусгайлан шалгана.

## Тайлангийн Flow

1. Admin/manager reports/dashboard нээнэ.
2. Filter сонгоно.
3. Шаардлагатай бол export/print гаргана.
4. Business sign-off хийхээс өмнө source module-ийн тоотой тулгана.
