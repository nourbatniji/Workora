# MDARJ (Workora repo) — Living Architecture Map

Last updated: Oct 9, 2026 · after SCRUM-169 · @trendow

This file shows how the system fits together **today**. Update it whenever a layer, module or flow changes.
`srs.md` = what · `decisions.md` = why · `workflow.md` = order · this file = how the pieces connect.

## 1. The machine today

```
Browser (one origin: the web app)
  │  page requests                      │  fetch('/api/...')  + mdarj_session cookie
  ▼                                     ▼
Next.js 16 (apps/web)                  Next.js rewrite  /api/:path*  →  http://localhost:4000/:path*
  ├── proxy.ts: picks the language (ar/en) and passes the asked path on. Does NOT check login.
  ├── (auth) pages: sign-up, login  → real API (login returns you to ?next=)
  │                 forgot-password, set-password → views only
  └── (app)/layout.tsx: THE LOGIN GATE, on the Next.js server (SCRUM-169, D-63)
         getSession() → API /auth/me with the forwarded cookie
         no session → /login?next=…  ·  expired → /login?reason=expired
         → shell with the real user, company and role; menu filtered by role; Log out
         dashboard, exceptions → still UI prototypes with mock data
                                        │
                                        ▼
NestJS 12 (apps/api, port 4000)
  ├── 1. cookieParser            read the Cookie header
  ├── 2. sessionMiddleware       AUTHENTICATION + TENANCY
  │        token → SHA-256 → sessions row → live? user active?
  │        → req.auth = { sessionId, userId, companyId, role, employeeId }
  │        → runInCompany(companyId)   (AsyncLocalStorage "badge")
  ├── 3. SessionGuard            global: "must be logged in" unless @Public() → 401
  ├── 4. RolesGuard              global AUTHORIZATION: @Roles(...) on the route, deny by default → 403
  ├── 5. ZodValidationPipe       VALIDATION with schemas from packages/shared
  ├── 6. AuthController          the only business controller
  ├── 7. AuthService             sign-up, login, me, logout
  └── 8. Prisma
         ├── PrismaService        plain client: sign-up, login lookup, sessions, seed
         └── TenantPrismaService  same client + tenancy extension:
                                  adds company_id to every query on company tables
                                        │
                                        ▼
PostgreSQL 17 (Docker Compose)
  └── same-company foreign keys (D-48): a row can only point at rows of its own company
```

## 2. Request pipeline (order of checks)

```
Request
 → Authentication   (sessionMiddleware)   who are you?
 → Tenant context   (sessionMiddleware)   which company?
 → Authorization    (MISSING)             may you do this?
 → Validation       (ZodValidationPipe)   is the input acceptable?
 → Controller                             which operation?
 → Service / business rules               is it allowed by Workora's rules?
 → Prisma + tenancy extension             read/write only this company's rows
 → PostgreSQL
 → Response         (errors: ApiExceptionFilter → { message, errors? })
```

## 3. Packages

| Package | Role | Talks to |
| --- | --- | --- |
| apps/web | Screens, forms, translations, shell | apps/api through the /api rewrite; packages/shared for zod schemas |
| apps/api | Rules, security, data | PostgreSQL through Prisma; packages/shared |
| packages/shared | zod schemas, phone normalising, error keys | used by both apps (built to dist/) |

## 4. Business modules (SRS 3.x)

| Module | API | Web | Status |
| --- | --- | --- | --- |
| Auth (sign-up, login, me, logout) | Built + e2e tests | sign-up, login, server-side gate, real user in the shell, logout | Integrated |
| Tenancy | Prisma extension + tests | — | Built |
| Authorization (roles) | — | dev-only role switcher (fake) | Missing |
| Audit log | `AuditService` + `audit_log` table (append-only trigger) + e2e tests; viewer endpoint after SCRUM-33 | — | Built (writer) |
| Users & invites | — | set-password view | Not started |
| Company settings | tables only | — | Not started |
| People (employees, salary, status, documents) | tables only | mock people data | Not started |
| Contracts | table only | mock dashboard card | Not started |
| Shifts / Roster / Holidays | — | — | Not started |
| Attendance / Exceptions | — | dashboard + inbox prototypes (mock) | UI prototype only |
| Leave | — | mock dashboard card | Not started |
| Payroll | — | mock progress in nav | Not started |
| Notifications, Dashboard, Reports | — | dashboard prototype (mock) | UI prototype only |

## 5. Known gaps (from the Oct 7 review)

1. ~~Authorization~~ — SCRUM-33: global SessionGuard + RolesGuard, deny by default (D-61); "own" checks with assertOwnEmployee (D-62); proven by test/auth/permissions.e2e-spec.ts
2. ~~API conventions~~ — written in requirements/api-conventions.md (D-55…D-57); every error now leaves as { message, errors? } (ApiExceptionFilter); raw SQL refused on the company-scoped client
3. ~~Login required by default~~ — SCRUM-33: only @Public() routes skip the session check
4. ~~Child rows can point at another company's parent~~ — fixed by SCRUM-175: same-company foreign keys (D-48), proven by test/tenancy/related-rows.e2e-spec.ts
5. ~~Audit log~~ — SCRUM-26: `AuditService.record(tx, userId, entry)` writes in the same transaction as the change; the database refuses UPDATE and DELETE (D-58…D-60). The `GET /audit-log` viewer waits for the role guard (SCRUM-33)
6. ~~Web app is not behind login~~ — SCRUM-169: the (app) layout checks the session on the server; the shell shows the real user; logout works
7. ~~CI~~ — SCRUM-168: every pull request runs format, lint, typecheck, raw-SQL check, migrations on an empty database, schema-vs-migrations check, unit and e2e tests and both builds; `main` is protected
