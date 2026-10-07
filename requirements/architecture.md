# MDARJ (Workora repo) — Living Architecture Map

Last updated: Oct 7, 2026 · after the architecture review · @trendow

This file shows how the system fits together **today**. Update it whenever a layer, module or flow changes.
`srs.md` = what · `decisions.md` = why · `workflow.md` = order · this file = how the pieces connect.

## 1. The machine today

```
Browser (one origin: the web app)
  │  page requests                      │  fetch('/api/...')  + mdarj_session cookie
  ▼                                     ▼
Next.js 16 (apps/web)                  Next.js rewrite  /api/:path*  →  http://localhost:4000/:path*
  ├── proxy.ts: picks the language only (ar/en). Does NOT check login.
  ├── (auth) pages: sign-up, login  → real API
  │                 forgot-password, set-password → views only
  └── (app) pages: shell, dashboard, exceptions → MOCK DATA, open without login
                                        │
                                        ▼
NestJS 12 (apps/api, port 4000)
  ├── 1. cookieParser            read the Cookie header
  ├── 2. sessionMiddleware       AUTHENTICATION + TENANCY
  │        token → SHA-256 → sessions row → live? user active?
  │        → req.auth = { sessionId, userId, companyId, role }
  │        → runInCompany(companyId)   (AsyncLocalStorage "badge")
  ├── 3. SessionGuard            enforces "must be logged in" (opt-in per route)
  ├── 4. (no RolesGuard yet)     AUTHORIZATION — MISSING
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
 → Response         (no global error filter yet)
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
| Auth (sign-up, login, me, logout) | Built + e2e tests | sign-up, login on real API | Integrated |
| Tenancy | Prisma extension + tests | — | Built |
| Authorization (roles) | — | dev-only role switcher (fake) | Missing |
| Audit log | — | — | Missing |
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

1. Authorization — permission matrix agreed (requirements/permissions.md, D-49…D-54); RolesGuard still missing (SCRUM-33) — before any Admin-only endpoint
2. API conventions (errors, lists, data fetching from Next.js) — before many endpoints
3. Login required by default (today each route must opt in)
4. ~~Child rows can point at another company's parent~~ — fixed by SCRUM-175: same-company foreign keys (D-48), proven by test/tenancy/related-rows.e2e-spec.ts
5. Audit log — before settings and salaries
6. Web app is not behind login; shell shows a mock user
7. CI
