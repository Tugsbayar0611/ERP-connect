# MonERP Production Readiness

Last updated: 2026-06-17

## Current Engineering Status

- TypeScript check: passed.
- Production build: passed.
- Environment sanity check: passed for the current development environment.
- Database migration run: completed.
- Database readiness check: passed after accounting trigger migrations were applied.

## Go-Live Gate

Before production deployment, confirm:

| Gate | Required state |
| --- | --- |
| Environment | `NODE_ENV=production`, strong secrets, public `APP_URL`, `PUBLIC_BASE_URL`, specific `CORS_ORIGIN` |
| Database | Latest migrations applied and `npm run db:check` passes |
| Storage | `UPLOAD_DIR` points to a persistent backed-up volume |
| Email | SMTP credentials tested with the production sender |
| Integrations | eBarimt and QPay credentials verified for the target tenant |
| Domain and SSL | Production domain resolves and TLS certificate is active |
| Backup | Database and upload backup schedule is tested |
| Rollback | Previous release artifact and database rollback procedure are documented |
| Smoke test | Login, dashboard, requests, finance, PDF/export, and API health pass |

## Deployment Runbook

1. Freeze release scope and record open low-priority items in the post-launch backlog.
2. Back up the production database and uploads volume.
3. Set production environment variables from `.env.example`.
4. Install dependencies using the locked package file.
5. Run `npm run build`.
6. Run `npm run db:migrate`.
7. Run `npm run db:check`.
8. Start the production server with `npm run start`.
9. Run smoke tests for login, dashboard, critical forms, PDF/export, and integrations.
10. Keep hypercare monitoring active after go-live.

## Customer Inputs Still Required

- Production server, domain, SSL, and database access.
- Production eBarimt, QPay, email/SMS credentials.
- Named UAT sign-off owner.
- Final go-live date approval.

