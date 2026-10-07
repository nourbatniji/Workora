# MDARJ (Workora) — Permission Matrix

SCRUM-166 · UA-11 · Oct 7, 2026 · @trendow · Status: **Agreed — Oct 7, 2026** (open questions decided as D-49 to D-54)

## Why this file exists

Login answers *who are you*. The company badge answers *which company*. This file answers **what each role may do**.
SCRUM-33 (UA-05) turns every cell into a server check, and the permission tests use this file as their list.
Hiding a button in Next.js never counts: the server refuses the request.

## Roles (from SRS 2.2)

| Role | Who |
| --- | --- |
| Admin | Company owner or HR staff. A company can have several Admins (FR-UA-7) |
| Employee | Every hired employee, trainees included. Their login is linked to their employee record (`users.employee_id`) |
| Interviewer | A user named on an interview (MVP-2, with recruitment) |

## What a cell means

| Cell | Meaning |
| --- | --- |
| **all** | Allowed for every record of their own company (never another company: tenancy already blocks that) |
| **own** | Allowed only for records that belong to them (the employee linked to their login) |
| **assigned** | Allowed only for candidates on interviews they are named on (Interviewer) |
| **no** | Refused with 403 |

Every row names the SRS rule it comes from. Where the SRS was silent, the cell names the decision that settled it (D-49 to D-54).

---

## 1. Employees

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| List, search, filter employees | all | no | no | FR-EM-9 | Only HR manages staff |
| Export the employee list to Excel | all | no | no | FR-EM-9 | Same as the list |
| Create an employee | all | no | no | FR-EM-1 | Only the Admin adds people |
| View an employee profile (personal and job data) | all | own | no | FR-EM-8, FR-EM-10 | Employees see their own profile only |
| View national ID, salary and documents | all | own | no | NFR-3 | "Visible only to Admins and the employee concerned" |
| View the disability field | all | no | no | D-04, NFR-3 | Admins only, even for the employee themselves |
| Edit personal or job data | all | no | no | FR-EM-10 | "Only the Admin edits data" |
| Send a correction request | no | own | no | FR-EM-10 | Employees ask; the Admin edits |
| Add a salary change | all | no | no | FR-EM-4 | Salary is HR's decision |
| Add or end a recurring pay item | all | no | no | FR-EM-5 | Part of payroll set-up |
| Upload or delete an employee document | all | no | no | FR-EM-6, FR-EM-10 | Only the Admin edits data |
| Change status (Active, Suspended, Terminated) | all | no | no | FR-EM-7 | HR decision, kept in status history |
| Delete an employee who has no records | all | no | no | FR-EM-11 | Mistakes only; with records → terminate instead |

**How SCRUM-33 will read this:** "List employees: Admin only" becomes `@Roles('admin')` on the route. "View profile: Employee own" becomes a check in the service: *if the caller is an Employee, the employee id must be their own, otherwise 403.*

---

## 2. Company settings and job titles

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| Run the setup wizard | all | no | no | FR-CS-2 | The wizard "walks the Admin" through set-up |
| View the company profile and settings pages | all | no | no | FR-CS-3, FR-CS-8 | Settings are HR's tools. Everyone still sees the company name and logo through their own session and payslips |
| Edit the company profile | all | no | no | FR-CS-3 | Only HR configures the company |
| Edit work week, payroll, compliance or check-in settings (new dated version) | all | no | no | FR-CS-4…8 | These change money and attendance rules |
| View settings history | all | no | no | FR-CS-8 | Part of the settings pages |
| Add, rename or remove a job title | all | no | no | FR-CS-9 | "Managed in Settings" |

## 3. Users and access

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| List users and their account status | all | no | no | FR-UA-8 | Account management is HR's job |
| Invite an Employee or Interviewer (7-day link) | all | no | no | FR-UA-1, FR-UA-2 | "The Admin creates them" |
| Invite another Admin | all | no | no | FR-UA-7 | "An Admin can invite a user as Admin" |
| Issue a new invite link (password reset without email) | all | no | no | FR-UA-4 | "The Admin generates a new invite link" |
| Deactivate a user / change a user's role | all | no | no | FR-UA-7, FR-UA-9 | Never the last Active Admin (business rule, see below) |
| View own account, log out, change own language and password | own | own | own | FR-UA-3, FR-UA-4 | Everyone manages their own login |

## 4. Contracts

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| List and filter contracts | all | no | no | FR-CT-4 | HR follows expiring contracts |
| Upload a contract / renew a contract | all | no | no | FR-CT-1, FR-CT-3 | "The Admin uploads a contract" |
| View a contract (file, dates, agreed salary) | all | own (D-50) | no | FR-EM-8, NFR-3 | The Contract tab is on the profile, and salary and documents are visible to "the employee concerned" |

## 5. Shifts and roster

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| Create, edit or archive shift templates | all | no | no | FR-SH-1 | Scheduling is HR's job |
| Assign a shift to an employee | all | no | no | FR-SH-2 | Same |
| Override one roster day | all | no | no | FR-SH-6 | Same, with a reason that is logged |
| View the weekly roster grid (everyone) | all | no (D-51) | no | FR-SH-7 | The SRS gives employees only "their own upcoming shifts" |
| View upcoming shifts | all | own | no | FR-SH-7 | "Employees see their own upcoming shifts" |

## 6. Public holidays

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| Add, edit or remove holidays; load the Egyptian preset; confirm dates | all | no | no | FR-PH-1, FR-PH-2 | HR keeps the calendar |
| View the holiday calendar | all | all (D-54) | no | FR-PH-1 | Read-only and not personal; helps employees plan leave |

## 7. Attendance

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| Check in and check out | own (D-49) | own | no | FR-AT-1, FR-AT-2 | Only for one's own shift; Suspended employees cannot check in (business rule) |
| View the "today" board | all | no | no | FR-AT-6 | HR's live view of everyone |
| View a monthly attendance calendar | all | own | no | FR-AT-6, FR-EM-8 | Attendance tab of the employee's own profile |
| Add or correct a punch (with reason) | all | no | no | FR-AT-5 | "The Admin can add or correct a punch" |
| Export attendance to Excel | all | no | no | FR-AT-7 | Report for HR |

## 8. Attendance exceptions

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| List exceptions | all | own | no | FR-EX-2, FR-EX-3, FR-DB-2 | Employees see their own to explain them |
| Add a reason and attachment (within 3 days) | no | own | no | FR-EX-3 | "The employee can add a reason to their own exception"; the Admin decides instead |
| Approve, reject, edit amount, convert to leave | all | no | no | FR-EX-4 | "The Admin chooses" |
| Bulk approve or reject | all | no | no | FR-EX-6 | Same decision, many at once |
| Enter the real time for a missing check-out | all | no | no | FR-EX-5 | "The Admin enters the actual check-out time" |

## 9. Leave

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| Create or edit leave types | all | no | no | FR-LV-1, FR-LV-2 | Company policy |
| View leave types | all | all | no | FR-LV-1, FR-LV-5 | An employee picks a type when requesting leave |
| Enter opening balances | all | no | no | FR-LV-3 | Set-up by HR |
| View leave balances | all | own | no | FR-LV-3, FR-DB-2 | Employee home shows "leave balances" |
| Request leave | own (D-49) | own | no | FR-LV-5 | "An employee requests leave" |
| Cancel a pending request | own (D-49) | own | no | FR-LV-8 | "The employee can cancel a pending request" |
| Approve or reject a request | all | no | no | FR-LV-7 | "The Admin approves or rejects" |
| Cancel an approved future leave | all | no | no | FR-LV-8 | "The Admin can cancel an approved future leave" |
| View the leave calendar (who is off) | all | no (D-52) | no | FR-LV-9 | Shows other people's absences |

## 10. Payroll

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| Create a monthly run | all | no | no | FR-PR-1 | "The Admin creates one payroll run per month" |
| Add manual lines | all | no | no | FR-PR-4 | "The Admin can add manual lines" |
| Approve, mark Paid, reopen (with reason) | all | no | no | FR-PR-6 | "An Admin can reopen"; a Paid run never reopens (business rule) |
| View the register and export it | all | no | no | FR-PR-8 | Everyone's salaries |
| View a payslip | all | own | no | FR-PR-7 | "Employees see their own payslips once the run is approved" (business rule: not while Draft) |

## 11. Dashboard, notifications and audit

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| View the Admin dashboard | all | no | no | FR-DB-1 | Company-wide counts |
| View the employee home | own (D-49) | own | no | FR-DB-2 | Today's shift, balances, own requests, latest payslip |
| View and mark notifications as read | own | own | own | FR-DB-3 | Each user's own notifications |
| View the audit log | all | no | no | FR-DB-4, development-plan S11 | "Audit log viewer for Admins" |

## 12. Recruitment (MVP-2)

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| List candidates (board and list) | all | no | assigned | FR-RC-3, FR-UA-5 | "An Interviewer sees only the candidates on their interviews" |
| Create or edit a candidate, change status | all | no | no | FR-RC-1…4 | HR runs the pipeline |
| Add a note | all | no | no (D-53) | FR-RC-5 | The SRS gives interviewers interview notes (FR-RC-6), not candidate notes |
| Schedule an interview | all | no | no | FR-RC-6 | HR organises interviews |
| Record interview result, score and notes | all | no | assigned | FR-RC-6, SRS 2.2 | Only on interviews they are named on |
| Convert a hired candidate / delete a non-hired candidate | all | no | no | FR-RC-9, FR-RC-10 | "The Admin can delete a candidate" |

## 13. AI compliance (MVP-2)

| Action | Admin | Employee | Interviewer | Source | Why |
| --- | --- | --- | --- | --- | --- |
| View findings and company status | all | no | no | FR-AI-7, FR-AI-8 | HR's review list ("review before acting") |
| Run check now | all | no | no | FR-AI-7 | "The Admin can press Run check now" |
| Dismiss a finding (with reason) | all | no | no | FR-AI-8 | HR decision |
| Explain a finding | all | no | no | FR-AI-9 | Only people who can see findings |

---

## Rules that are not role checks

These depend on the data, not on the role, so they live in the **service** (business logic), not in `@Roles`. SCRUM-33 tests the role cells; each feature tests its own rules.

| Rule | Source |
| --- | --- |
| A company always keeps at least one Active Admin | FR-UA-9 |
| An employee with any records cannot be deleted | FR-EM-11 |
| A Suspended employee cannot check in | FR-AT-2, D-37 |
| An employee's reason on an exception is accepted only within 3 days | FR-EX-3 |
| An employee sees a payslip only after the run is approved | FR-PR-7 |
| A Paid payroll run can never be reopened | FR-PR-6 |
| Only future approved leave can be cancelled | FR-LV-8 |

## Decided questions (the SRS was silent — agreed Oct 7, 2026)

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| Q1 → D-49 | An Admin who is also an employee: can they check in, request leave and see their own home and payslip? | **Yes, for their own record only** — an Admin with a linked employee record also gets every Employee "own" right. An Admin with no employee record has nothing to check in to | Small companies: the owner or HR person is often on the payroll too |
| Q2 → D-50 | Can an Employee see their own contract (file, dates, agreed salary)? | **Yes (own)** | NFR-3 makes salary and documents visible to "the employee concerned", and the Contract tab is on the profile (FR-EM-8) |
| Q3 → D-51 | Can Employees see the full weekly roster grid? | **No — own shifts only** | FR-SH-7 gives employees "their own upcoming shifts"; the grid shows everyone |
| Q4 → D-52 | Can Employees see the leave calendar (who is off)? | **No in the MVP** | It shows other people's absences; can be opened later if companies ask |
| Q5 → D-53 | Can an Interviewer add candidate notes? | **No — interview result, score and notes only** | FR-RC-6 gives them their interview; FR-RC-5 notes are HR's |
| Q6 → D-54 | Can Employees see the public holidays calendar? | **Yes, read-only** | Not personal data, and it helps plan leave |

## Done when (SCRUM-166)

- Every MVP module has a table ✅
- Checked against SRS 2.2, FR-UA-5, FR-UA-7, FR-UA-9 and FR-EM-10 ✅
- Q1–Q6 decided by Trendow and recorded in `decisions.md` as D-49 to D-54 ✅
- SCRUM-33 and the permission tests (QA-02) use this file as their source
