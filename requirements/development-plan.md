# MDARJ HR & Payroll — Development Plan

MVP · Oct 1, 2026 · @trendow

This plan builds the MVP in `srs.md`, with the changes in `decisions.md` applied. Open points are tracked in `assumptions.md`. Estimates assume one full-stack developer in 2-week sprints (A-35): 11 sprints of work plus 1 sprint of buffer, about 24 weeks.

## 1. MVP build scope

**In scope:** every "Must" requirement in SRS sections 3 to 6, plus these "Should" requirements:

- FR-CS-7 Check-in window and IP allow-list
- FR-UA-7 Several Admins per company
- FR-EM-5 Recurring pay items
- FR-EM-10 Employee correction requests
- FR-RC-7 Duplicate candidate warning
- FR-AT-7 Attendance Excel export
- FR-LV-9 Leave calendar

**Moved to v1.1:**

- FR-SH-3 Weekly rotation shifts (D-02)
- FR-AI-10 AI "Ask" chat (D-03)

If the schedule slips, the "Should" items above are dropped first, in reverse order of the list (SRS 1.5).

## 2. Architecture

### 2.1 Stack

| Layer | Choice | Ref |
| --- | --- | --- |
| Backend | NestJS (TypeScript) | D-01 |
| Frontend | Next.js App Router, Tailwind CSS, next-intl | D-01, D-31 |
| Database | PostgreSQL with Prisma | D-22 |
| Jobs | BullMQ on Redis | D-23 |
| Files | S3-compatible storage; MinIO locally | D-36 |
| AI | OpenAI API behind the compliance module, structured JSON output | D-08 |
| PDF | HTML rendered by headless Chromium | D-32 |
| Excel | exceljs | D-33 |
| Local services | Docker Compose: PostgreSQL, Redis, MinIO, Mailpit | D-36 |

### 2.2 Repository layout

```
HR/
├── requirements/          srs.md, decisions.md, assumptions.md, development-plan.md
├── apps/
│   ├── api/               NestJS
│   │   └── src/
│   │       ├── domain/    pure business rules BR-1 to BR-18 (no database access)
│   │       ├── modules/   one folder per module in 2.3
│   │       ├── jobs/      BullMQ processors and schedules
│   │       └── common/    auth, tenancy, audit, files, i18n
│   └── web/               Next.js
│       ├── app/[locale]/  (admin), (employee), (interviewer), (auth) route groups
│       └── messages/      ar.json, en.json
├── packages/
│   └── shared/            enums, zod schemas, money and date helpers
└── docker-compose.yml
```

### 2.3 API modules

| Module | SRS | Main tables |
| --- | --- | --- |
| auth | 3.2, NFR-2 | users, sessions |
| tenancy | NFR-1 | (guard and Prisma extension) |
| companies | 3.1 | companies, company_settings_versions, job_titles |
| users | 3.2 | users |
| employees | 3.3 | employees, salary_history, recurring_pay_items |
| documents | 3.3, 3.5 | documents |
| contracts | 3.5 | contracts |
| recruitment | 3.4 | candidates, candidate_status_log, candidate_notes, interviews, interview_interviewers |
| shifts | 3.6 | shift_templates, shift_assignments |
| roster | 3.6 | roster_entries |
| holidays | 3.10 | public_holidays |
| leave | 3.9 | leave_types, leave_balances, leave_requests |
| attendance | 3.7 | attendance_records |
| exceptions | 3.8 | attendance_exceptions |
| payroll | 3.11 | payroll_runs, payroll_items, payroll_lines |
| compliance | 3.12 | law_references, compliance_runs, compliance_findings, ai_usage |
| notifications | 3.13 | notifications |
| audit | 3.13, NFR-8 | audit_log |
| dashboard | 3.13 | (read models) |

### 2.4 Scheduled jobs

All jobs run per company in the company time zone and are safe to re-run (NFR-5, D-34).

| Job | When | What it does | Duplicate guard |
| --- | --- | --- | --- |
| roster-generate | Nightly 00:30, and on assignment, leave or holiday change | Builds roster entries for the next 14 days (FR-SH-4, FR-SH-5) | Unique (employee_id, shift_date) |
| attendance-label | Every 15 minutes | Labels shifts whose end + 2 h has passed and creates exceptions (FR-AT-4, FR-EX-1) | Unique (employee_id, shift_date); unique (attendance_record_id, type) |
| leave-entitlement | Daily 00:15 | Grants yearly entitlement on 1 January or the eligibility date; carry-over on 1 January (FR-LV-4) | Unique (employee_id, leave_type_id, year) |
| compliance-nightly | Daily 02:00 | Builds fact sheets, calls the AI in batches of 20, validates findings (FR-AI-2 to FR-AI-5) | Unique open finding (employee_id, rule_ref) |
| invite-expiry | Hourly | Expires invite links older than 7 days (FR-UA-1) | Status check |

## 3. Sprint plan

| Sprint | Weeks | Phase | Delivers | Requirements |
| --- | --- | --- | --- | --- |
| S1 | 1–2 | Foundation | Repo, local services, auth, tenancy, audit, files, i18n shell, CI | FR-CS-1, FR-UA-3, FR-UA-8, NFR-1, NFR-2, NFR-6, NFR-8 |
| S2 | 3–4 | Company and users | Setup wizard shell, settings, job titles, invites, roles | FR-CS-2 to FR-CS-9, FR-UA-1, FR-UA-2, FR-UA-4, FR-UA-5, FR-UA-7 |
| S3 | 5–6 | People | Employees, salary history, documents, contracts | FR-EM-1 to FR-EM-10, FR-UA-6, FR-CT-1 to FR-CT-4 |
| S4 | 7–8 | Recruitment | Candidate board and list, interviews, convert to employee | FR-RC-1 to FR-RC-9 |
| S5 | 9–10 | Shifts and holidays | Shift templates, fixed assignment, roster job and grid, holidays | FR-SH-1, FR-SH-2, FR-SH-4 to FR-SH-7, FR-PH-1 to FR-PH-3 |
| S6 | 11–12 | Leave | Leave types, balances, requests, validation, notification centre | FR-LV-1 to FR-LV-9, BR-10 to BR-15, FR-DB-3 (centre) |
| S7 | 13–14 | Attendance | Check-in/out, labelling job, admin corrections, today board, calendar | FR-AT-1 to FR-AT-7, FR-PH-4, BR-1 to BR-5 |
| S8 | 15–16 | Exceptions | Exceptions inbox, suggested amounts, decisions, convert to leave | FR-EX-1 to FR-EX-8, BR-6 to BR-8 |
| S9 | 17–18 | Payroll | Runs, lines, approval and lock, payslips, register | FR-PR-1 to FR-PR-8, BR-9, BR-16 to BR-18 |
| S10 | 19–20 | AI compliance | Law reference, fact sheets, nightly and policy checks, findings, Explain | FR-AI-1 to FR-AI-9, FR-AI-11, FR-AI-12, FR-CT-5, BR-19 to BR-21 |
| S11 | 21–22 | Dashboards and hardening | Dashboards, performance, security and privacy review, UAT | FR-DB-1 to FR-DB-4, NFR-3 to NFR-5, NFR-7, NFR-9 |
| S12 | 23–24 | Buffer | Fixes from UAT, items that slipped | — |

## 4. Sprint details

### S1 Foundation

- pnpm workspace with `apps/api`, `apps/web`, `packages/shared`; lint, format and type-check in CI.
- Docker Compose with PostgreSQL, Redis, MinIO and Mailpit.
- Prisma schema for companies, company_settings_versions, users (with company_id, D-26), sessions, audit_log, notifications.
- Sign-up creates the company and first Admin (FR-CS-1).
- Login by email or phone, sessions with 12-hour inactivity expiry, Argon2id, no limit on failed attempts (FR-UA-3, FR-UA-8, NFR-2, D-24, D-46).
- Tenancy guard and Prisma extension; a reusable cross-tenant test helper every later module uses (NFR-1, D-25).
- Audit writer that stores before and after values; no update or delete route for audit rows (NFR-8).
- Files service: upload to S3, type and 10 MB checks, short-lived signed links (NFR-3).
- Next.js shell with `ar` and `en` locales, RTL switch, per-user language, 360 px layout (NFR-6, NFR-7).

**Exit:** a company can sign up and log in; a second company cannot read the first company's data in the isolation test; deactivating a user account leaves the employee record unchanged.

### S2 Company and users

- Setup wizard with skippable steps (FR-CS-2). Steps for modules not built yet show "available later" and are enabled as those sprints land.
- Company profile, work week, payroll settings, compliance mode and company rules text, check-in settings (FR-CS-3 to FR-CS-7).
- Effective-dated settings versions (FR-CS-8, D-27).
- Job titles (FR-CS-9).
- Admin creates employees' and interviewers' user accounts; invite link valid 7 days, sent by email when present and always copyable (FR-UA-1, FR-UA-2).
- Password reset by email, or a new invite link (FR-UA-4).
- Role guards for Admin, Employee and Interviewer (FR-UA-5); several Admins (FR-UA-7).

**Exit:** permission matrix tests pass for all three roles; a settings change dated next month does not affect this month.

### S3 People

- Employees: create, personal and job data, employee code, status changes, termination deactivates the login on the termination date (FR-EM-1 to FR-EM-3, FR-EM-7, FR-UA-6).
- Salary history with effective dates (FR-EM-4); recurring pay items (FR-EM-5).
- Documents with type and expiry (FR-EM-6).
- Profile tabs; tabs for later modules show empty states until those modules land (FR-EM-8).
- List search, filters and Excel export (FR-EM-9); employee correction requests (FR-EM-10).
- Contracts, computed status, renewal chain, dashboard counts and list filter (FR-CT-1 to FR-CT-4).
- The 50-employee limit message (A-15).

**Exit:** salary valid on any date is returned correctly; one Active contract per employee is enforced.

### S4 Recruitment

- Candidates, sources, CV upload, duplicate warning (FR-RC-1, FR-RC-7).
- Board with drag between statuses and list view; status log with required rejection reason and optional on-hold date (FR-RC-2 to FR-RC-4, FR-RC-8).
- Notes and interviews with interviewers, result and score; interviewer sees only their candidates (FR-RC-5, FR-RC-6).
- Convert hired candidate to employee with the two-way link (FR-RC-9).

**Exit:** an interviewer cannot open a candidate who is not on their interview.

### S5 Shifts and holidays

- Shift templates including crossing midnight, break and grace minutes (FR-SH-1).
- Fixed assignment from a start date (FR-SH-2). Rotation is not built (D-02).
- roster-generate job: 14 days ahead, rest days and holidays marked (FR-SH-4, FR-SH-5); leave is wired in S6.
- One-day override with reason, logged (FR-SH-6); weekly grid and employee's own upcoming shifts (FR-SH-7).
- Public holidays calendar with the Egyptian starting list and "date to confirm" (FR-PH-1, FR-PH-2); holidays excluded from expected attendance (FR-PH-3).

**Exit:** re-running the roster job creates no duplicates; a night shift's roster entry carries the correct shift date.

### S6 Leave

- Leave types with all fields; statutory types seeded from EG-LABOR v1 when law mode is on, never less generous (FR-LV-1, FR-LV-2). The law reference data is seeded in this sprint.
- Balances with opening values; leave-entitlement job with pro-rating and carry-over (FR-LV-3, FR-LV-4).
- Requests with full or half day and attachment; validation BR-10 to BR-15 in the domain layer with the failing reason returned (FR-LV-5, FR-LV-6).
- Approve, reject, cancel; balance and roster updated (FR-LV-7, FR-LV-8, FR-SH-5).
- Leave calendar (FR-LV-9).
- In-app notification centre with unread count; first events: leave requested and decided (FR-DB-3).

**Exit:** unit tests for every leave rule; approving leave marks the roster days On leave.

### S7 Attendance

- Check-in and check-out button, server time, IP stored, window and IP allow-list checks (FR-AT-1, FR-AT-2).
- Night shift punches belong to the shift date (FR-AT-3).
- attendance-label job and labels BR-1 to BR-5, including multiple labels per day (FR-AT-4).
- Admin add or correct punch with mandatory reason and audit (FR-AT-5).
- Today board and monthly calendar with totals; Excel export (FR-AT-6, FR-AT-7).
- Work on a public holiday produces Overtime (FR-PH-4).

**Exit:** check-in is 2 taps after login on a 360 px screen; label tests pass for late, early, late plus early, absent, missing check-out, overtime, rest-day and holiday work, and a shift crossing midnight.

### S8 Exceptions

- Exceptions created beyond grace with type, minutes or days, suggested amount and policy snapshot (FR-EX-1, FR-EX-2).
- Suggested amounts from BR-6 to BR-8 in the domain layer, exact and tiered lateness modes.
- Employee reason and attachment within 3 days (FR-EX-3).
- Approve, reject, edit and approve, convert to leave; missing check-out time entry with recalculation (FR-EX-4, FR-EX-5).
- Bulk approve and reject on a filter (FR-EX-6); decision record (FR-EX-7).
- Carry-forward hook for decisions after the month is approved (FR-EX-8), finished in S9.

**Exit:** the SRS worked example returns exactly 187.50 EGP; convert-to-leave reduces the leave balance and creates no payroll line.

### S9 Payroll

- Create a run per month with every employee Active on any day of the month (FR-PR-1).
- Pro-rated base from salary history and the effective settings (FR-PR-2).
- Automatic lines from approved exceptions, recurring items and unpaid leave; overtime amounts BR-9 (FR-PR-3).
- Manual lines (FR-PR-4); warnings for pending exceptions, missing salary, negative net (FR-PR-5).
- Draft, Approved (locked), Paid; reopen with mandatory reason (FR-PR-6); carried-forward lines (BR-16, BR-17, FR-EX-8).
- Payslip PDF in Arabic and English; employees see their payslips after approval (FR-PR-7).
- Register with totals, Excel and PDF export (FR-PR-8).

**Exit:** a run for 50 seeded employees finishes in under 10 seconds (NFR-4); re-calculating an approved run returns the same figures; a late decision lands in the next month as a carried-forward line.

### S10 AI compliance

- Compliance module with the OpenAI client, model name as a setting, structured JSON schema for findings (FR-AI-1).
- Fact sheet builder with employee codes only; no names, IDs, contacts, salaries or files (FR-AI-2, FR-AI-11).
- Rules: law reference plus company rules text, or company rules only (FR-AI-3).
- compliance-nightly job in batches of 20; guardrail that discards findings quoting a wrong fact and logs them (FR-AI-4, FR-AI-5).
- Policy check after saving leave types, shift templates and payroll settings (FR-AI-6, A-34).
- Employee and company status, "Run check now" limit, finding states, red-finding notification, "AI suggestion, review before acting" label (FR-AI-7, FR-AI-8).
- Explain button in the user's language (FR-AI-9).
- Daily call cap, usage logging, "guidance, not legal advice" notice (FR-AI-12, NFR-9).
- Expired contract of an Active employee as a red finding (FR-CT-5).

**Exit:** a test confirms no name, national ID or salary appears in any AI request; with the OpenAI API unreachable, the last findings stay visible with their date and every other module works.

### S11 Dashboards and hardening

- Admin dashboard and employee home (FR-DB-1, FR-DB-2).
- Remaining notification events: exception created and decided, payslip available, contract expiring (FR-DB-3).
- Audit log viewer for Admins (FR-DB-4).
- Performance check with 50 employees and a year of data: pages under 2 seconds (NFR-4).
- Security and privacy review: signed links, role checks, session expiry, PDPL handling (NFR-2, NFR-3).
- Backup and restore rehearsal on the chosen hosting (NFR-5, A-36).
- Full Arabic and English review on desktop and 360 px phones (NFR-6, NFR-7).
- User acceptance testing with one sample company.

**Exit:** UAT sign-off list agreed.

## 5. Testing

| Level | What | Where |
| --- | --- | --- |
| Unit | Business rules BR-1 to BR-18, contract status, leave day counting, rounding | `apps/api/src/domain` |
| Integration | API endpoints against a real PostgreSQL | `apps/api/test` |
| Tenant isolation | For each module: company B cannot list, read, update, delete or download company A's records or files | `apps/api/test/tenancy` |
| Permissions | Admin, Employee and Interviewer matrix per endpoint | `apps/api/test/permissions` |
| End to end | Browser tests for the main flows in both languages | `apps/web/e2e` |
| Performance | 50 employees, one year of attendance, payroll run timing | S9 and S11 |

Required test cases (Appendix B):

- SRS worked example: 9,000 EGP, divisor 30, early leave of 5 h = 187.50 EGP.
- Night shift crossing midnight: punches, labels and overtime on the correct shift date.
- Late and early leave on the same day produce two exceptions.
- Missing check-out fixed by the Admin recalculates the day.
- Work on a rest day and on a public holiday produce overtime at the right multiplier.
- Leave refused for notice, balance, overlap, eligibility, maximum consecutive days and missing attachment.
- Exception converted to leave reduces the balance and creates no payroll deduction.
- Exception decided after the run is approved appears in the next run as carried forward.
- Approved run is locked; reopen requires a reason and is audited.
- Negative net blocks approval until confirmed.
- Salary change mid-month uses the salary valid in each period.
- Settings change with a future effective date does not alter the current or an approved run.
- Deactivating a user account leaves the employee record unchanged.
- A terminated employee cannot log in from the termination date.
- AI guardrail discards a finding that quotes a wrong fact.
- AI request payload contains no names, national IDs, contacts or salaries.
- Every scheduled job run twice gives the same result.

## 6. Definition of done

A requirement is done when:

- It works in Arabic (RTL) and English and on a 360 px screen.
- Server-side permission and tenant checks are in place and tested.
- Changes to salaries, punches, approvals, payroll or settings write to the audit log.
- Unit tests cover its business rules, and its main flow has an integration or end-to-end test.
- CI passes (lint, type-check, tests).
- The requirement ID is referenced in the pull request title or description.

## 7. Risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Legal values in Appendix A are wrong or change | Wrong findings and statutory leave | Law reference is versioned data (D-10); lawyer review before launch (A-01) |
| Payroll and attendance edge cases (night shifts, mid-month changes, carry-forward) | Wrong salaries | Pure domain layer, effective-dated data, required test list in section 5 |
| Tenant data leak | Serious privacy breach | Tenancy enforced in one place (D-25) plus isolation tests in every module |
| AI returns invented facts or costs grow | Misleading findings, cost overrun | Guardrail (FR-AI-5), structured output, batch calls, daily caps (NFR-9) |
| Arabic PDFs and RTL layouts break | Unusable payslips for Arabic users | Chromium-rendered PDFs (D-32); RTL from S1 (D-20) |
| One developer, about 70 requirements | Schedule slip | Should items dropped first (section 1); S12 buffer |
| Open assumptions not answered in time | Rework | Each "To confirm" assumption is listed with the sprint that needs it (section 8) |

## 8. Answers needed, by sprint

| Needed by | Assumptions |
| --- | --- |
| S2 | A-12 (email provider) |
| S3 | A-15 (50-employee count), A-16 (contract salary vs salary history) |
| S6 | A-01 (legal values, for statutory leave types), A-02 / D-04 (disability field) |
| S7 | A-04 (night window) |
| S8 | A-23 (convert exception to leave) |
| S9 | A-03 (holiday overtime), A-25 to A-27 (divisor, hourly fallback, pro-rating), A-30 (suspended employees) |
| S10 | A-06 (PDPL and OpenAI), A-32 (AI caps), A-34 (policy check blocking) |
| S11 | A-36 (hosting provider and region) |
