# Хүлээлгэн Өгөх Checklist

## Handover Meeting Checklist

| Зүйл | Төлөв |
| --- | --- |
| Repository access шилжүүлсэн | Pending |
| Production server access шилжүүлсэн | Pending |
| Database access шилжүүлсэн | Pending |
| Domain/DNS access шилжүүлсэн | Pending |
| SSL certificate ownership баталгаажсан | Pending |
| Backup storage access шилжүүлсэн | Pending |
| SMTP/email credential шилжүүлсэн | Pending |
| eBarimt/QPay credential, ашиглаж байгаа бол шилжүүлсэн | Pending |
| Admin account шилжүүлж password сольсон | Pending |
| `.env.example` хамт review хийсэн | Pending |
| Production `.env` байрлал repo-с гадуур баримтжсан | Pending |
| User guide PDF өгсөн | Pending |
| Known issues review хийсэн | Pending |
| Дараагийн developer onboarding зам тохирсон | Pending |

## Техникийн Хүлээн Зөвшөөрөлт

Доорх command-уудыг ажиллуулж үр дүнг тэмдэглэнэ:

```bash
npm run check
npm run build
npm run db:migrate
npm run db:check
npm run check:env
```

Нэмэлтээр:

```bash
npm run release:check
npm run test:route-permissions
npm run test:rbac
```

## Бизнес Хүлээн Зөвшөөрөлт

Бодит эсвэл бодитой төстэй датагаар шалгах:

- Admin login.
- Employee login.
- Employee create/update.
- Role update.
- Attendance check-in/manual entry.
- Payroll calculation.
- Request create/approve.
- Product create.
- Warehouse/inventory stock movement.
- Purchase order create/confirm/receive.
- Workwear entitlement and issue.
- Canteen wallet/serving, ашиглаж байгаа бол.
- Document create/upload/forward/archive.
- PDF/export/print.

## Mobile Хүлээн Зөвшөөрөлт

Доод тал нь дараах дээр шалгана:

- iPhone Safari.
- Android Chrome.
- 360px narrow viewport.
- 390px iPhone viewport.
- 768px tablet viewport.

Чухал page-үүд:

- Dashboard.
- Attendance.
- Payroll.
- Employees.
- Documents.
- Purchase.
- Workwear.
- Canteen.

Шалгуур:

- Modal эвдэрч гарахгүй.
- Date field уншигдахгүй урт гарахгүй.
- Primary button дэлгэцээс алга болохгүй.
- Хүсээгүй page-wide horizontal overflow гарахгүй.

## Sign-Off

Дараахыг бичиж үлдээнэ:

- Handover date.
- Хүлээж авсан хүний нэр.
- Business owner.
- Техникийн хариуцагч.
- Current branch/commit.
- Хүлээн зөвшөөрсөн open issue-ууд.
- Go-live эсвэл pilot date.
- Support contact.
