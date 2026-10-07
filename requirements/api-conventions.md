# MDARJ (Workora) — API Conventions

SCRUM-167 · FND-10 · Oct 7, 2026 · @trendow · Status: **Proposed — waiting for Trendow (D-55, D-56, D-57)**

## 1. Why this file exists

Every module (settings, employees, leave, payroll…) adds endpoints. If each one names URLs, shapes errors and pages lists its own way, the web app needs special code for every screen and mistakes slip through. These rules make every endpoint look, behave and fail the same way. New endpoints follow them; reviews check them.

Related files: `permissions.md` (who may do what), `decisions.md` (D-24 sessions, D-25 tenancy, D-28 money, D-29 dates, D-30 shared validation, D-44 error keys, D-55…D-57 below).

## 2. What happens to every request (order)

```
Request
 → cookieParser + sessionMiddleware   who is this? which company?   (D-24, D-25)
 → guards                             logged in? right role?        (permissions.md, SCRUM-33)
 → validation pipe                    is the input acceptable?      (zod schema from packages/shared)
 → controller                         which operation?
 → service                            business rules, "own data" checks
 → TenantPrismaService                only this company's rows; no raw SQL
 → PostgreSQL                         same-company foreign keys    (D-48)
 → response, or an error → ApiExceptionFilter → { message, errors? }
```

## 3. URLs and HTTP methods

| Rule | Example |
| --- | --- |
| Plural nouns for resources, lowercase, kebab-case | `/employees`, `/job-titles`, `/leave-requests` |
| One record by id | `/employees/:id` |
| Nest a resource only when it cannot exist without its parent | `/employees/:id/documents`, `/employees/:id/salary-history` |
| An action that is not create/read/update/delete is a POST on a verb under the record | `POST /leave-requests/:id/approve`, `POST /payroll-runs/:id/reopen` |
| Auth actions live under `/auth` | `/auth/login`, `/auth/logout`, `/auth/me` |
| No version prefix in the MVP (the web app is the only client) | — |
| The browser calls `/api/...`; Next.js forwards it to the API without `/api` | browser `/api/employees` → API `/employees` |

| Method | Use | Success code |
| --- | --- | --- |
| GET | Read one record or a list | 200 |
| POST | Create a record, or run an action | 201 (created) · 200 (action with a result) · 204 (action with nothing to return) |
| PATCH | Change some fields of a record | 200 |
| DELETE | Delete a record (only where the SRS allows it, e.g. FR-EM-11, FR-RC-10) | 204 |

PUT is not used. History tables (salary, status, settings versions) are never edited: a change is a new row (POST).

## 4. Requests

- **Validation:** every body, query and route parameter is checked by a zod schema from `packages/shared` (D-30), applied with `ZodValidationPipe`. The web form uses the same schema before sending.
- **Unknown fields are dropped.** A client cannot add fields the schema does not know.
- **Never accept `companyId` from the client** — not in the body, the query or the URL. The company always comes from the session (D-25). (Proven: a `companyId` in the sign-up body is ignored.)
- **Ids** are UUIDs; a route `:id` that is not a UUID → 400.
- **JSON keys** are camelCase (`hireDate`, `jobTitleId`).
- **Dates:** a calendar date is `"2026-10-07"`; a moment in time is ISO UTC `"2026-10-07T16:34:05.000Z"` (D-29).
- **Money** is a string with 2 decimals, `"9000.00"`, never a JavaScript number (D-28).

## 5. Responses

| Case | Body |
| --- | --- |
| One record | The record itself: `{ "id": "…", "nameEn": "…" }` |
| A list | `{ "items": [ … ], "total": 37, "page": 1, "pageSize": 20 }` |
| Create | 201 with the created record |
| Action with nothing to return, delete | 204, no body |
| Auth | `{ "user": { … } }` (existing endpoints, kept as they are) |

Responses never contain password hashes, token hashes, invite tokens or another company's data. Fields a role may not see (for example the disability field for Employees, D-04) are removed in the service, not hidden in the UI.

## 6. Errors

**Every** error has the same body, produced by `ApiExceptionFilter` (`apps/api/src/common/api-exception.filter.ts`):

```json
{ "message": "validationFailed", "errors": { "email": "emailInvalid" } }
```

- `message` is always a **key** the web app translates into Arabic or English (D-44), never a sentence.
- `errors` appears only for validation: one key per field.
- Unknown errors become `500 { "message": "internalError" }`. The details are logged on the server (method, URL, company id, stack) and never sent to the browser.

| Status | When | Default key |
| --- | --- | --- |
| 400 | Invalid input (`validationFailed` with `errors`), broken JSON, a link to a row that is not in this company (`invalidReference`, Prisma P2003) | `badRequest` |
| 401 | No session, or the session expired | `notLoggedIn` · `sessionExpired` |
| 403 | Logged in, but this role or this person may not do it | `forbidden` (or a specific key such as `accountDeactivated`) |
| 404 | No such route, or no such record **in this company** (Prisma P2025) | `notFound` |
| 409 | Conflicts with existing data (Prisma P2002, e.g. a used email) | `conflict` (or a specific key such as `emailTaken`) |
| 500 | Our bug or an outage | `internalError` |

**D-57 — another company's record vs. not allowed:** a record of another company is answered with **404**, as if it did not exist (tenancy hides it, and we never reveal that an id exists elsewhere). A record of the same company that this user may not touch (an Employee asking for a colleague's payslip) is answered with **403 `forbidden`**.

Specific keys used so far: `validationFailed`, `required`, `tooLong`, `emailInvalid`, `phoneInvalid`, `passwordTooShort`, `languageInvalid`, `emailTaken`, `invalidCredentials`, `accountDeactivated`, `notLoggedIn`, `sessionExpired`. A new key is added to `apps/web/messages/en.json` and `ar.json` in the same pull request.

## 7. Lists: pagination, filters, sorting, search

| Query parameter | Meaning | Default / limit |
| --- | --- | --- |
| `page` | Page number, from 1 | 1 |
| `pageSize` | Rows per page | 20, max 100 |
| `sort` | Field name; a leading `-` means descending: `sort=-hireDate` | Each endpoint lists the fields it allows and its default |
| `q` | Free-text search, on the fields the endpoint names | — |
| any filter | One parameter per field, comma for several values: `status=active,suspended&employmentType=trainee` | — |

The query is validated by a zod schema like any body. A sort or filter field the endpoint does not allow → 400.

## 8. Data access and tenancy

- **Modules use `TenantPrismaService.db` only.** It adds the company to every query (D-25) and refuses raw SQL.
- **`PrismaService` (the plain client)** is for system work only: sign-up, the login lookup, sessions, seed and scheduled jobs. Using it in a business module needs a comment saying why and a cross-company test.
- **Raw SQL is not allowed in modules:** `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe`, `$queryRawTyped`. They skip the tenancy guard and would see every company's rows.
  - Enforced: the company-scoped client throws on these methods, inside transactions too (`test/tenancy/raw-sql.e2e-spec.ts`).
  - Enforced in CI (SCRUM-168): a search fails the build when a raw method appears in `apps/api/src` outside `src/prisma/`.
  - If a report ever truly needs raw SQL, it lives in `src/prisma/`, filters by `company_id` from `requireCompanyId()`, and has a cross-company test.
- **Links between company rows** are checked by the database (D-48). Pointing at another company's row → 400 `invalidReference`.

## 9. Authentication and authorization

| Rule | Where |
| --- | --- |
| Every route needs a session, unless marked `@Public()` (only sign-up and login) | Global guard — SCRUM-33. Until then each private route uses `@UseGuards(SessionGuard)` |
| Role rules come from `permissions.md`: "Admin only" → `@Roles('admin')` on the route | RolesGuard — SCRUM-33 |
| "own" rules (an Employee and their own records) are checked in the **service**, with the session's user | Each feature |
| Data rules (last Active Admin, payslip only after approval…) are checked in the service | Each feature (`permissions.md`, "Rules that are not role checks") |
| No session → 401. Wrong role or not their own → 403. Hiding a button in Next.js never replaces a server check | All endpoints |

## 10. How Next.js talks to the API (D-56)

| Where the code runs | How it calls the API | The session cookie |
| --- | --- | --- |
| **Browser** (client components, forms) | `fetch('/api/...')` through the helpers in `apps/web/src/lib/api.ts` | Sent automatically by the browser (same address, httpOnly cookie) |
| **Next.js server** (layouts, server components, the login gate in SCRUM-169) | Directly to `API_URL` (`http://localhost:4000` locally) | Forwarded on purpose: read the incoming `cookie` header and pass it on. A server helper is added in SCRUM-169 |

- JavaScript never reads or stores the session token (httpOnly, D-24).
- Every call handles the error body of §6 the same way: show the translated `message`, and each `errors` key next to its field.
- Mock data is allowed only in screens labelled "UI prototype" (SCRUM-146/147/148) and is removed when the feature's API exists.

## 11. API documentation (D-55)

No Swagger / OpenAPI in the MVP. The contract is the shared zod schemas in `packages/shared` (both sides import them, so they cannot drift) plus this file and the endpoint list below. Reconsider when a second client (mobile app, integrations) needs the API.

## 12. Existing endpoints (checked against these rules)

| Method | Path | Access | Success | Errors | Follows the rules? |
| --- | --- | --- | --- | --- | --- |
| POST | `/auth/sign-up` | Public | 201 `{ company, user }` | 400 `validationFailed`, 409 `emailTaken` | Yes |
| POST | `/auth/login` | Public | 200 `{ user }` + httpOnly cookie | 400 `validationFailed`, 401 `invalidCredentials`, 403 `accountDeactivated` | Yes |
| GET | `/auth/me` | Logged in, any role | 200 `{ user }` | 401 `notLoggedIn` / `sessionExpired` | Yes |
| POST | `/auth/logout` | Logged in, any role | 204 | 401 | Yes |
| GET | `/` | Public | "Hello World!" | — | Starter route from the Nest template; to be removed in SCRUM-33 when routes become private by default |

Before Oct 7 the 404 for an unknown route and crashes used Nest's own body (`{ statusCode, message: "Cannot GET …" }`). `ApiExceptionFilter` fixed this (`test/api/errors.e2e-spec.ts`).

## 13. Checklist for a new endpoint

- [ ] URL and method follow §3
- [ ] Body, query and params validated by a shared zod schema (§4)
- [ ] No `companyId` accepted from the client
- [ ] Success and list shapes follow §5 and §7
- [ ] Errors use keys; new keys added to `en.json` and `ar.json` (§6)
- [ ] Uses `TenantPrismaService.db`, no raw SQL (§8)
- [ ] Access matches `permissions.md`: `@Roles` for role rules, service checks for "own" and data rules (§9)
- [ ] Tests: happy path, invalid input (400), not logged in (401), wrong role (403), another company's record (404)
- [ ] Added to the endpoint list in §12
