# MDARJ HR & Payroll — Development Workflow

Agreed Oct 7, 2026 · @trendow · Applies to all work from now on.

This file says **how** we build and **in what order**. `srs.md` says what, `decisions.md` says why, `development-plan.md` holds the architecture and test plan. When this file and the old sprint table in `development-plan.md` §3 disagree on order, this file wins.

## 1. The 15-stage lifecycle, and where we are (Oct 7, 2026)

| # | Stage | Status | What exists | Gap to close |
| --- | --- | --- | --- | --- |
| 1 | SRS / Requirements | Done | `srs.md` v1.6, `decisions.md` D-01…D-63, `assumptions.md` | Keep in sync: decision → SRS → Jira → code |
| 2 | Epics + User Stories | Done, reorganised Oct 7 | Jira project HR-System (SCRUM): 16 epics, 170 issues | Dependencies added as "blocks" links; UI tasks now built inside their feature (see §5) |
| 3 | Architecture | Done | `development-plan.md` §2, D-21…D-36 | — |
| 4 | ERD / Database design | Done for what is built | SRS §5 data model; `schema.prisma` has companies, settings versions, users, job titles, employees, salary history, status history, documents, contracts, sessions. Other tables are added by the task that first uses them (D-42) | Design each new module's tables at the start of its feature (you draft, then compare with SRS §5) |
| 5 | Roles + Permissions + API design | Done | `permissions.md` (D-49…D-54), `api-conventions.md` (error filter, raw-SQL refusal), `api-endpoints.md` (127 endpoints, 6 jobs; each story's endpoints are in its Jira description) | Each feature adds its `@Roles` and own-data checks |
| 6 | Project foundation | Done for the MVP start | pnpm workspace, NestJS, Next.js, Prisma + PostgreSQL, tenancy guard + isolation test, next-intl RTL shell, 360 px layout, CI on every PR with `main` protected (SCRUM-168), audit writer + append-only `audit_log` (SCRUM-26) | Files (FND-06), email (FND-05) and jobs (FND-04) are built just before the first feature that needs them |
| 7 | Authentication | Login, roles and the web login gate done | Sign-up, login (email or phone), sessions, `/auth/me`, logout, e2e tests; login and sign-up pages call the API (SCRUM-149 branch) | Role guard done (UA-05, SCRUM-33); web login gate, real user and logout done (UA-12, SCRUM-169). Still to do: invites + set password (UA-01/02); password reset (UA-04) |
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
- SCRUM-33 UA-05 role guard: global `SessionGuard` (private by default, `@Public()`), global `RolesGuard` (`@Roles`, deny by default), `assertOwnEmployee`, `test/auth/role-browsers.ts` helper, `test/auth/permissions.e2e-spec.ts`; decisions proposed D-61, D-62

### Oct 9, 2026 (backlog re-order)

Why: the rank inside Sprint 2 did not follow the build order in §4 (for example UA-04 reset was first, before the email and invites it needs), and Sprint 2 held 36 open issues for one week.

Changed in Jira:
- Sprint 2 ranked by dependency: SCRUM-169 → 176 → 24 → 29 → 30 → 150 → 32 → 35 → 144 → 46 → 40 → 41 → 45 → 42 → 43 → 44 → 152 → 39 → 151 → 163 (done SCRUM-33 and SCRUM-47 stay at the top)
- Moved from Sprint 2 to the top of Sprint 3, in this order: SCRUM-48, 49, 50, 54, 34, 25, 53, 55, 56, 51, 52, 57, 153, 154, 58, 155
- Links added ("is blocked by", blocked ← blocker): SCRUM-32 ← 29, and:
- SCRUM-150 ← 29, 30 · SCRUM-35 ← 29 · SCRUM-144 ← 35
- SCRUM-41 ← 33 · SCRUM-43 ← 33 · SCRUM-44 ← 45 · SCRUM-152 ← 40, 41, 42, 43, 44 · SCRUM-151 ← 39
- SCRUM-49, 50, 51, 52, 53, 54, 56 ← 48 · SCRUM-55 ← 49, 50, 51, 53 · SCRUM-57 ← 55 · SCRUM-153 ← 48, 56 · SCRUM-154 ← 55 · SCRUM-155 ← 58

Noticed, not changed:
- An empty active sprint "SCRUM Sprint 0" (id 2) is still open next to Sprint 2
- SCRUM-169 UA-12 web login gate: `(app)/layout.tsx` checks the session on the server with `getSession()`; login returns to `?next=`; "session expired" notice; shell shows the real user, company and role; Log out; menu, command palette, saved views and Invite follow the role; mock company removed; decision proposed D-63

### Oct 9, 2026 (foundation check)

- SCRUM-176 FND-13: all 20 checks proven in `requirements/foundation-check.md` against `main` at `14a8eb1` and its green CI run
- Gaps fixed: `srs.md` v1.6 (documents and audit_log rows match the tables); "UI prototype · sample data" badge on the dashboard and exceptions inbox; dashboard subtitle uses the real company name
- From here on, a user-facing story is Done only when it works end to end (screen → API → login → role → logic → database → screen, with tests)

### Oct 9, 2026 (email)

- SCRUM-24 FND-05: `MailService` (SMTP, nodemailer), invite and password-reset templates in Arabic and English, Mailpit in Docker Compose and CI, `test/mail/mail.e2e-spec.ts`; decision D-64
- Jira SCRUM-24 "Done when" corrected: the invite and reset emails are checked in SCRUM-29 (UA-01) and SCRUM-32 (UA-04), where those features are built

### Oct 11, 2026 (invites)

- SCRUM-29 UA-01, code ready on `feat/scrum-29-invites` (not committed yet):
  - API: `POST /users` and `GET /users` (Admin, `modules/users/`), `GET /auth/invites/:token` and `POST /auth/invites/:token/accept` (Public); invite token hashed in `users.invite_token` (`auth/invite-token.ts`); user create and invite accept write audit rows; the invite email goes through `MailService` after the save
  - Shared: `createUserSchema`, `acceptInviteSchema`, `listUsersQuerySchema` (`packages/shared/src/users/invite.ts`)
  - Web: the set-password page checks the link on the server and the form calls the API; the `?expired=1` stub is gone
  - Tests: `test/users/invites.e2e-spec.ts`; `role-browsers.ts` cleanup now removes audit rows
  - No migration: `invite_token` and `invite_expires_at` were already in the schema
  - Decisions proposed: D-65, D-66
- Not in this task: the Admin's invite screen and the Copy-link button (SCRUM-150, with SCRUM-30 UA-02); new link for an existing user, `POST /users/:id/invite` (UA-02/UA-04)
- SCRUM-30 UA-02 on the same branch: `POST /users/:id/invite` (Admin) issues a new 7-day link, emails it when there is an email, and the old link stops working; Deactivated users are refused; accepting a link ends the user's older sessions; tests added to `test/users/invites.e2e-spec.ts`; decision proposed D-67. The Copy-link button is the screen part (SCRUM-150)
- Git workflow agreed: one branch per feature (here "Users & access": SCRUM-29, 30, 150, 32, 35, 144), one commit per tested checkpoint with its Jira keys, merge to `main` only after the whole feature is tested and approved
- SCRUM-150 UI users and invites on the same branch: `/users` page (Admin only, new "Users" menu item) reads `GET /users` on the Next.js server (`lib/server-api.ts`); table with role, account status, link expiry and a "New link" button (`POST /users/:id/invite`) that shows the link with Copy; the Invite dialog (top bar, command palette, Users page) now calls `POST /users` with role and invite language, shows the link with Copy and whether it was emailed; the mock invite link is gone
- 404 page: `not-found.tsx` inside the app shell and outside it, and `[module]/[...rest]` so deeper unknown addresses show it too, instead of Next.js's plain default page
- SCRUM-32 UA-04 on the same branch: "Forgot password?" calls `POST /auth/password-reset`, which emails a 1-hour link to Active users (always 204, one email a minute); the link opens the same set-password page, worded "Choose a new password"; tests in `test/auth/password-reset.e2e-spec.ts`; decision proposed D-68
- SCRUM-35 UA-07 and SCRUM-144 UA-10 on the same branch: `PATCH /users/:id` (role), `POST /users/:id/deactivate` and `/activate`, never leaving the company without an Active Admin (409 `lastActiveAdmin`, Serializable transaction); switching a login off ends its sessions and open link and never touches the employee record; "Manage" window on the Users page; tests in `test/users/manage-users.e2e-spec.ts`; decision proposed D-69

### Oct 11, 2026 (company settings)

- Branch `feat/company-settings`, scope "Company settings": SCRUM-46 CS-09, SCRUM-40 CS-03, SCRUM-41 CS-04, SCRUM-45 CS-08, SCRUM-42 CS-05, SCRUM-43 CS-06, SCRUM-44 CS-07, SCRUM-152 UI settings, SCRUM-39 CS-02 wizard
- SCRUM-46 CS-09: `GET`/`POST`/`PATCH`/`DELETE /job-titles` (Admin), names in Arabic and English, no duplicate names in a company, removal refused while employees use the title (D-48, also enforced by the foreign key); `/settings` page is now real (Admin only) with the Job titles section; tests in `test/settings/job-titles.e2e-spec.ts`. No migration: `job_titles` already existed. No audit row: `AuditEntity` has no job-title value and FR-DB-4 does not list job titles
- SCRUM-40 CS-03: `GET`/`PATCH /company` (Admin): name, address, phone (normalized, D-45), time zone (checked against the IANA list); currency shown as EGP; each save writes a `company_settings` audit row with before and after; Company profile section on `/settings`; tests in `test/settings/company.e2e-spec.ts`. The logo upload waits for file storage (FND-06, SCRUM-25)
- SCRUM-41 CS-04 + SCRUM-45 CS-08: settings versions with a start date (`CompanySettingsService`, exported for payroll and attendance): `GET /company/settings?date=`, `GET /company/settings/versions`, `POST /company/settings/versions` (today or later, copies the version in force, same day replaces, audited); Work week section with rest-day toggles, start date and history; tests in `test/settings/settings-versions.e2e-spec.ts`; decisions proposed D-70, D-71. No migration
- SCRUM-42 CS-05: payroll rules through the same dated versions: daily-rate divisor, lateness policy (exact or up to 10 bands), four overtime multipliers and the overtime minimum; the audit row now records only the settings that changed; Payroll rules section on `/settings`; tests in `test/settings/payroll-rules.e2e-spec.ts`; decision proposed D-72. No migration
- SCRUM-43 CS-06: `lawMode` and `companyRulesText` (up to 10,000 characters, sent to the AI as written) on `GET`/`PATCH /company`; `PATCH /company` now takes only what changes; audited with reason "Compliance mode"; Compliance section on `/settings`; tests added to `test/settings/company.e2e-spec.ts`. No migration. What law mode switches on (statutory leave types, law multipliers, disability field, AI rules) is built in those features
- SCRUM-44 CS-07: check-in window, check-out window and office IP list through the dated versions; shared `isIpOrRange` (IPv4/IPv6, CIDR) in `packages/shared/src/ip.ts`; Check-in section on `/settings`; tests in `test/settings/check-in-settings.e2e-spec.ts`; decision proposed D-73. No migration
- SCRUM-152 UI settings: every section works on the real API in Arabic and English; added jump links to the sections (`settings-nav.tsx`, sticky under the top bar, scrolls sideways on phones); the time-zone list is made once on the server so server and browser render the same options (fixes a hydration error)
- SCRUM-39 CS-02 setup wizard: migration `20261011150000_company_setup_steps` adds `companies.setup_steps` (JSONB, default `{}`); `GET`/`PATCH /company/setup`; `/setup` page (Admin) on its own focused screen (route group `(onboarding)`: logo, language switch and "Exit setup", no side menus): numbered step tracker, then the current step's Settings section at a comfortable width; that section's button becomes "Save & continue" (saves, marks the step done, opens the next), "Skip for now" marks it skipped, "Back" goes to the previous step; job titles has its own Continue; sign-up now opens `/setup`; dashboard banner until setup is complete; tests in `test/settings/setup.e2e-spec.ts`; decision proposed D-74
- Decision review D-70 to D-74 (all Agreed): D-70 freeze rule, settings lock, snapshots, later-version warning, no backdating; D-71 weekday numbering used everywhere; D-72 band rules (inclusive, no gaps, open last band, 0-amount exception below the first band, separate late and early, daily cap also on Admin edits and simultaneous approvals); D-73 check-out window replaces the 2-hour rule (also fixed in `development-plan.md`), corrections create difference-only adjustments, IP list frozen with its version, trusted proxy; D-74 done only after a successful save, Settings saves never change setup progress, safe defaults, way back to skipped steps
- Applied on the settings side (the rest is built with attendance, exceptions and payroll): shared band rules `bandsGap` and `lastBandNotOpen`, "Add band" starts after the last band, wording "late or left early"; `lockCompanySettings(tx, 'exclusive' | 'shared')` (Postgres advisory lock, the only raw statement the tenant client allows) taken by every settings save before checking `earliestEffectiveFrom` (today until attendance exists); `earliestEffectiveFrom` in `GET /company/settings/versions` sets the date picker's minimum and the wizard's save date; `LaterVersionNote` warns about a version already scheduled later; `normalizeIp` (IPv4-mapped IPv6 → IPv4, short IPv6); `TRUSTED_PROXY` sets Express "trust proxy" (empty = ignore X-Forwarded-For; Next.js does not add the visitor's IP), `visitorIpKnown()` ready for attendance; `SkippedStepsNote` on `/settings`; tests added to `payroll-rules`, `settings-versions`, `check-in-settings`, `setup` and `auth/login` e2e specs. No migration
