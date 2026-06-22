# Role Ба Permission

## Ерөнхий Ойлголт

MonERP нь role/permission загвартай. Frontend дээр navigation эрхээс хамаарч харагдана, backend дээр write action-ууд permission шалгана.

Чухал файлууд:

- Frontend permission helper: `client/src/lib/permissions.ts`
- Navigation: `client/src/config/navigation.ts`
- Shared role helper: `shared/roles.ts`
- Static role permission reference: `shared/permissions.ts`
- Backend route permission: `server/route-permissions.ts`
- RBAC seed: `script/seed-rbac.ts`

## Гол Role-ууд

| Role | Хэрэглэгч | Тайлбар |
| --- | --- | --- |
| Admin | Системийн эзэн | Settings, users, roles, reports, admin workflow-ууд |
| HR | Хүний нөөц | Ажилтан, хэлтэс, ирц, хүсэлт, workwear entitlement/report |
| Finance / Нягтлан | Нягтлан | Цалин, санхүү, тайлан, salary-related data |
| Warehouse / Нярав | Нярав | Бараа, агуулах, нормын хувцас олголт/авах |
| Manager | Ахлагч/менежер | Багийн хүсэлт, ирц, гүйцэтгэл хянах |
| Employee | Энгийн ажилтан | Өөрийн ирц, хүсэлт, хоол, хувцас, profile |

## Нормын Хувцасны Permission

Сүүлд workwear permission болон Warehouse/Нярав flow нэмэгдсэн.

Зөв бизнес хуваарилалт:

- Admin/HR: хувцасны дүрэм, эрх, entitlement тохируулна.
- Warehouse/Нярав: хувцас олгох, авсан төлөвт оруулах.
- Employee: өөрийн хувцасны эрх, авсан/аваагүй төлөвөө харна.

Холбогдох page-үүд:

- Admin workwear management: `/admin/workwear`
- Warehouse workwear fulfillment: `/warehouse/workwear`
- Employee my workwear: `/me/workwear`
- Workwear reports: `/admin/workwear/reports`

## Худалдан Авалт Ба Агуулахын Permission Тэмдэглэл

Purchase order үүсгэхэд warehouse сонгох шаардлагатай болсон. Учир нь purchase receive хийх үед бараа сонгосон агуулах руу орох ёстой.

Холбогдох page-үүд:

- Products: `/products`
- Inventory: `/inventory`
- Purchase: `/purchase`
- Warehouses: inventory/warehouse related UI болон backend route-оор удирдагдана.

## Admin Хэрэглэгчийн Ирц

Одоогийн санал болгож буй policy:

- Admin account нь system account тул энгийн ажилтны ирцийн жагсаалтад оруулахгүй.
- Хэрэв admin хүн өөрөө ирц бүртгүүлэх шаардлагатай бол employee record-той санаатайгаар холбож, байгууллагын дотоод дүрмээр шийднэ.

## Go-Live-ээс Өмнөх Permission Audit

Дараах role тус бүрээр login хийж шалгана:

- Admin.
- HR.
- Finance/Нягтлан.
- Warehouse/Нярав.
- Employee.

Role бүр дээр:

- Sidebar/menu зөв харагдаж байгаа эсэх.
- Restricted URL-г шууд бичээд орж болохгүй байгаа эсэх.
- UI-аас write action хийж болох/болохгүй нь зөв эсэх.
- Боломжтой бол API write action-уудыг шалгах.
- Tenant data leak байхгүй эсэх.

## Шинэ Role Нэмэх

1. Боломжтой бол Settings UI дээр role үүсгэх/засах.
2. Permission-ийг Settings/RBAC эсвэл seed script дээр нэмэх.
3. Code-level check хэрэгтэй бол `shared/roles.ts` шинэчлэх.
4. Menu өөрчлөх бол `client/src/config/navigation.ts` шинэчлэх.
5. Backend write route хамгаалах бол `server/route-permissions.ts` шинэчлэх.
6. Дараахыг ажиллуулах:

```bash
npm run seed:rbac
npm run test:route-permissions
npm run check
```
