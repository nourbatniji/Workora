# MDARJ HR & Payroll — Decision Log

MVP · Oct 1, 2026 · @trendow

This log records the decisions that shape the MVP build. SRS v1.2 (Oct 3, 2026) applies D-01 to D-03, so `srs.md` and this log agree. If they differ again, the decision here wins until `srs.md` is updated.

Status values:

- **Agreed**: decided by the product owner.
- **Agreed (SRS)**: already fixed in the consolidated SRS; listed here so the build has one place to check.
- **Proposed**: an implementation choice made for the development plan; becomes Agreed once accepted.
- **Open**: still to decide. Working assumptions are in `assumptions.md`.

## 1. Decisions that override the SRS

| ID | Decision | Overrides | Status | Date |
| --- | --- | --- | --- | --- |
| D-01 | Backend is NestJS (TypeScript). Frontend is Next.js (TypeScript, App Router) with Tailwind CSS. PostgreSQL, S3-compatible file storage, a Redis-backed job queue, the OpenAI compliance service and company_id tenancy stay as in Appendix B. | SRS Appendix B (Django + DRF, React + Vite) | Agreed | Oct 1, 2026 |
| D-02 | MVP supports fixed shifts only. Weekly rotation shifts move to v1.1. The data model keeps `shift_assignments.kind` so rotation can be added without a migration of existing rows. | FR-SH-3 (Should); section 2.4 "and simple weekly rotations" | Agreed | Oct 1, 2026 |
| D-03 | The AI "Ask" chat (free-form questions to the assistant) moves to v1.1. The MVP keeps the nightly check, policy check and the "Explain" button. | FR-AI-10 (Should) | Agreed | Oct 1, 2026 |
| D-04 | Employees get an optional "has a disability" field. It appears only when the company turns on law mode (FR-CS-6), so each company's HR decides whether it is used. Only Admins can see it. It lets the system apply the 45-day annual leave entitlement (EG-05) and is sent to the AI only as a yes/no fact with the employee code. | SRS 2.5, Appendix A open item | Agreed | Oct 3, 2026 |

## 2. Product decisions carried from the SRS

| ID | Decision | SRS ref | Status |
| --- | --- | --- | --- |
| D-05 | The MVP is free and sized for companies with up to 50 employees. | 2.4, NFR-4 | Agreed (SRS) |
| D-06 | Failed logins lock the user account only (5 attempts, 15 minutes). They never change the employee record. User account status is separate from employment status. | FR-UA-8, NFR-2 | Superseded by D-46 |
| D-07 | Attendance labels, exceptions and payroll amounts are deterministic backend logic. The AI only reads facts and returns findings; it never calculates, approves or changes data. | 2.4, 3.11, 3.12, BR-21 | Agreed (SRS) |
| D-08 | The AI model is a small, low-cost OpenAI model with structured JSON output. The model name is a setting. | FR-AI-1 | Agreed (SRS) |
| D-09 | The AI receives employee codes only. Names, national IDs, contact details, salary amounts and files are never sent. | FR-AI-11 | Agreed (SRS) |
| D-10 | The law reference is versioned data (`law_references`), so a legal change is a data update, not a release. | NFR-10, Appendix A | Agreed (SRS) |
| D-11 | Social insurance and income tax are manual deduction lines. The system does not calculate them. | 2.4, FR-PR-4 | Agreed (SRS) |
| D-12 | Net salary = pro-rated base + additions − deductions, rounded to 2 decimals. | 3.11, BR-18 | Agreed (SRS) |
| D-13 | An approved payroll run is locked. Later corrections reach the next run as carried-forward lines. | FR-PR-6, BR-17, FR-EX-8 | Agreed (SRS) |
| D-14 | Only transactional emails are sent (invites and password reset). All other notifications are in-app. | 2.4, FR-DB-3 | Agreed (SRS) |
| D-15 | Employees and interviewers join only through an invite link (valid 7 days) created by an Admin. No public employee sign-up. | FR-UA-1 | Agreed (SRS) |
| D-16 | Login is by email or phone number plus password. | FR-UA-3 | Agreed (SRS) |
| D-17 | No departments, reporting lines or multi-level approvals. Every approval goes to an Admin. | 2.2, 7.1 | Agreed (SRS) |
| D-18 | Office IP allow-list for check-in is an optional company setting. No GPS, QR or fingerprint devices. | FR-CS-7, FR-AT-2, 2.4 | Agreed (SRS) |
| D-19 | Contract expiry is shown as an in-app badge and dashboard count, with no email alert. | 2.4, FR-CT-4 | Agreed (SRS) |
| D-20 | Arabic (RTL) and English are built into the frontend foundation from the first screen. | NFR-6, Appendix B | Agreed (SRS) |

## 3. Implementation decisions (agreed Oct 3, 2026)

| ID | Decision | Reason | Status |
| --- | --- | --- | --- |
| D-21 | One repository with pnpm workspaces: `apps/api` (NestJS), `apps/web` (Next.js), `packages/shared` (types, enums, validation schemas, money and date helpers). | Shares types and validation between API and UI. | Agreed |
| D-22 | ORM: Prisma with PostgreSQL migrations. | Typed queries, readable schema, a client extension can enforce tenant scoping. | Agreed |
| D-23 | Background jobs: BullMQ on Redis, with repeatable jobs scheduled per company time zone. | NestJS equivalent of Celery + Redis (allowed by Appendix B). | Agreed |
| D-24 | Authentication: server-side sessions in an httpOnly, Secure, SameSite cookie; Argon2id password hashing; 12-hour inactivity expiry. | Matches NFR-2 and makes forced logout on termination (FR-UA-6) immediate. | Agreed |
| D-25 | Tenant scoping: the company_id comes only from the session, a Prisma extension adds it to every query on company-owned tables, and each module has an automated cross-tenant test. | NFR-1. | Agreed |
| D-26 | `users` gets a `company_id` column, and email and phone are unique across the whole system, so login never asks which company. | The SRS users table has no company link. | Agreed |
| D-27 | Company settings that affect money or attendance are stored as effective-dated versions (`company_settings_versions`) instead of one JSON field on `companies`. | FR-CS-8: a change applies from its effective date and never alters an approved run. | Agreed |
| D-28 | Money is stored as `numeric(12,2)` and calculated with a decimal library, never JavaScript floats. Each payroll line is rounded half-up to 2 decimals. | BR-18 and reproducible payslips. | Agreed |
| D-29 | Timestamps are stored as `timestamptz` in UTC. `shift_date` is a plain date in the company time zone. | FR-AT-3 night shifts and FR-CS-3 time zones. | Agreed |
| D-30 | Validation schemas are written once in `packages/shared` (zod) and used by both API and web forms. | One rule set for both sides. | Agreed |
| D-31 | Frontend i18n with next-intl; layout uses Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`) so RTL works without separate styles. | NFR-6, D-20. | Agreed |
| D-32 | Payslip and register PDFs are rendered from HTML with headless Chromium. | Correct Arabic shaping and RTL in PDFs. | Agreed |
| D-33 | Excel exports use exceljs (.xlsx). | FR-EM-9, FR-AT-7, FR-PR-8. | Agreed |
| D-34 | Idempotent jobs rely on unique constraints: roster (employee_id, shift_date), attendance record (employee_id, shift_date), exception (attendance_record_id, type), open finding (employee_id, rule_ref), payroll run (company_id, month). | NFR-5, BR-20. | Agreed |
| D-35 | Business rules BR-1 to BR-18 live in a pure domain layer with no database access, covered by unit tests including the SRS worked example (187.50 EGP). | Appendix B implementation rules. | Agreed |
| D-36 | Local development runs PostgreSQL, Redis, MinIO (S3) and Mailpit (email catcher) in Docker Compose. | No paid services needed during development. | Agreed |

## 4. Deferred to later releases

| Item | Target | Ref |
| --- | --- | --- |
| Weekly rotation shifts | v1.1 | D-02 |
| AI "Ask" chat | v1.1 | D-03 |
| Everything in SRS 7.1 (departments, job postings, devices, native app, tax and insurance calculation, accounting, analytics, email/WhatsApp notifications, multi-level approvals) | Roadmap (SRS 7.2) | SRS 7.1 |

## 5. Decisions from the SRS review (Oct 3, 2026)

| ID | Decision | SRS ref | Status | Date |
| --- | --- | --- | --- | --- |
| D-37 | Suspended employees stay employed: no working shifts are scheduled (never marked Absent), they can log in to view their data and payslips but cannot check in, and they keep full base pay unless the Admin adds a manual deduction line. | FR-EM-7, FR-SH-5, FR-AT-2, A-30 | Agreed | Oct 3, 2026 |
| D-38 | Check-out is accepted until shift end plus a check-out window, a company setting with a default of 6 hours. Days are labelled when that window closes. | FR-CS-7, FR-AT-2, FR-AT-4, BR-4 | Agreed | Oct 3, 2026 |
| D-39 | The total lateness and early-leave deduction for one day never exceeds one daily rate. | BR-7 | Agreed | Oct 3, 2026 |
| D-40 | The Admin can delete a candidate who was not hired, together with their CV, documents, notes and interviews. Hired candidates linked to an employee cannot be deleted. | FR-RC-10 | Agreed | Oct 3, 2026 |

## 6. Decisions during the build (Oct 5, 2026)

| ID | Decision | SRS ref | Status | Date |
| --- | --- | --- | --- | --- |
| D-41 | `users` gets a `name` column for the person's own name. It is needed for users with no employee record: the owner who signs up as the first Admin, other Admins and Interviewers. A user linked to an employee shows the employee's Arabic or English name. | FR-CS-1, FR-UA-1, SRS 5.1 users | Agreed | Oct 5, 2026 |
| D-42 | SRS 5.1 tables are built with the task that first uses them: `recurring_pay_items` in EM-05 (FR-EM-5) and `employees.candidate_id` in RC-09 (FR-RC-9, MVP-2, when the `candidates` table exists). FND-02 builds the rest of SRS 5.1. | SRS 5.1, FR-EM-5, FR-RC-9 | Agreed | Oct 5, 2026 |
| D-43 | Passwords are 8 to 128 characters. They are not trimmed, because spaces can be part of a password. | FR-CS-1, FR-UA-1, NFR-2 | Agreed | Oct 6, 2026 |
| D-44 | Validation errors in `packages/shared` are message keys (for example `passwordTooShort`), not sentences. The web app translates each key into Arabic or English; the API returns the keys per field. | NFR-6, D-30 | Agreed | Oct 6, 2026 |
| D-45 | Phone numbers are stored and compared in one form: `+` and digits (for example `+201012345678`). Spaces, dashes and brackets are removed, `00` becomes `+`, and an Egyptian mobile written as `01xxxxxxxxx` becomes `+201xxxxxxxxx`. `normalizePhone` in `packages/shared` does this everywhere. | FR-UA-3, FR-UA-1 | Agreed | Oct 6, 2026 |
| D-46 | No limit on failed login attempts and no account lockout. Only the employee receives the invite link, so only they set the password. `users.failed_login_attempts`, `users.locked_until` and the `locked` account status are removed. Account status (Invited, Active, Deactivated) stays separate from employment status. Accepted trade-off: repeated password guessing on the login page is not blocked. Replaces D-06 and A-13. | NFR-2, FR-UA-8, FR-UA-3 | Agreed | Oct 6, 2026 |

## 7. Decisions during the build (Oct 7, 2026)

| ID | Decision | SRS ref | Status | Date |
| --- | --- | --- | --- | --- |
| D-47 | A document belongs to an employee through `documents.employee_id`, a real foreign key checked together with `company_id`. The loose `owner_type` + `owner_id` pair is removed, because the database could not check that the owner exists or belongs to the same company. Candidate documents (MVP-2) add a `candidate_id` column with the same kind of key, and a check that a document has exactly one owner. Replaces the documents owner fields in SRS 5.1. | SRS 5.1 documents, FR-EM-6, NFR-1, NFR-3 | Agreed | Oct 7, 2026 |
| D-48 | Every link between two company-owned rows is a foreign key on the pair (target id, `company_id`), so the database itself refuses a link to another company's row. Each target table has a unique key on (`id`, `company_id`); one-to-one links (one login per employee, one renewal per contract) are unique on (link column, `company_id`). The "who did it" columns (`created_by`, `changed_by`, `uploaded_by`) follow the same rule. Deleting a row that others still point at is refused instead of clearing the link: a job title in use, an employee linked to a login, a contract that was renewed. | NFR-1, D-25, FR-EM-11 | Agreed | Oct 7, 2026 |
| D-49 | An Admin who also has an employee record gets every Employee "own" right for that record: check in and out, request and cancel own leave, own employee home and own payslips. An Admin with no employee record has no check-in. | SRS 2.2, FR-AT-1, FR-LV-5, FR-PR-7 (permissions.md Q1) | Agreed | Oct 7, 2026 |
| D-50 | An Employee can view their own contract: file, dates and agreed salary. | FR-EM-8, NFR-3 (permissions.md Q2) | Agreed | Oct 7, 2026 |
| D-51 | Employees see only their own upcoming shifts, not the weekly roster grid of everyone. | FR-SH-7 (permissions.md Q3) | Agreed | Oct 7, 2026 |
| D-52 | In the MVP, only Admins see the leave calendar (who is off on which days). | FR-LV-9 (permissions.md Q4) | Agreed | Oct 7, 2026 |
| D-53 | An Interviewer records the result, score and notes of their own interviews only; candidate notes (FR-RC-5) are Admin-only. | FR-RC-5, FR-RC-6, FR-UA-5 (permissions.md Q5) | Agreed | Oct 7, 2026 |
| D-54 | Employees can view the public holidays calendar, read-only. | FR-PH-1 (permissions.md Q6) | Agreed | Oct 7, 2026 |
| D-55 | No Swagger / OpenAPI in the MVP. The API contract is the shared zod schemas in `packages/shared`, `api-conventions.md` and its endpoint list. Reconsider when a second client (mobile app, integrations) needs the API. | Appendix B, D-30 | Agreed | Oct 7, 2026 |
| D-56 | The browser calls the API through `/api/...` on the web app (the session cookie goes automatically); Next.js server code calls `API_URL` directly and forwards the incoming `cookie` header. JavaScript never reads the session token. | D-24, api-conventions.md §10 | Agreed | Oct 7, 2026 |
| D-57 | A record of another company is answered with 404, as if it did not exist; a record of the same company that the user may not touch is answered with 403 `forbidden`. | NFR-1, FR-UA-5, api-conventions.md §6 | Agreed | Oct 7, 2026 |
| D-58 | `AuditService.record(db, userId, entry)` takes the transaction the change runs in, so the change and its audit row are saved together or not at all. The caller passes `userId` (from `req.auth`); `null` means a scheduled job. The company always comes from the badge. | FR-DB-4, NFR-8, D-25 | Proposed | Oct 9, 2026 |
| D-59 | `audit_log.reason` is optional in the database. Each feature's service requires a reason where the SRS does (punch corrections FR-AT-5, payroll reopen FR-PR-6). | FR-AT-5, FR-PR-6 | Proposed | Oct 9, 2026 |
| D-60 | The audit log is append-only in PostgreSQL itself: a trigger refuses every UPDATE and DELETE on `audit_log`, whoever runs it. Only the e2e test cleanup skips it, inside its own transaction, with `session_replication_role = replica`. | NFR-8 | Proposed | Oct 9, 2026 |
