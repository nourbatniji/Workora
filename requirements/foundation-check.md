# MDARJ (Workora) — Foundation Check

SCRUM-176 · FND-13 · Oct 9, 2026 · @trendow · Result: **Passed**, with two gaps fixed in this task

## Why this file exists

The next features handle salaries, settings and personal data. Before they start, every part of the foundation must be proven to work — by code, a test run or a document, not by memory. This file is that proof. From here on, a user-facing story is Done only when it works end to end: Next.js screen → real API → login → role → business logic → database → updated screen, with tests.

**Proof used:** the code on `main` at commit `14a8eb1` (after PR #19), and its CI run, which ran every check on a fresh computer with an empty database: <https://github.com/nourbatniji/Workora/actions/runs/37970650455> (success).

## The 20 checks

| # | Check (from SCRUM-176) | Evidence | Result |
| --- | --- | --- | --- |
| 1 | Architecture documentation matches the code | `requirements/architecture.md`, updated with each task (SCRUM-26, 33, 169) | ✅ |
| 2 | Database foundation reviewed against the SRS | Table-by-table review below; two SRS rows were behind the code and are fixed in SRS v1.6 | ✅ after fix |
| 3 | Authentication works: login, session, expiry, logout | `apps/api/test/auth/login.e2e-spec.ts` (10 tests), `sign-up.e2e-spec.ts` (3); SCRUM-169 manual script steps 1–7 | ✅ |
| 4 | Private NestJS endpoints are protected by default | Global `SessionGuard` + `RolesGuard` (`apps/api/src/app.module.ts`), deny by default (D-61); `test/auth/permissions.e2e-spec.ts` "private by default" and "deny by default" | ✅ |
| 5 | Direct-row company isolation tests pass | `test/tenancy/tenancy.e2e-spec.ts` (12 tests) | ✅ |
| 6 | Linked-row company isolation tests pass (SCRUM-175) | `test/tenancy/related-rows.e2e-spec.ts` (15 tests) | ✅ |
| 7 | Cross-company relationships cannot bypass isolation | Same-company foreign keys on every link (D-48), proven by `related-rows.e2e-spec.ts`; audit rows refuse a user of another company (`test/audit/audit.e2e-spec.ts`) | ✅ |
| 8 | Raw-SQL policy documented and enforced (SCRUM-167, 168) | `api-conventions.md` §8; the company client refuses raw SQL (`test/tenancy/raw-sql.e2e-spec.ts`, 8 tests); CI step "No raw SQL" (`scripts/check-raw-sql.sh`) | ✅ |
| 9 | Permission matrix approved (SCRUM-166) | `requirements/permissions.md`, status Agreed, D-49…D-54 | ✅ |
| 10 | Backend authorization implemented and tested (SCRUM-33) | `RolesGuard`, `@Roles`, `assertOwnEmployee`; `permissions.e2e-spec.ts` (13 tests) | ✅ |
| 11 | 401 vs 403 behaviour correct | No session → 401 `notLoggedIn`; wrong role or someone else's record → 403 `forbidden`; another company's record → 404 (D-57). Tested in `permissions.e2e-spec.ts` and `test/api/errors.e2e-spec.ts` | ✅ |
| 12 | API conventions documented and applied (SCRUM-167) | `api-conventions.md` (Agreed, D-55…D-57); one error shape via `ApiExceptionFilter`, proven by `errors.e2e-spec.ts` (7 tests) | ✅ |
| 13 | The Next.js app is behind login (SCRUM-169) | `apps/web/src/app/[locale]/(app)/layout.tsx` checks the session on the server (D-63); SCRUM-169 manual script, 9 of 9 steps passed | ✅ |
| 14 | Mock/prototype UI clearly separated from real features | The dashboard and exceptions inbox now show a "UI prototype · sample data" badge; the shell's user and company come from the API; `mock/shell.ts` holds only prototype data | ✅ after fix |
| 15 | Lint passes | CI run above, step "Lint" | ✅ |
| 16 | Type-check passes | CI run above, step "Typecheck" (shared, api, web) | ✅ |
| 17 | Automated tests pass | CI run above: unit tests (8) and e2e tests (76 in 9 files) against a fresh PostgreSQL | ✅ |
| 18 | Build passes | CI run above, steps "Build the API" and "Build the web app" | ✅ |
| 19 | Audit log ready for the first audited feature (SCRUM-26) | `AuditService.record(tx, userId, entry)`; append-only trigger; `audit.e2e-spec.ts` (7 tests); CI also checks the schema matches the migrations | ✅ |
| 20 | Jira matches the code | SCRUM-20…22, 26, 27, 28, 31, 33, 36, 37, 38, 146…149, 166…169, 175 are Done and merged; Sprint 2 re-ranked by dependency on Oct 9 (`workflow.md` sync log) | ✅ |

## Database review against SRS §5

| Table | Matches the SRS? | Note |
| --- | --- | --- |
| companies | ✅ | Also has address and phone, used by the company profile (CS-03) |
| company\_settings\_versions | ✅ | Overtime multipliers are four columns (day, night, rest day, holiday); `rest_days` added for CS-04 |
| users | ✅ | |
| sessions | ✅ | Not listed in SRS §5; specified by D-24 |
| job\_titles | ✅ | |
| employees | ✅ | `candidate_id` comes with recruitment in MVP-2 (D-42), on purpose |
| employee\_status\_history | ✅ | |
| salary\_history | ✅ | |
| documents | Fixed in SRS v1.6 | The SRS still said `owner_type` + `owner_id`; the table uses `employee_id` since D-47 |
| contracts | ✅ | |
| audit\_log | Fixed in SRS v1.6 | The SRS said `entity`; the table has `company_id`, `entity_type`, `reason` and is append-only (D-58…D-60) |

Every company-owned table has `company_id`, is listed in `COMPANY_TABLES` (a unit test compares the list with `schema.prisma`), and links to other company rows through same-company foreign keys (D-48).

## Gaps found and fixed in this task

1. **SRS data model behind the code** → `srs.md` v1.6: the `documents` and `audit_log` rows now match the tables.
2. **Prototype screens not labelled** → `PrototypeBadge` on the dashboard and the exceptions inbox; the dashboard subtitle uses the real company name instead of the mock "Nile Bakeries".

## Known limits, planned elsewhere (not gaps in the foundation)

| Limit | Planned in |
| --- | --- |
| No automated browser tests for the web app (manual scripts for now) | A Playwright task before the employee screens |
| The app's database user owns the tables, so in theory it could drop the audit trigger | Stage 11 security review; stage 12 staging (separate database roles, backups) |
| Email, file storage and background jobs | FND-05, FND-06, FND-04, each built just before the first feature that needs it |
