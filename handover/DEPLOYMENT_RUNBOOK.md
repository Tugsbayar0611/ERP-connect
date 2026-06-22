# Production Байршуулах Заавар

## Production Орчны Урьдчилсан Шаардлага

- Server access бэлэн байх.
- PostgreSQL database үүссэн байх.
- Domain болон DNS production server рүү заасан байх.
- HTTPS certificate идэвхтэй байх.
- `.env` файлыг `.env.example`-оос үүсгэсэн байх.
- `UPLOAD_DIR` нь source code дотор биш, persistent бөгөөд backup хийгддэг storage зам байх.
- SMTP, eBarimt, QPay, Google OAuth, weather, AI credential-ууд шаардлагатай бол бэлэн байх.
- Анхны Admin хэрэглэгч болон RBAC seed процесс баталгаажсан байх.

## Анхны Production Deploy

1. Production server дээр repository-г clone хийх.
2. Production `.env` үүсгэх.
3. Dependency суулгах:

```bash
npm install
```

4. Build хийх:

```bash
npm run build
```

5. Migration ажиллуулах:

```bash
npm run db:migrate
```

6. Database readiness шалгах:

```bash
npm run db:check
```

7. Шаардлагатай бол RBAC seed хийх:

```bash
npm run seed:rbac
```

8. Admin хэрэглэгч үүсгэх эсвэл шалгах:

```bash
npm run seed:admin
npm run check:admin
```

9. Production server асаах:

```bash
npm run start
```

10. Smoke test хийх.

## Энгийн Release Deploy

1. Release хийх хугацааг урьдчилж мэдэгдэх.
2. Database болон uploads backup авах.
3. Шинэ release-г pull хийх.
4. `package-lock.json` өөрчлөгдсөн бол dependency шинэчлэх.
5. Дараах command-уудыг ажиллуулах:

```bash
npm run check
npm run build
npm run db:migrate
npm run db:check
```

6. Production process restart хийх.
7. Гол workflow-уудыг smoke test хийх.
8. Эхний ажлын өдөр log-ийг ойрхон хянах.

## Smoke Test Checklist

- Login/logout ажиллаж байгаа эсэх.
- Admin dashboard нээгдэж байгаа эсэх.
- Employee хэрэглэгч admin-only хуудас руу орж чадахгүй байгаа эсэх.
- Ажилтны жагсаалт ачаалж байгаа эсэх.
- Ирцийн хуудас болон гар бүртгэл ажиллаж байгаа эсэх.
- Payroll хуудас нээгдэж, нэг test calculation шалгаж болох эсэх.
- Products болон inventory ачаалж байгаа эсэх.
- Purchase order supplier, warehouse, product, quantity, price-тэй үүсэж байгаа эсэх.
- Purchase receive хийхэд агуулахын үлдэгдэл зөв нэмэгдэж байгаа эсэх.
- Workwear entitlement/issue flow Warehouse/Нярав эрхээр ажиллаж байгаа эсэх.
- Documents жагсаалт нээгдэж байгаа эсэх.
- PDF/export ажиллаж байгаа эсэх.

## Rollback Хийх Дараалал

Rollback-ийг release хийхээс өмнө төлөвлөсөн байх ёстой.

1. Одоогийн process-ийг зогсоох.
2. Өмнөх application build эсвэл өмнөх git release рүү буцах.
3. Migration/data өөрчлөлтөөс blocking issue үүссэн бол pre-release database backup-аас restore хийх.
4. Файл эвдэрсэн/устсан бол uploads volume restore хийх.
5. Өмнөх release-г асаах.
6. Smoke test хийх.
7. Incident болон root cause-г бичиж үлдээх.

## Process Manager

Repo нь заавал нэг process manager тулгаагүй. Хүлээн авах баг PM2, systemd, Docker эсвэл өөр standard tool ашиглаж болно.

Аль аргыг сонгосноо дараах байдлаар баримтжуулна:

- Start command.
- Restart command.
- Log path.
- Environment file path.
- Server user.
- Backup schedule.
