## Энэ Багцад Юу Байгаа Вэ

| Файл | Зориулалт |
| --- | --- |
| `TECHNICAL_OVERVIEW.md` | Системийн бүтэц, хавтас, command, environment, integration |
| `DEPLOYMENT_RUNBOOK.md` | Production дээр байрлуулах, rollback хийх дараалал |
| `DATABASE_AND_DATA.md` | Database, migration, seed, import, backup |
| `PERMISSIONS_AND_ROLES.md` | Role болон permission-ийн зохион байгуулалт |
| `BUSINESS_WORKFLOWS.md` | Гол бизнес workflow-уудыг цэсээр тайлбарласан |
| `ACCEPTANCE_CHECKLIST.md` | Хүлээлгэн өгөх, UAT, go-live checklist |
| `KNOWN_ISSUES_AND_NEXT_STEPS.md` | Мэдэгдэж байгаа эрсдэл, дараагийн хийх ажлууд |

## Хамт Хавсаргах Материалууд

- `deliverables/MonERP_Page_By_Page_User_Guide.pdf`
- `deliverables/MonERP_Page_By_Page_User_Guide_UPDATED.pdf`
- `deliverables/MonERP_Production_Readiness.md`
- `deliverables/MonERP_QA_Regression_Checklist.md`
- `deliverables/MonERP_Implementation_Plan.pdf`
- `MonERP_Presentation.pptx`

## Хүлээлгэн Өгөх Санал Болгож Буй Дараалал

1. Admin хэрэглэгчээр системийг хамт нээж харуулах.
2. Employee хэрэглэгчээр системийг хамт нээж харуулах.
3. Admin, HR, Нягтлан, Нярав, Employee эрхүүдийн ялгааг тайлбарлах.
4. `.env.example` дээрх production тохиргоонуудыг тайлбарлах.
5. Deploy хийх command, rollback хийх аргыг тайлбарлах.
6. Database migration, seed, backup/restore процессийг тайлбарлах.
7. Мэдэгдэж байгаа асуудал болон дараагийн backlog-ийг танилцуулах.
8. Repository, server, database, domain/DNS, email, payment/tax integration, backup storage-ийн access-ийг шилжүүлэх.

## Дараагийн Хөгжүүлэгчийн Эхний Command-ууд

```bash
npm install
npm run check
npm run build
npm run db:migrate
npm run db:check
npm run dev
```

Production дээр:

```bash
npm run build
npm run db:migrate
npm run db:check
npm run start
```

## Эдгээрийг Хийгээгүй Бол Хүлээлгэн Өгөхгүй

- Demo/test хэрэглэгчийн нууц үгийг солих эсвэл устгах.
- `.env` доторх нууц мэдээлэл repo-д commit хийгдээгүйг шалгах.
- Production database backup байгаа эсэхийг шалгах.
- `UPLOAD_DIR` нь persistent бөгөөд backup-т ордог зам эсэхийг шалгах.
- `npm run check`, `npm run build` амжилттай явж байгааг баталгаажуулах.
- Дуусаагүй асуудлуудыг жагсааж, хариуцах эзэн оноох.
