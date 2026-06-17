# MonERP QA and Regression Checklist

Last updated: 2026-06-17

This checklist turns the implementation plan into a repeatable release gate. A release is not ready until every critical flow below is either passed or explicitly recorded as a post-launch item.

## Screen Sizes

Check each critical page at:

- 360px mobile
- 768px tablet
- 1366px desktop

Acceptance criteria:

- No horizontal page overflow outside intentional table scrolling.
- Sidebar, mobile menu, top actions, dialogs, forms, and tables remain usable.
- Touch targets are comfortable on mobile.
- Empty, loading, validation, and error states are readable in Mongolian.

## Critical Workflows

| Area | Flow | Pass criteria |
| --- | --- | --- |
| Auth and access | Login, logout, session expiry, password change, 2FA | User lands on the correct page and cannot access protected routes after logout |
| RBAC | Admin, manager, warehouse, employee access | Navigation and API permissions match the role boundary |
| HR | Employees, departments, attendance, payroll | CRUD and status changes persist with tenant isolation |
| Requests | New request, approval inbox, status transition | Approval timeline, notifications, and permissions work end to end |
| Finance | Accounts, journals, journal entries, invoices, tax codes | Posted entries obey database integrity triggers |
| Sales and purchase | Sales, purchase, inventory movement | Totals, stock, and documents remain consistent |
| Reports | Dashboard and reports | Filters, export, and printed output are readable |
| Integrations | eBarimt, QPay, email, PDF/export | Sandbox or production credentials are confirmed before go-live |

## Release Evidence

Run these commands before UAT sign-off:

```bash
npm run check
npm run build
npm run check:env
npm run db:migrate
npm run db:check
```

For a single local gate after migrations are already applied:

```bash
npm run release:check
```

## Issue Severity

| Severity | Definition | Release decision |
| --- | --- | --- |
| Critical | Data loss, wrong financial posting, auth bypass, tenant data leak, app cannot start | Must fix before go-live |
| Major | Core workflow blocked or unreliable for a normal user | Must fix before go-live unless signed off |
| Minor | Visual polish, copy, low-risk edge behavior | Can move to post-launch backlog with owner |

## UAT Sign-Off

Record:

- UAT owner
- Go-live date
- Tested build/version
- Open issues by severity
- External credentials confirmed: production database, domain/SSL, SMTP, eBarimt, QPay, storage

