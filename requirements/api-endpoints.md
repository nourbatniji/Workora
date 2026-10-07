# MDARJ (Workora) — API Endpoint Map

SCRUM-167 · Stage 5 (API design) · Oct 7, 2026 · @trendow · Status: **Planned**

## What this file is

The whole API on one page: every endpoint Workora needs for the MVP and MVP-2, planned from the SRS and `permissions.md`.
It follows the rules in `api-conventions.md` (names, methods, errors, lists).

- **Planned, not built.** Each endpoint is built in its feature slice (Story column). When it is built, its exact request and response go into `api-conventions.md` §12 and its status here becomes ✅.
- **Access** comes from `permissions.md`: *Public* (no login) · *Any user* (logged in, own account) · *Admin* · *Employee own* (only their own records) · *Interviewer assigned*.
- **`/me/...`** means "the logged-in person's own data" — the server takes the employee from the session, so the client never sends an employee id for its own records.
- Things that run on a schedule (roster generation, attendance labels, leave grants, compliance check) are **jobs, not endpoints** — listed at the end.

Legend: ✅ built · ⬜ planned

---

## 1. Authentication and own account

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | POST | `/auth/sign-up` | Create the company and its first Admin | Public | FR-CS-1 | CS-01 |
| ✅ | POST | `/auth/login` | Log in with email or phone; sets the session cookie | Public | FR-UA-3 | UA-03 |
| ✅ | GET | `/auth/me` | Who is logged in (user, role, company) | Any user | FR-UA-3 | UA-03 |
| ✅ | POST | `/auth/logout` | End this session | Any user | D-24 | UA-03 |
| ⬜ | GET | `/auth/invites/:token` | Check an invite link is valid (show the set-password page) | Public | FR-UA-1 | UA-01 |
| ⬜ | POST | `/auth/invites/:token/accept` | Set the password; the account becomes Active | Public | FR-UA-1 | UA-01 |
| ⬜ | POST | `/auth/password-reset` | Ask for a reset email | Public | FR-UA-4 | UA-04 |
| ⬜ | POST | `/auth/password-reset/:token` | Set a new password from the email link | Public | FR-UA-4 | UA-04 |
| ⬜ | PATCH | `/auth/me` | Change own language | Any user | NFR-6 | UA-04 |
| ⬜ | POST | `/auth/me/password` | Change own password (current + new) | Any user | NFR-2 | UA-04 |

## 2. Users and invites

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/users` | List users with role and account status | Admin | FR-UA-8 | UA-01 |
| ⬜ | POST | `/users` | Create a user (Employee, Interviewer or Admin) and return the 7-day invite link; emails it when an email exists | Admin | FR-UA-1, FR-UA-2, FR-UA-7 | UA-01, UA-02, UA-07 |
| ⬜ | POST | `/users/:id/invite` | Issue a new invite link (resend, or reset without email) | Admin | FR-UA-2, FR-UA-4 | UA-02, UA-04 |
| ⬜ | PATCH | `/users/:id` | Change role (never the last Active Admin) | Admin | FR-UA-7, FR-UA-9 | UA-07, UA-10 |
| ⬜ | POST | `/users/:id/deactivate` | Switch a login off (never the last Active Admin) | Admin | FR-UA-8, FR-UA-9 | UA-07, UA-10 |
| ⬜ | POST | `/users/:id/activate` | Switch a login back on | Admin | FR-UA-8 | UA-07 |

## 3. Company settings and job titles

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/company` | Company profile, law mode and rules text | Admin | FR-CS-3, FR-CS-6 | CS-03 |
| ⬜ | PATCH | `/company` | Edit profile, law mode, company rules text | Admin | FR-CS-3, FR-CS-6 | CS-03, CS-06 |
| ⬜ | GET | `/company/settings?date=` | The settings version in force on a date (default today) | Admin | FR-CS-8 | CS-08 |
| ⬜ | GET | `/company/settings/versions` | Settings history | Admin | FR-CS-8 | CS-08 |
| ⬜ | POST | `/company/settings/versions` | Save new settings from an effective date (work week, payroll, check-in); returns compliance warnings from MVP-2 | Admin | FR-CS-4, FR-CS-5, FR-CS-7, FR-CS-8 | CS-04, CS-05, CS-07, CS-08 |
| ⬜ | GET | `/company/setup` | Which setup-wizard steps are done or skipped | Admin | FR-CS-2 | CS-02 |
| ⬜ | PATCH | `/company/setup` | Mark a wizard step done or skipped | Admin | FR-CS-2 | CS-02 |
| ⬜ | GET | `/job-titles` | List job titles | Admin | FR-CS-9 | CS-09 |
| ⬜ | POST | `/job-titles` | Add a job title | Admin | FR-CS-9 | CS-09 |
| ⬜ | PATCH | `/job-titles/:id` | Rename a job title | Admin | FR-CS-9 | CS-09 |
| ⬜ | DELETE | `/job-titles/:id` | Remove a job title (refused while employees use it, D-48) | Admin | FR-CS-9 | CS-09 |

## 4. Employees

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/employees` | List with search and filters (status, employment type, job title, shift) | Admin | FR-EM-9 | EM-09 |
| ⬜ | GET | `/employees/export` | Excel of the filtered list | Admin | FR-EM-9 | EM-09 |
| ⬜ | POST | `/employees` | Create an employee; the system assigns the code | Admin | FR-EM-1, FR-EM-2, FR-EM-3 | EM-01, EM-02, EM-03 |
| ⬜ | GET | `/employees/:id` | Profile (personal and job data); disability field Admin-only | Admin · Employee own | FR-EM-8, FR-EM-10, NFR-3, D-04 | EM-08, EM-10 |
| ⬜ | PATCH | `/employees/:id` | Edit personal or job data | Admin | FR-EM-2, FR-EM-3 | EM-02, EM-03 |
| ⬜ | DELETE | `/employees/:id` | Delete an employee created by mistake (refused when they have records) | Admin | FR-EM-11 | EM-07 |
| ⬜ | GET | `/employees/:id/salary-history` | Salary history | Admin · Employee own | FR-EM-4, NFR-3 | EM-04 |
| ⬜ | POST | `/employees/:id/salary-history` | Add a salary from an effective date (audited) | Admin | FR-EM-4 | EM-04 |
| ⬜ | GET | `/employees/:id/pay-items` | Recurring additions and deductions | Admin | FR-EM-5 | EM-05 |
| ⬜ | POST | `/employees/:id/pay-items` | Add a recurring pay item | Admin | FR-EM-5 | EM-05 |
| ⬜ | PATCH | `/employees/:id/pay-items/:itemId` | End or change a recurring pay item | Admin | FR-EM-5 | EM-05 |
| ⬜ | GET | `/employees/:id/status-history` | Status changes with date, reason and user | Admin · Employee own | FR-EM-7 | EM-07 |
| ⬜ | POST | `/employees/:id/status-changes` | Suspend, terminate or reactivate (date and reason; termination switches the login off on that date) | Admin | FR-EM-7, FR-UA-6, D-37 | EM-07, UA-06 |
| ⬜ | GET | `/employees/:id/documents` | List documents with type and expiry | Admin · Employee own | FR-EM-6, NFR-3 | EM-06 |
| ⬜ | POST | `/employees/:id/documents` | Upload a document (PDF, JPG, PNG, max 10 MB) | Admin | FR-EM-6, NFR-3 | EM-06 |
| ⬜ | GET | `/employees/:id/documents/:documentId/file` | Short-lived signed link to the file | Admin · Employee own | NFR-3 | EM-06 |
| ⬜ | DELETE | `/employees/:id/documents/:documentId` | Delete a document (audited) | Admin | FR-EM-6, FR-DB-4 | EM-06 |
| ⬜ | POST | `/me/correction-requests` | Ask HR to correct own data | Employee own | FR-EM-10 | EM-10 |
| ⬜ | GET | `/correction-requests` | Correction requests to handle | Admin | FR-EM-10 | EM-10 |

## 5. Contracts

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/contracts` | List with computed status filter (Upcoming, Active, Expiring soon, Expired) | Admin | FR-CT-2, FR-CT-4 | CT-02, CT-04 |
| ⬜ | GET | `/employees/:id/contracts` | An employee's contracts and renewal chain | Admin · Employee own | FR-CT-3, D-50 | CT-03 |
| ⬜ | POST | `/employees/:id/contracts` | Upload a contract (file, type, dates, agreed salary, notes) | Admin | FR-CT-1 | CT-01 |
| ⬜ | POST | `/contracts/:id/renew` | Create the next contract linked to this one | Admin | FR-CT-3 | CT-03 |
| ⬜ | GET | `/contracts/:id/file` | Short-lived signed link to the contract file | Admin · Employee own | NFR-3, D-50 | CT-01 |

## 6. Shifts and roster

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/shift-templates` | List shift templates | Admin | FR-SH-1 | SH-01 |
| ⬜ | POST | `/shift-templates` | Create a template (times, crosses midnight, break, grace, days) | Admin | FR-SH-1 | SH-01 |
| ⬜ | PATCH | `/shift-templates/:id` | Edit a template (only days not started change) | Admin | FR-SH-1, FR-SH-4 | SH-01 |
| ⬜ | POST | `/shift-templates/:id/archive` | Archive a template | Admin | FR-SH-1 | SH-01 |
| ⬜ | GET | `/employees/:id/shift-assignments` | An employee's shift assignments | Admin | FR-SH-2 | SH-02 |
| ⬜ | POST | `/employees/:id/shift-assignments` | Assign a template from a start date | Admin | FR-SH-2 | SH-02 |
| ⬜ | GET | `/roster?from=&to=` | Weekly grid: employees by days | Admin | FR-SH-7, D-51 | SH-07 |
| ⬜ | PATCH | `/roster/:entryId` | Override one day (other shift or day off, with reason) | Admin | FR-SH-6 | SH-06 |
| ⬜ | GET | `/me/shifts?from=&to=` | Own upcoming shifts | Employee own | FR-SH-7, D-51 | SH-07 |

## 7. Public holidays

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/holidays?year=` | Holiday calendar | Admin · Employee (read-only, D-54) | FR-PH-1 | PH-01 |
| ⬜ | POST | `/holidays` | Add a holiday (date or range, paid) | Admin | FR-PH-1 | PH-01 |
| ⬜ | PATCH | `/holidays/:id` | Edit a holiday, or confirm a "date to confirm" | Admin | FR-PH-1, FR-PH-2 | PH-01, PH-02 |
| ⬜ | DELETE | `/holidays/:id` | Remove a holiday | Admin | FR-PH-1 | PH-01 |
| ⬜ | POST | `/holidays/import-preset` | Load the Egyptian holidays for a year | Admin | FR-PH-2 | PH-02 |

## 8. Attendance

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | POST | `/me/attendance/check-in` | Check in to today's shift (server time, IP, window and IP rules) | Employee own (Admin own, D-49) | FR-AT-1, FR-AT-2, FR-AT-8 | AT-01, AT-02 |
| ⬜ | POST | `/me/attendance/check-out` | Check out (check-out window) | Employee own (Admin own, D-49) | FR-AT-1, FR-AT-2, FR-AT-3 | AT-01, AT-02, AT-03 |
| ⬜ | GET | `/me/attendance?month=` | Own monthly calendar and totals | Employee own | FR-AT-6 | AT-07 |
| ⬜ | GET | `/attendance/today` | Today board: in, late, not yet in, absent, on leave | Admin | FR-AT-6 | AT-07 |
| ⬜ | GET | `/employees/:id/attendance?month=` | An employee's monthly calendar and totals | Admin · Employee own | FR-AT-6 | AT-07 |
| ⬜ | POST | `/employees/:id/attendance` | Add a missing punch (reason required, audited) | Admin | FR-AT-5 | AT-05 |
| ⬜ | PATCH | `/attendance/:recordId` | Correct a punch (reason required, audited) | Admin | FR-AT-5 | AT-05 |
| ⬜ | GET | `/attendance/export?month=` | Excel of the month | Admin | FR-AT-7 | AT-08 |

## 9. Attendance exceptions

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/exceptions` | List with suggested amounts and policy (filters: status, type, month, employee) | Admin · Employee own | FR-EX-2, FR-EX-3 | EX-02 |
| ⬜ | GET | `/exceptions/:id` | One exception with its decision record | Admin · Employee own | FR-EX-2, FR-EX-7 | EX-02, EX-07 |
| ⬜ | POST | `/exceptions/:id/reason` | Add own reason and attachment (within 3 days) | Employee own | FR-EX-3 | EX-03 |
| ⬜ | POST | `/exceptions/:id/decision` | Approve, reject, edit amount and approve, or convert to leave | Admin | FR-EX-4, FR-EX-7 | EX-04, EX-07 |
| ⬜ | POST | `/exceptions/bulk-decision` | Approve or reject a filtered selection | Admin | FR-EX-6 | EX-06 |
| ⬜ | POST | `/exceptions/:id/check-out-time` | Enter the real check-out time; the day is recalculated | Admin | FR-EX-5 | EX-05 |

## 10. Leave

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/leave-types` | Leave types (Employees need them to request leave) | Admin · Employee (read-only) | FR-LV-1 | LV-01 |
| ⬜ | POST | `/leave-types` | Create a leave type | Admin | FR-LV-1 | LV-01 |
| ⬜ | PATCH | `/leave-types/:id` | Edit a leave type (statutory types never below the law) | Admin | FR-LV-1, FR-LV-2 | LV-01, LV-02 |
| ⬜ | GET | `/leave-balances?year=&employeeId=` | Balances: granted, used, remaining | Admin | FR-LV-3 | LV-03 |
| ⬜ | POST | `/employees/:id/leave-balances` | Enter an opening balance (audited) | Admin | FR-LV-3, FR-DB-4 | LV-03 |
| ⬜ | GET | `/me/leave-balances?year=` | Own balances | Employee own | FR-LV-3, FR-DB-2 | LV-03 |
| ⬜ | GET | `/leave-requests` | Requests (filters: status, employee, dates) | Admin · Employee own | FR-LV-5, FR-LV-7 | LV-05, LV-07 |
| ⬜ | POST | `/leave-requests/preview` | Days the request would use and any rule that fails, without saving | Employee own (Admin own, D-49) | FR-LV-5, FR-LV-6 | LV-05, LV-06 |
| ⬜ | POST | `/leave-requests` | Request leave (full or half day, reason, attachment) | Employee own (Admin own, D-49) | FR-LV-5, FR-LV-6 | LV-05, LV-06 |
| ⬜ | POST | `/leave-requests/:id/approve` | Approve (rules checked again, balance and roster updated) | Admin | FR-LV-7 | LV-07 |
| ⬜ | POST | `/leave-requests/:id/reject` | Reject with an optional note | Admin | FR-LV-7 | LV-07 |
| ⬜ | POST | `/leave-requests/:id/cancel` | Cancel: own pending request, or (Admin) approved future leave | Admin · Employee own | FR-LV-8 | LV-08 |
| ⬜ | GET | `/leave-calendar?from=&to=` | Who is off on which days | Admin (D-52) | FR-LV-9 | LV-09 |

## 11. Payroll

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/payroll-runs` | List runs by month with status | Admin | FR-PR-1 | PR-01 |
| ⬜ | POST | `/payroll-runs` | Create the run for a month (pro-rated base, automatic lines) | Admin | FR-PR-1, FR-PR-2, FR-PR-3 | PR-01, PR-02, PR-03 |
| ⬜ | GET | `/payroll-runs/:id` | Run detail: employees, lines with their source, warnings | Admin | FR-PR-3, FR-PR-5 | PR-03, PR-05 |
| ⬜ | POST | `/payroll-runs/:id/recalculate` | Rebuild automatic lines of a Draft run | Admin | FR-PR-3 | PR-03 |
| ⬜ | POST | `/payroll-runs/:id/lines` | Add a manual line (bonus, penalty, insurance, tax…) | Admin | FR-PR-4 | PR-04 |
| ⬜ | DELETE | `/payroll-runs/:id/lines/:lineId` | Remove a manual line from a Draft run | Admin | FR-PR-4 | PR-04 |
| ⬜ | POST | `/payroll-runs/:id/approve` | Approve and lock (negative net needs confirmation) | Admin | FR-PR-5, FR-PR-6 | PR-05, PR-07 |
| ⬜ | POST | `/payroll-runs/:id/reopen` | Back to Draft with a reason (never a Paid run; audited) | Admin | FR-PR-6 | PR-07 |
| ⬜ | POST | `/payroll-runs/:id/mark-paid` | Mark Paid with an optional date | Admin | FR-PR-6 | PR-07 |
| ⬜ | GET | `/payroll-runs/:id/register?format=` | Register with totals, as Excel or PDF | Admin | FR-PR-8 | PR-09 |
| ⬜ | GET | `/payroll-runs/:id/payslips/:employeeId` | One employee's payslip PDF | Admin | FR-PR-7 | PR-08 |
| ⬜ | GET | `/me/payslips` | Own payslips of approved runs | Employee own (Admin own, D-49) | FR-PR-7 | PR-08 |
| ⬜ | GET | `/me/payslips/:runId` | Own payslip PDF (approved runs only) | Employee own (Admin own, D-49) | FR-PR-7 | PR-08 |

## 12. Dashboard, notifications and audit

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/dashboard` | Admin dashboard counts (attendance, pending leave and exceptions, contracts, compliance, candidates) | Admin | FR-DB-1, FR-CT-4 | DB-01, CT-04 |
| ⬜ | GET | `/me/home` | Employee home: today's shift, balances, own requests, latest payslip | Employee own (Admin own, D-49) | FR-DB-2 | DB-02 |
| ⬜ | GET | `/me/notifications` | Own notifications with unread count | Any user | FR-DB-3 | DB-03a, DB-03 |
| ⬜ | POST | `/me/notifications/:id/read` | Mark one as read | Any user | FR-DB-3 | DB-03a |
| ⬜ | POST | `/me/notifications/read-all` | Mark all as read | Any user | FR-DB-3 | DB-03a |
| ⬜ | GET | `/audit-log` | Audit entries (filters: employee, type, dates); no edit or delete route exists | Admin | FR-DB-4, NFR-8 | FND-07 |

## 13. Recruitment (MVP-2)

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/candidates` | Board and list, searchable | Admin · Interviewer assigned | FR-RC-3, FR-UA-5 | RC-03 |
| ⬜ | POST | `/candidates` | Add a candidate with CV; warns on duplicate phone or email | Admin | FR-RC-1, FR-RC-7 | RC-01, RC-07 |
| ⬜ | GET | `/candidates/:id` | Candidate record with status history, notes and interviews | Admin · Interviewer assigned | FR-RC-1, FR-RC-4 | RC-01, RC-04 |
| ⬜ | PATCH | `/candidates/:id` | Edit candidate data | Admin | FR-RC-1 | RC-01 |
| ⬜ | POST | `/candidates/:id/status` | Change status (reason for Rejected, follow-up date for On hold, bring back) | Admin | FR-RC-2, FR-RC-4, FR-RC-8 | RC-02, RC-04, RC-08 |
| ⬜ | POST | `/candidates/:id/notes` | Add a note | Admin (D-53) | FR-RC-5 | RC-05 |
| ⬜ | POST | `/candidates/:id/interviews` | Schedule an interview with interviewers | Admin | FR-RC-6 | RC-06 |
| ⬜ | PATCH | `/interviews/:id` | Record result, score and notes | Admin · Interviewer assigned | FR-RC-6 | RC-06 |
| ⬜ | GET | `/candidates/:id/cv` | Short-lived signed link to the CV | Admin · Interviewer assigned | FR-RC-1, NFR-3 | RC-01 |
| ⬜ | POST | `/candidates/:id/convert` | Create the employee from a Hired candidate | Admin | FR-RC-9 | RC-09 |
| ⬜ | DELETE | `/candidates/:id` | Delete a non-hired candidate with their files | Admin | FR-RC-10 | RC-10 |

## 14. AI compliance (MVP-2)

| | Method | Path | Purpose | Access | SRS | Story |
| --- | --- | --- | --- | --- | --- | --- |
| ⬜ | GET | `/compliance/summary` | Company status and per-employee green, yellow, red | Admin | FR-AI-7 | AI-08 |
| ⬜ | GET | `/compliance/findings` | Findings (filters: state, severity, employee) | Admin | FR-AI-8 | AI-09 |
| ⬜ | POST | `/compliance/run` | Run the check now (daily limit) | Admin | FR-AI-7 | AI-08 |
| ⬜ | POST | `/compliance/findings/:id/dismiss` | Dismiss with a reason | Admin | FR-AI-8 | AI-09 |
| ⬜ | POST | `/compliance/findings/:id/explain` | Plain-language explanation in the user's language | Admin | FR-AI-9 | AI-12 |

---

## Jobs (scheduled, no endpoint)

| Job | When | What | SRS | Story |
| --- | --- | --- | --- | --- |
| roster-generate | Nightly, and when an assignment, leave or holiday changes | Roster entries for the next 14 days | FR-SH-4, FR-SH-5 | SH-04, SH-05 |
| attendance-label | Every 15 minutes | Labels days whose check-out window closed; creates exceptions | FR-AT-4, FR-EX-1 | AT-04, EX-01 |
| leave-entitlement | Daily | Yearly grants and carry-over | FR-LV-4 | LV-04 |
| invite-expiry | Hourly | Expires invite links older than 7 days | FR-UA-1 | UA-01 |
| employee-termination | Daily | Switches off logins on the termination date | FR-UA-6 | UA-06 |
| compliance-nightly (MVP-2) | Nightly | Fact sheets, AI check, guardrail | FR-AI-2…FR-AI-5 | AI-02, AI-05, AI-06 |

## Totals

127 endpoints (4 built · 123 planned) across 14 sections · 6 scheduled jobs.
