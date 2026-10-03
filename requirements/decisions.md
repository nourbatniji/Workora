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
| D-06 | Failed logins lock the user account only (5 attempts, 15 minutes). They never change the employee record. User account status is separate from employment status. | FR-UA-8, NFR-2 | Agreed (SRS) |
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
