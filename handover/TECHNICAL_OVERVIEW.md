# Техникийн Тойм

## Ашигласан Технологи

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/Radix UI төрлийн component-ууд.
- Backend: Express, TypeScript, Node.js.
- Database: PostgreSQL, Drizzle schema.
- Auth/session: Passport, Express session, PostgreSQL session store.
- Realtime: Socket.IO.
- PDF/export: jsPDF, html2canvas, xlsx, custom export helper-үүд.
- Integration: QPay, eBarimt, SMTP email, optional Google OAuth, weather, AI provider key.

## Гол Хавтаснууд

| Зам | Зориулалт |
| --- | --- |
| `client/src/pages` | Frontend page/route файлууд |
| `client/src/components` | Дундын UI болон module component-ууд |
| `client/src/hooks` | API hook болон React Query логик |
| `client/src/lib` | Frontend helper функцууд |
| `server/routes` | Backend route module-ууд |
| `server/storage` | Database access/storage module-ууд |
| `shared` | Shared schema, role, payroll calculator, validator |
| `migrations` | SQL migration файлууд |
| `script`, `scripts` | Seed, migration, verification, test script-үүд |
| `deliverables` | Гарын авлага, төлөвлөгөө, readiness document |
| `handover` | Хүлээлгэн өгөх document-ууд |

## Entry Point-ууд

- Frontend entry: `client/src/main.tsx`
- Frontend route: `client/src/App.tsx`
- Backend entry: `server/index.ts`
- Backend route бүртгэл: `server/routes.ts`
- Database connection: `server/db.ts`
- Shared schema: `shared/schema.ts`
- Navigation тохиргоо: `client/src/config/navigation.ts`

## Гол Command-ууд

```bash
npm run dev
npm run check
npm run build
npm run start
npm run db:migrate
npm run db:check
npm run check:env
npm run release:check
```

## Чухал Environment Variable-ууд

`.env.example` файлыг template болгон ашиглана. Production дээр хамгийн багадаа:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `DB_POOL_MAX`
- `APP_URL`
- `PUBLIC_BASE_URL`
- `CORS_ORIGIN`
- `FORCE_HTTPS`
- `SESSION_SECRET`
- `SESSION_HASH_SECRET`
- `QR_SECRET`
- `RATE_LIMIT_RESET_TOKEN`
- `UPLOAD_DIR`
- Email ашиглах бол SMTP тохиргоонууд.
- Google, weather, AI, QPay, eBarimt ашиглах бол тухайн key/config.

`.env` файлыг repo-д commit хийж болохгүй.

## Өндөр Ач Холбогдолтой Module-ууд

- Dashboard: `client/src/pages/Dashboard.tsx`, `client/src/components/dashboard`
- Employees/HR: `client/src/pages/Employees.tsx`, `server/routes/hr.ts`
- Attendance: `client/src/pages/Attendance.tsx`
- Payroll: `client/src/pages/Payroll.tsx`, `shared/payroll-calculator.ts`
- Requests: `client/src/pages/Requests.tsx`, `server/routes/requests.ts`
- Documents: `client/src/pages/Documents.tsx`, `server/routes/documents.ts`
- Inventory/products: `client/src/pages/Inventory.tsx`, `client/src/pages/Products.tsx`, `server/routes/inventory.ts`
- Purchase: `client/src/pages/Purchase.tsx`, `server/routes/inventory.ts`
- Workwear: `client/src/pages/admin/WorkwearManagement.tsx`, `client/src/pages/warehouse/WorkwearFulfillment.tsx`, `server/routes/workwear.ts`
- Canteen: `client/src/pages/canteen`, `server/routes/canteen.ts`
- Settings/RBAC: `client/src/pages/Settings.tsx`, `client/src/components/settings`, `server/route-permissions.ts`

## Шалгах Суурь Төлөв


Release хийхийн өмнө:

```bash
npm run release:check
```
