# MDARJ HR & Payroll — Development Workflow

Agreed Oct 7, 2026 · @trendow · Applies to all work from now on.

This file says **how** we build and **in what order**. `srs.md` says what, `decisions.md` says why, `development-plan.md` holds the architecture and test plan. When this file and the old sprint table in `development-plan.md` §3 disagree on order, this file wins.

## 1. The 15-stage lifecycle, and where we are (Oct 7, 2026)

| # | Stage | Status | What exists | Gap to close |
| --- | --- | --- | --- | --- |
| 1 | SRS / Requirements | Done | `srs.md` v1.5, `decisions.md` D-01…D-46, `assumptions.md` | Keep in sync: decision → SRS → Jira → code |
| 2 | Epics + User Stories | Done, reorganised Oct 7 | Jira project HR-System (SCRUM): 16 epics, 170 issues | Dependencies added as "blocks" links; UI tasks now built inside their feature (see §5) |
| 3 | Architecture | Done | `development-plan.md` §2, D-21…D-36 | — |
| 4 | ERD / Database design | Done for what is built | SRS §5 data model; `schema.prisma` has companies, settings versions, users, job titles, employees, salary history, status history, documents, contracts, sessions. Other tables are added by the task that first uses them (D-42) | Design each new module's tables at the start of its feature (you draft, then compare with SRS §5) |
| 5 | Roles + Permissions + API design | Designed, guard not built | `permissions.md` (D-49…D-54), `api-conventions.md` (error filter, raw-SQL refusal), `api-endpoints.md` (127 endpoints, 6 jobs; each story's endpoints are in its Jira description) | Role guard (SCRUM-33) |
| 6 | Project foundation | Done for the MVP start | pnpm workspace, NestJS, Next.js, Prisma + PostgreSQL, tenancy guard + isolation test, next-intl RTL shell, 360 px layout, CI on every PR with `main` protected (SCRUM-168), audit writer + append-only `audit_log` (SCRUM-26) | Files (FND-06), email (FND-05) and jobs (FND-04) are built just before the first feature that needs them |
| 7 | Authentication | Backend done, web half done | Sign-up, login (email or phone), sessions, `/auth/me`, logout, e2e tests; login and sign-up pages call the API (SCRUM-149 branch) | Role guard (UA-05); the web app does not check the session yet (app pages open without login, no logout button); invites + set password (UA-01/02); password reset (UA-04) |
| 8 | Application shell / shared UI | Done as views | App shell, nav, top bar, command palette, UI kit (SCRUM-146); dashboard and exceptions inbox with mock data (SCRUM-147/148) | Shell must read the real user and role from `/auth/me`. The mock dashboard and inbox stay as UI prototypes and get wired in their own features |
| 9 | Feature-by-feature development | Not started | — | Order in §4 |
| 10 | Integration testing | Per feature from now | Tenancy and auth e2e tests | Every feature ends with its own integration test; QA-01/QA-02 become final sweeps |
| 11 | Security / performance review | Later | — | QA-03, permission sweep, signed links, session expiry |
| 12 | Staging | Not planned yet | — | Needs the hosting choice (A-36) |
| 13 | QA / acceptance testing | Planned | QA epic | UAT with one sample company |
| 14 | Production | Not planned yet | — | Release checklist |
| 15 | Monitoring + maintenance | Not planned yet | QA-06 backups only | Error logging, uptime check, backup restore drill |

## 2. How one feature is built (vertical slice)

A feature is one Jira story (usually one FR). It goes top to bottom before the next one starts:

| Step | Where in the repo | Done when |
| --- | --- | --- |
| 1. Requirement + acceptance criteria | Jira story "Done when", SRS FR/BR IDs | Criteria are testable |
| 2. Database changes | `apps/api/prisma/schema.prisma` + migration; `COMPANY_TABLES` if it has `company_id` | Migration runs on an empty DB |
| 3. NestJS module | `apps/api/src/modules/<name>/` | Module registered in `AppModule` |
| 4. Service / business logic | `<name>.service.ts`; pure rules in `apps/api/src/domain/` | Rules have unit tests |
| 5. REST API / controller | `<name>.controller.ts`; zod schema in `packages/shared` | Follows the API conventions |
| 6. Authentication & authorization | `@Roles(...)` on each route, own-data checks | Matches the permission matrix |
| 7. Backend tests | `apps/api/test/<name>/` | Happy path, validation, wrong role, other company |
| 8. Next.js UI | `apps/web/src/app/[locale]/(app)/...`, `components/<name>/` | Arabic + English, 360 px |
| 9. API integration | `apps/web/src/lib/api.ts` | Real data, no mock |
| 10. Validation / error handling | shared zod schema + message keys (D-44) | Every API error has a translated message |
| 11. Full feature test | e2e or manual script in the PR | Whole flow works from the browser |
| 12. Jira acceptance criteria verified | Jira | Each "Done when" checked → Done |

Not every story needs every step (job titles need no business logic). Skip a step only on purpose.

## 3. How Jira is organised

- **Epic** = a feature area (SRS section): Employees, Leave, Payroll…
- **Story** = one user-facing feature with its SRS ID and "Done when" criteria.
- **Sub-tasks** are added when a story moves to In Progress, only for layers with real work, normally: `DB`, `API + permissions`, `UI + integration`, `Tests`. Small stories keep these as a checklist in the description instead.
- **UI tasks** (`UI: … (screens on the real API)`) are the Next.js step of the stories they cover. They are built after those stories' API works, inside the same feature, not as a separate frontend track.
- **Dependencies** are "is blocked by" links, so the board shows why a story waits.
- A story is Done only after step 12 above and the definition of done in `development-plan.md` §6.
- When code and Jira disagree, check the code and git history, then fix whichever is wrong.

## 4. Build order (dependency-driven)

| Order | Work | Stage | Why now |
| --- | --- | --- | --- |
| 0 | Finish SCRUM-149 (auth pages) and merge | 7 | Already in progress; don't leave a branch open |
| 1 | Permission matrix + API conventions (new) | 5 | Every endpoint from here on needs a role rule and the same request/response shape |
| 2 | CI on GitHub Actions (new) | 6 | Tests only protect us if they run on every PR |
| 3 | FND-07 Audit log | 6 | Salaries, settings and approvals must be audited from their first line of code |
| 4 | UA-05 Role guard + permission test helper | 7 | Admin-only endpoints (settings, employees) start next |
| 5 | Web session gate: protect app pages, shell reads `/auth/me`, logout (new) | 7–8 | Real features need a real logged-in user in the browser |
| 6 | FND-05 Email (Mailpit) → UA-01/02 invites + set password → UA-04 reset → UA-07 + FR-UA-9 several Admins | 7 | Employees can only get in through invites |
| 7 | Company settings: CS-09 job titles, CS-03 profile, CS-04 work week, CS-05 payroll settings + CS-08 effective dating, CS-06, CS-07, then CS-02 wizard | 9 | Every later module reads settings; employees need job titles. The wizard comes last because it reuses the step forms |
| 8 | Employees: EM-01–04, EM-07 + UA-06, FND-06 files → EM-06, EM-08, EM-09, EM-05, EM-10 | 9 | Contracts, shifts, leave, attendance and payroll all hang off the employee |
| 9 | Contracts CT-01–04 | 9 | Needs employees and files |
| 10 | Public holidays PH-01–03 | 9 | The roster and leave day counts skip holidays |
| 11 | FND-04 jobs (Redis) → Shifts SH-01, 02, 04, 05, 06, 07 | 9 | Attendance compares punches with the roster |
| 12 | Notification centre core (first part of DB-03) | 9 | Leave sends the first notifications |
| 13 | Leave LV-01–10 (law reference data seeded here) | 9 | Attendance labels "On leave"; exceptions convert to leave; payroll deducts unpaid leave |
| 14 | Attendance AT-01–08, PH-04 | 9 | Exceptions are created from attendance labels |
| 15 | Exceptions EX-01–08 | 9 | Payroll lines come from approved exceptions |
| 16 | Payroll PR-01–10 | 9 | Needs all of the above |
| 17 | Dashboards DB-01, DB-02, rest of DB-03, audit viewer (FR-DB-4) | 9 | They only summarise data that now exists |
| 18 | QA-01–05 sweeps, security and performance review | 10–11 | Whole-system checks before the release |
| 19 | Staging, UAT, production, monitoring (new OPS work) | 12–15 | After the MVP is feature-complete |
| MVP-2 | Recruitment (RC), AI compliance (AI), CT-05 | 9 | Nov 16 release (SRS 1.6) |

## 5. Jira sync log

### Oct 7, 2026

Created:
- SCRUM-166 UA-11 Write the permission matrix (Sprint 1)
- SCRUM-167 FND-10 Write the API conventions (Sprint 1)
- SCRUM-168 FND-11 CI on every pull request (Sprint 1)
- SCRUM-169 UA-12 Keep the web app behind login (Sprint 2)
- SCRUM-170 DB-03a Notification centre core (Sprint 3, split from DB-03)
- SCRUM-171 OPS · Release & operations (epic)
- SCRUM-172 OPS-01 Staging environment (Sprint 6)
- SCRUM-173 OPS-02 Release the MVP to production (Sprint 6)
- SCRUM-174 OPS-03 Error logging and uptime monitoring (Sprint 6)

Synced with the code:
- SCRUM-88, SCRUM-90, SCRUM-92, SCRUM-133 moved from In Progress to To Do: only mock screens exist
- SCRUM-47 EM-00 moved to Done: decided as D-04, column already in the schema
- SCRUM-149 comment: login and sign-up use the real API; forgot and set password are views; branch not merged yet

Reordered by dependency:
- Sprint 1 now ends with: permission matrix, API conventions, CI, audit log
- FND-05 email, FND-06 files, UA-01, UA-02, UI users and invites, UI audit log moved to Sprint 2; UA-10 added to Sprint 2
- FND-04 jobs moved to Sprint 3 (just before SH-04)
- AI-04 law reference moved from Sprint 6 to Sprint 3 (LV-02 needs it)
- Sprint 2 ranked: UA-05 → UA-12 → FND-05 → UA-01 → UA-02 → UI users → UA-04 → UA-07 → UA-10 → CS-09 → CS-03 → CS-04 → CS-08 → CS-05 → CS-06 → CS-07 → UI settings → CS-02 → UI wizard → UI audit → employees
- 62 "blocks" links added, including UA-12 blocking all 16 UI tasks

UI track:
- SCRUM-150 to SCRUM-165 renamed from "(views only, mock data)" to "(screens on the real API)"; their descriptions now say they are built after the API of the stories they cover

### Oct 7, 2026 (architecture review)

Created:
- SCRUM-175 FND-12 Keep linked rows in the same company (composite company foreign keys) (Sprint 2); blocks SCRUM-48, SCRUM-51, SCRUM-58; relates to SCRUM-22

Synced with the code:
- SCRUM-149 renamed "UI: Sign-up and login pages (on the real API)", description rewritten to match the code, Done → In Review until the branch is merged
- SCRUM-32 comment: forgot-password view already exists
- SCRUM-146, SCRUM-147, SCRUM-148 labelled `ui-prototype` (mock data, not features)
- Epics SCRUM-5 FND, SCRUM-6 UA, SCRUM-7 CS moved to In Progress

Acceptance criteria added (under "Added Oct 7, 2026"):
- SCRUM-33 UA-05: login required by default with @Public, RolesGuard, own-data checks in services, permission test helper
- SCRUM-167 FND-10: global error filter, web data-fetching rule, auth and roles per endpoint, no raw SQL, Swagger decision
- SCRUM-29 UA-01: hashed invite token, default language for invited users, set-password view already exists
- SCRUM-136 QA-01: cross-company references, isolation through the HTTP API

Left for Trendow:
- Sprint 1 ends Oct 8 with SCRUM-26, 166, 167, 168 open; Sprint 2 holds 38 issues

### Oct 7, 2026 (correction pass after the foundation verification)

Created:
- SCRUM-176 FND-13 Verify foundation before business feature development (Sprint 2, High). Blocked by SCRUM-175, 166, 167, 33, 169, 168, 26. Blocks the business epics SCRUM-7 to SCRUM-18

Changed:
- SCRUM-175 priority Medium → High; Definition of Done requires regression tests for related-row isolation (read, create, update) and documents ↔ owner
- SCRUM-22 kept Done, renamed "FND-03 Isolate each company's data (direct rows)"; verification note and comment point to SCRUM-175 and the raw-SQL work
- SCRUM-167 raw-SQL policy: $queryRaw, $executeRaw, Unsafe and Typed variants forbidden in modules; tenant client refuses raw methods; now blocks SCRUM-33
- SCRUM-168 adds prisma validate/generate, migrations on an empty DB, api and web builds, one typecheck script, raw-SQL search check
- SCRUM-166 Role → Resource → Action → Permission, SRS-traced, open questions decided, approved before SCRUM-33
- SCRUM-33 tests per endpoint: 401 no session, 403 wrong role, allowed, own-data refusal, private by default
- SCRUM-169 server-side gate, no mock identity in production paths
- SCRUM-26 audit entry fields (who, what, when, company, record, before/after), company_id on audit_log, same transaction, immutable
- Business epics SCRUM-6 to SCRUM-18: Definition of Done for user-facing stories (end to end, not mock UI or API alone)
- UI tasks SCRUM-150 to SCRUM-165: "Done when" lines that a mock could satisfy now require the real API
- SCRUM-146, 147, 148: "UI prototype — awaiting backend/API integration" note

### Oct 7, 2026 (API design)

Added to `requirements/`:
- `api-endpoints.md`: 127 endpoints (4 built, 123 planned) and 6 scheduled jobs, with method, path, purpose, access, SRS and story

Changed in Jira:
- 90 stories: a "Planned API (requirements/api-endpoints.md, Oct 7 2026)" section appended to the description, generated from `api-endpoints.md`; existing text unchanged
- SCRUM-167: comment recording the endpoint map

Changed in `requirements/`:
- `api-conventions.md` §3: the `/me/...` own-data rule
- `permissions.md` §9: "View leave types" (Admin all, Employee all, Interviewer no)
- `decisions.md`: D-55, D-56, D-57 Agreed; `api-conventions.md` status Agreed

### Oct 9, 2026

Done in code:
- SCRUM-168 FND-11 CI: `.github/workflows/ci.yml` (PR #16, green on the PR and on `main`); `main` protected by a ruleset (pull request + `checks` required, no force push, no deletion)
- SCRUM-26 FND-07 audit log: `audit_log` table with an append-only trigger, `AuditService`, `AuditModule`, `test/audit/audit.e2e-spec.ts`; CI also checks that `schema.prisma` matches the migrations

Decisions proposed: D-58, D-59, D-60

To do in Jira (Trendow):
- SCRUM-168 → Done
- SCRUM-26 → Done after its PR is green and merged; comment: the `GET /audit-log` viewer is built after SCRUM-33 (it is Admin-only)
