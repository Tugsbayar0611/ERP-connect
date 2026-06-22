# Database Ба Өгөгдөл

## Database

- Database engine: PostgreSQL.
- Холболт: `DATABASE_URL`.
- Schema definition: `shared/schema.ts`.
- SQL migration: `migrations`.
- Migration runner: `scripts/run-migration.ts`.

## Migration Command

```bash
npm run db:migrate
```

Migration-ийн дараа:

```bash
npm run db:check
```

## Одоогийн Migration Тэмдэглэл

Migration runner нь accounting patch-аас workwear permission хүртэлх дараах migration-уудыг дарааллаар ажиллуулна:

- `001_accounting_patches.sql`
- `002_numbering_sequences.sql`
- `003_qpay_integration.sql`
- `004_two_factor_auth.sql`
- `005_add_national_id.sql`
- `006_create_attendance_tables.sql`
- `007_password_reset_tokens.sql`
- `008_add_ebarimt_fields.sql`
- `009_create_ebarimt_settings.sql`
- `010_add_tenant_address_fields.sql`
- `011_add_ebarimt_lottery_number.sql`
- `012_padan_numbering.sql`
- `013_add_mongolian_hr_fields.sql`
- `014_add_expiry_batch_tracking.sql`
- `015_add_salary_advances_allowances.sql`
- `016_add_geofencing_branches.sql`
- `017_add_hr_gamification.sql`
- `018_add_attendance_photos.sql`
- `019_add_wifi_ssid_to_branches.sql`
- `020_add_news_feed.sql`
- `021_add_weather_widget.sql`
- `022_add_department_manager.sql`
- `023_add_user_id_to_employees.sql`
- `024_add_google_auth_domains.sql`
- `025_add_workwear_permissions.sql`
- `026_add_workwear_warehouse_role.sql`

Шинэ migration нэмэх бол SQL file үүсгээд `scripts/run-migration.ts` дотор дараалалд нэмнэ.

## Seed Script-үүд

Чухал script-үүд:

```bash
npm run seed:rbac
npm run seed:admin
npm run seed:demo
npm run seed:dashboard
```

`seed:demo`-г зөвхөн local/demo орчинд ашиглана. Production дээр demo data хийх бол байгууллагын зөвшөөрөлтэй байх ёстой.

## Өгөгдөл Оруулах Журам

Санал болгох дараалал:

1. Бага хэмжээний master data-г UI-аар оруулах.
2. Олон ажилтан, бараа, нийлүүлэгч, харилцагч, opening stock байвал CSV/Excel import ашиглах.
3. Role, permission, default setting зэрэг system-level өгөгдлийг seed/migration script-ээр оруулах.
4. Шууд database insert хийхийг хамгийн сүүлийн сонголт болгох.

Production database дээр өөрчлөлт хийхээс өмнө backup заавал авна. Боломжтой бол эхлээд staging дээр туршина.

## Production-д Бэлтгэх Өгөгдөл

- Company болон tenant тохиргоо.
- Branch болон geofence radius.
- Department.
- Job title.
- Employee.
- User account болон role.
- Product болон category.
- Warehouse.
- Opening stock.
- Supplier болон customer.
- Shift/roster template.
- Payroll rule болон үндсэн цалин.
- Workwear item rule болон entitlement.
- Canteen wallet/opening balance, ашиглах бол.

## Backup Журам

Хамгийн бага шаардлага:

- PostgreSQL daily backup.
- Uploads daily backup.
- 7 daily backup, 4 weekly backup хадгалах.
- Go-live хийхээс өмнө restore test хийх.
- Launch-ийн дараа ч restore test-ийг тогтмол хийх.

Backup файл байгаа нь хангалтгүй. Restore хийж үзсэн байх ёстой.

## Файл Ба Uploads

Upload файлууд `UPLOAD_DIR`-ээр удирдагдана.

Production шаардлага:

- Persistent disk эсвэл object storage.
- Database backup-тай хамт backup хийгддэг байх.
- Source repo дотор биш байх.
- Server permission-оор хамгаалагдсан байх.
