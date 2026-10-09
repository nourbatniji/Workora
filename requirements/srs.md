# MDARJ HR & Payroll System — Software Requirements Specification

MVP + Roadmap · Consolidated Edition v1.6 · Oct 9, 2026 · @trendow

## Document information

This consolidated edition merges the original MVP SRS (Sep 30, 2026) with the Revised / Fixed Edition (Oct 1, 2026) and adds the release roadmap after the MVP. Where the two editions differ, the Oct 1 corrections apply.

Revision v1.2 (Oct 3, 2026) brings the SRS in line with the agreed decisions in `decisions.md` and the Nov 10, 2026 delivery plan. It replaces the Oct 1 consolidated text. The Sep 30 and Oct 1 PDF editions are superseded.

| Source edition | Date | What it contributes |
| --- | --- | --- |
| Revision v1.6 | Oct 9, 2026 | Data model (§5) matched to the built tables: documents belong to an employee through `employee_id` (D-47); audit_log gains company_id, entity_type, reason and is append-only (D-58 to D-60) |
| Revision v1.5 | Oct 6, 2026 | No limit on failed login attempts: the account lockout and the Locked account status are removed (D-46) |
| Revision v1.4 | Oct 5, 2026 | The user account stores the person's own name, for Admins and Interviewers with no employee record (D-41) |
| Revision v1.3 | Oct 3, 2026 | Gaps found in the SRS review closed: employee status history and Suspended rules, shift snapshots, settings history, punch and check-out rules, leave edge cases, Admin rules, deletion rules, wider audit log |
| Revision v1.2 | Oct 3, 2026 | Decisions D-01 to D-03 applied; release split into MVP and MVP-2; missing settings named; open items linked to `assumptions.md`; roadmap written out as text |
| Revised / Fixed Edition | Oct 1, 2026 | Maximum 50 employees per company for the MVP; failed logins lock the user account only; user account status; Appendix B implementation baseline |
| Original MVP SRS | Sep 30, 2026 | Full requirement wording and priorities, worked payroll example, Appendix A usage and severity, roadmap v1.1 to v4 |

The two corrections carried into every section:

- The MVP is designed, tested and optimized for companies with up to 50 employees.
- A user account's status changes access only. It never deletes, terminates, suspends or deactivates the employee record. (Since v1.5 there is no lockout after failed logins, D-46.)

Changes in v1.2:

- Appendix B: the backend is NestJS and the frontend is Next.js (D-01), replacing Django + DRF and React + Vite.
- Weekly rotation shifts (FR-SH-3) move to v1.1 (D-02). Section 2.4 and the shift\_assignments table are updated.
- The AI "Ask" chat (FR-AI-10) moves to v1.1 (D-03).
- New section 1.6 splits delivery into the MVP (Nov 10, 2026) and MVP-2 (Nov 16, 2026). Requirements that depend on MVP-2 say so.
- Settings that rules already used are now named: minimum overtime minutes (FR-CS-5), contract "expiring soon" days (FR-CT-2), AI daily limits (FR-AI-7, FR-AI-12).
- Section 2.5 links each open item to its working assumption in `assumptions.md`.
- Section 7.2 writes the roadmap out as text, with v1.1 updated.
- The disability field is decided (D-04): optional, shown only when law mode is on, visible only to Admins (FR-EM-2, FR-AI-2, NFR-3, employees table).

Changes in v1.3:

- Employee status changes are kept in a status history, and the Suspended status has defined rules (FR-EM-7, D-37). Employees with records are never deleted (FR-EM-11).
- Roster days keep a copy of their shift's break and grace values, so editing a template never changes past days (FR-SH-4).
- Settings are stored as dated versions (company\_settings\_versions table, D-27).
- One check-in and one check-out per shift; repeated taps are ignored (FR-AT-8). Check-out has a window after shift end, default 6 hours (FR-AT-2, BR-4, D-38).
- Everything from a shift belongs to the payroll month of its shift date (FR-AT-3).
- Leave: rules re-checked at approval (FR-LV-7), first or second half day (FR-LV-5), leave across 31 December split between years (BR-11).
- Contract agreed salary is reference only; payroll uses salary history (FR-CT-1).
- Admins can invite Admins, and a company always keeps one Active Admin (FR-UA-7, FR-UA-9). One email or phone belongs to one user in the whole system (FR-UA-3).
- Office IP list accepts ranges (FR-CS-7).
- Lateness plus early-leave deductions are capped at one day's pay (BR-7, D-39).
- Payroll reopening rules made explicit; Paid runs never reopen (FR-PR-6, BR-17).
- Admin can delete candidates who were not hired (FR-RC-10, D-40).
- Audit log covers more changes (FR-DB-4, NFR-8).

Changes in v1.4:

- The users table gets a name column, so the owner who signs up, other Admins and Interviewers have a name without an employee record (FR-CS-1, D-41).

## 1. Introduction

### 1.1 Purpose

This document specifies the first free version (MVP) of the MDARJ HR & Payroll System and the releases planned after it. It is the reference for design, development, testing and client sign-off. Anything not listed in sections 3 to 6 is out of scope for the MVP.

### 1.2 Product scope

The MVP covers the employee cycle from candidate to monthly salary in one web system:

- Company setup and policies
- Recruitment (candidates and interviews)
- Employee profiles and documents
- Contracts
- Shifts and roster
- Attendance and the attendance exceptions inbox
- Leave and public holidays
- Payroll (base salary + additions − deductions)
- AI compliance assistant powered by the OpenAI API (Egyptian Labor Law or company rules)

The MVP is offered free, so it favours simple, reliable features over advanced ones. Advanced features are planned in section 7. Recruitment and the AI compliance assistant are delivered in the second MVP release (MVP-2); see 1.6.

### 1.3 Definitions

| Term | Meaning |
| --- | --- |
| Company | One client organisation (tenant). Its data is isolated from every other company. |
| Admin / HR Manager | The company user who configures the system, manages HR data, and approves requests. |
| Employee | A person employed by the company, with a self-service login. |
| Candidate | A person in the recruitment pipeline. Not an employee until converted. |
| Leave (إجازة) | Time off an employee requests (annual, sick, casual, unpaid, etc.). |
| Public holiday (عطلة رسمية) | A calendar day off for the whole company. |
| Shift template | A named working period (start, end, break, grace). |
| Roster | The generated schedule of which employee works which shift on which date. |
| Attendance record | One employee's check-in and check-out for one shift date. |
| Attendance exception | A deviation detected by the system (late, early leave, absence, overtime, missing check-out) that needs a manager decision. |
| Payroll run | The monthly calculation of all salaries for one company and one month. |
| Compliance status | Green (no open finding), yellow (at risk) or red (open violation finding). |

### 1.4 References

- MDARJ HR & Payroll presentation, 28 July 2026 (scope marked by the client)
- Egyptian Labor Law No. 14 of 2025 (in force since 1 September 2025) and its executive regulations. The legal values in Appendix A are reference data only and must be confirmed against the official text and executive regulations with qualified legal review before launch.
- Egypt's Personal Data Protection Law No. 151 of 2020

### 1.5 Conventions

FR-XX-n = functional requirement, BR-n = business rule, NFR-n = non-functional requirement.

"Must" = required for the MVP. "Should" = required unless time runs short. "May" = optional.

Requirements marked "MVP-2" are delivered in the second MVP release (see 1.6). Requirements marked "v1.1" are moved out of the MVP and kept here for reference.

Currency is EGP. Dates use the Gregorian calendar.

### 1.6 Releases

| Release | Target date | What it contains |
| --- | --- | --- |
| MVP | Nov 10, 2026 | Everything in sections 3 to 6 that is not marked MVP-2 or v1.1 |
| MVP-2 | Nov 16, 2026 | Everything marked MVP-2: section 3.4 Recruitment, section 3.12 AI compliance, FR-CT-5, section 4.5 and NFR-9 |
| Pilot | December 2026 | One full month with a pilot company, from setup to payslips |
| v1.1 | 2–3 weeks after the MVP | FR-SH-3 and FR-AI-10, plus the v1.1 items in 7.2 |

The law reference in Appendix A (NFR-10) is loaded in the MVP, because FR-LV-2 pre-creates the statutory leave types from it.

Until MVP-2 ships, the screens that show recruitment or compliance data show an empty state: the employee Compliance tab (FR-EM-8), the dashboard compliance summary and candidate counts (FR-DB-1) and red-finding notifications (FR-DB-3).

## 2. Overall description

### 2.1 Product perspective

MDARJ HR is a multi-tenant web application (SaaS). Each company signs up, runs a setup wizard, and gets an isolated workspace. The system is used in a browser on desktop and phone; there is no native mobile app in the MVP.

### 2.2 User roles

There are no departments or reporting lines in the MVP, so every approval goes to an Admin / HR Manager. A company may have more than one Admin. For the MVP, Admin permissions are the same regardless of which Admin created the account.

| Role | Who | Can do |
| --- | --- | --- |
| Admin / HR Manager | Company owner or HR staff | Configure the company; manage employees, candidates, contracts, shifts, leave, payroll; approve all requests and exceptions; use the AI compliance assistant (MVP-2) |
| Employee | Every hired employee, including trainees | View own profile, check in and out, request leave, add reasons to own exceptions, view own payslips |
| Interviewer | A user named on an interview (MVP-2, with recruitment) | See the candidates assigned to them; record interview result, score and notes |

### 2.3 Operating environment

- Latest two versions of Chrome, Edge, Safari and Firefox, on desktop and mobile.
- Arabic (right-to-left) and English interfaces, switchable per user.
- Cloud hosting with a managed PostgreSQL database and object/file storage for documents.
- Time zone set per company (default Africa/Cairo).

### 2.4 Constraints

- The MVP is free and is designed, tested and optimized for companies with up to 50 employees.
- No paid third-party services except the OpenAI API (a small, low-cost model) and basic hosting.
- No fingerprint device integration, native mobile app, GPS or QR check-in in the MVP.
- No notification emails or WhatsApp messages in the MVP. Only transactional emails are sent (invites and password reset).
- The system gives compliance guidance, not legal advice.
- Social insurance and income tax are entered as manual deduction lines; the system does not calculate them.
- Compliance warnings and suggestions come from the OpenAI API, working on facts the application calculates. Attendance labels, exceptions and payroll amounts remain deterministic application logic.
- Contracts show an in-app "expiring soon" badge; no email alert is required.
- Office IP restriction for check-in is included as an optional company setting.
- Only fixed shifts are supported in the MVP. Weekly rotations move to v1.1 (FR-SH-3, D-02).
- Employees join by an invite link sent by HR; there is no public sign-up for employees.

### 2.5 Assumptions to confirm before development

- Final legal values in Appendix A must be verified before production launch (A-01). FR-LV-2 already uses them in the MVP, so the review is needed before a real company uses the system.
- Confirm the public-holiday overtime interpretation and the night-work definition used by the legal reference (EG-13). Until confirmed, public-holiday overtime uses the 2.00 multiplier and all overtime is classed as day overtime (A-03, A-04).
- The other working assumptions are listed in `assumptions.md`.

## 3. Functional requirements

### 3.1 Company setup and settings (CS)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CS-1 | A company owner signs up with company name, own name, email and password, and becomes the first Admin. The owner's name is stored on their user account (D-41). | Must |
| FR-CS-2 | After sign-up, a setup wizard walks the Admin through: company profile, work week, public holidays, job titles, shift templates, leave types, payroll settings, compliance mode, check-in settings. Each step can be skipped and finished later. | Must |
| FR-CS-3 | Company profile holds name, logo, address, phone, time zone (default Africa/Cairo) and currency (EGP). | Must |
| FR-CS-4 | Work week defines working days and weekly rest days (e.g. Friday and Saturday). | Must |
| FR-CS-5 | Payroll settings define: daily rate formula (monthly salary ÷ 30 by default, or ÷ 26, or ÷ working days of the month); hourly rate (BR-6); lateness policy (exact per minute, or tiered bands); overtime multipliers; minimum overtime minutes (default 30, BR-5). | Must |
| FR-CS-6 | Compliance mode is a yes/no choice: "Follow the Egyptian Labor Law". The Admin can also write company rules as free text (see 3.12). | Must |
| FR-CS-7 | Check-in settings: allowed check-in window before shift start (default 60 min); check-out window after shift end (default 6 hours, see FR-AT-2); an optional list of allowed office IP addresses or ranges (IPv4 or IPv6, single addresses or ranges such as 41.33.10.0/24). | Should |
| FR-CS-8 | Every setting can be changed later from Settings. A change applies from its effective date and never alters an approved payroll run. | Must |
| FR-CS-9 | Job titles are a company list managed in Settings and picked on each employee. | Must |

### 3.2 Users and access (UA)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-UA-1 | Employees and interviewers cannot sign up on their own. The Admin creates them and the system issues an invite link, valid 7 days, to set a password. | Must |
| FR-UA-2 | The invite link is sent by email when the person has one, and can always be copied so HR can share it by WhatsApp or SMS. | Must |
| FR-UA-3 | Users log in with email or phone number plus password. Workers without email use their phone number. An email address or phone number belongs to one user in the whole system, so login never asks which company; in the MVP a person cannot be a user of two companies (D-26). | Must |
| FR-UA-4 | Password reset: by email link when an email exists; otherwise the Admin generates a new invite link. | Must |
| FR-UA-5 | Permissions are enforced on the server. An Employee sees only their own data; an Interviewer sees only the candidates on their interviews. | Must |
| FR-UA-6 | Terminating an employee deactivates their login on the termination date. | Must |
| FR-UA-7 | A company can have several Admins. An Admin can invite a user as Admin, and can remove the Admin role from or deactivate another Admin. | Should |
| FR-UA-8 | User account status (Invited, Active, Deactivated) is distinct from employee employment status. Changing a user's account status changes access only; it never deletes, terminates, suspends or deactivates the employee record. | Must |
| FR-UA-9 | A company always keeps at least one Active Admin. The last Active Admin cannot be deactivated or lose the Admin role. | Must |

### 3.3 Employees (EM)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-EM-1 | The Admin creates an employee manually or, from MVP-2, by converting a hired candidate (3.4). The system assigns an employee code. | Must |
| FR-EM-2 | Personal data: full name (Arabic and English), national ID number, date of birth, gender, phone, email, address, emergency contact name and phone, profile photo. When law mode is on, an optional "has a disability" field is shown, visible only to Admins (D-04). | Must |
| FR-EM-3 | Job data: job title, employment type (full-time, part-time, trainee), hire date, probation end date, training end date (trainees), assigned shift, base salary with effective date. | Must |
| FR-EM-4 | Salary history: every base salary change is kept with its effective date; payroll uses the salary valid in each period. | Must |
| FR-EM-5 | Recurring pay items: fixed monthly allowances or deductions per employee (e.g. transport allowance) that are added to every payroll run automatically. | Should |
| FR-EM-6 | Documents: upload PDF, JPG or PNG files (max 10 MB each) with a document type and an optional expiry date. | Must |
| FR-EM-7 | Employee status: Active, Suspended or Terminated. Every change is kept in the status history with its effective date, reason and the user who made it. Termination records date and reason. A Suspended employee stays employed: no working shifts are scheduled for them, so they are never marked Absent; they can log in to view their own data and payslips but cannot check in; they stay in the payroll run with full base pay unless the Admin adds a manual deduction line (D-37). | Must |
| FR-EM-8 | The employee profile shows tabs: Personal, Job, Contract, Documents, Attendance, Leave, Payroll, Compliance. Until MVP-2, the Compliance tab shows an empty state. | Must |
| FR-EM-9 | The employee list can be searched and filtered by status, employment type, job title and shift, and exported to Excel. | Must |
| FR-EM-10 | Employees can view their own profile and request corrections; only the Admin edits data. | Should |
| FR-EM-11 | An employee who has any attendance, leave, contract, document or payroll record is never deleted; the Admin terminates them instead. An employee with no such records may be deleted (for example, one created by mistake). | Must |

### 3.4 Recruitment (RC)

Release: MVP-2. There are no job postings in the MVP. Candidates are added by the Admin and tracked through statuses.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-RC-1 | Candidate data: full name, phone, email, position applied for, source (referral, walk-in, social media, other), CV file, expected salary, date added. | Must |
| FR-RC-2 | Candidate statuses: New, Screening, Interview scheduled, Interviewed, Offer, Hired, On hold, Rejected, Withdrawn. | Must |
| FR-RC-3 | Candidates are shown on a board with one column per status (drag to move) and in a searchable list. | Must |
| FR-RC-4 | Every status change is logged with date, user and an optional comment. Rejected requires a reason; On hold takes an optional follow-up date. | Must |
| FR-RC-5 | Notes: any number of dated notes per candidate, each showing its author. | Must |
| FR-RC-6 | Interviews: several per candidate, each with date and time, type (in person, phone, online), interviewer(s), place or link, result (Pending, Passed, Failed), score 1–5 and notes. | Must |
| FR-RC-7 | The system warns when a new candidate has the same phone or email as an existing one. | Should |
| FR-RC-8 | Rejected and On hold candidates stay searchable and can be moved back into the pipeline. | Must |
| FR-RC-9 | "Convert to employee" on a Hired candidate creates an employee pre-filled with the candidate's data and keeps the link to the candidate record. | Must |
| FR-RC-10 | The Admin can delete a candidate who was not hired. The candidate's CV, documents, notes and interviews are deleted with them. A Hired candidate linked to an employee cannot be deleted (D-40). | Must |

### 3.5 Contracts (CT)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CT-1 | The Admin uploads a contract file (PDF, JPG or PNG, max 10 MB) to an employee and enters type (indefinite, fixed-term, trainee, part-time), start date, end date (required for fixed-term), agreed salary and notes. The agreed salary is for reference only: payroll always uses the salary history (FR-EM-4). If the agreed salary differs from the current base salary, the system shows a warning. | Must |
| FR-CT-2 | The system computes contract status: Upcoming, Active, Expiring soon (end date within the company's "expiring soon" days; company setting, default 30), Expired. | Must |
| FR-CT-3 | An employee has at most one Active contract at a time. A renewal creates a new contract linked to the previous one; history is kept. | Must |
| FR-CT-4 | The dashboard shows counts of Expiring soon and Expired contracts, and the contracts list can be filtered by status. | Must |
| FR-CT-5 | An expired contract of an Active employee creates a red compliance finding (3.12). | Must · MVP-2 |

### 3.6 Shifts and roster (SH)

The Admin sets shifts up once; the system then builds the daily roster on its own. The Admin only handles exceptions.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SH-1 | Shift template fields: name, start time, end time, crosses midnight (yes/no), unpaid break minutes, late grace minutes, early-leave grace minutes, working days of the week. | Must |
| FR-SH-2 | Fixed assignment: an employee is assigned one shift template from a start date. | Must |
| FR-SH-3 | Weekly rotation: an employee or group follows an ordered list of templates that repeats every N weeks from a start date (e.g. week 1 morning, week 2 evening, week 3 night). Moved to v1.1 (D-02); not built in the MVP. | v1.1 |
| FR-SH-4 | A nightly job generates roster entries (employee, shift date, shift template, expected start and end) for the next 14 days, and regenerates them when an assignment changes. Each entry keeps a copy of the template's break and grace minutes, so editing a template later never changes past days; a template edit rebuilds only days that have not started. | Must |
| FR-SH-5 | Roster generation marks weekly rest days, public holidays, approved leave and days when the employee is Suspended instead of a working shift. | Must |
| FR-SH-6 | The Admin can override one roster day (another shift, or a day off) with a reason; the change is logged. | Must |
| FR-SH-7 | A weekly roster grid shows employees by days; employees see their own upcoming shifts. | Must |

### 3.7 Attendance (AT)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AT-1 | The employee portal shows a Check in / Check out button for today's shift. The server time is recorded, never the device time; the IP address is stored with each punch. | Must |
| FR-AT-2 | Check-in is accepted from the configured window before shift start until shift end. Check-out is accepted from check-in until shift end plus the check-out window (company setting, default 6 hours). Suspended employees cannot check in. If an IP allow-list is set, a punch from another IP is refused with a clear message; the IP is read from the hosting's trusted proxy, never from a header the browser sends. | Must |
| FR-AT-3 | A check-out closes the open record for that shift. A night shift record belongs to its shift date, not the calendar date of the check-out. Labels, exceptions, overtime and payroll lines from a shift all belong to the payroll month that contains its shift date. | Must |
| FR-AT-4 | When each shift's check-out window closes (shift end plus the check-out window), the system labels the day: Present, Late, Early leave, Absent, Overtime, Missing check-out, On leave, Rest day, Public holiday. A day can carry more than one label (e.g. Late and Early leave). | Must |
| FR-AT-5 | The Admin can add or correct a punch with a mandatory reason; the original values and the change are kept in the audit log. | Must |
| FR-AT-6 | Views: a live "today" board (in, late, not yet in, absent, on leave); a monthly calendar per employee with totals of late minutes, absent days and overtime hours. | Must |
| FR-AT-7 | Monthly attendance can be exported to Excel. | Should |
| FR-AT-8 | Each employee has one attendance record per shift date, with one check-in and one check-out. A second check-in after check-out is refused. A repeated tap or a request sent twice is ignored and never recorded twice. | Must |

### 3.8 Attendance exceptions inbox (EX)

The system detects, the manager decides, the system calculates. Approved exceptions become payroll lines automatically.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-EX-1 | The system creates an exception for each Late, Early leave, Absent, Overtime and Missing check-out label that is beyond the grace minutes. | Must |
| FR-EX-2 | Each exception shows employee, date, type, minutes or days, the suggested amount in EGP (negative for deductions, positive for overtime) and the policy used to compute it. | Must |
| FR-EX-3 | The employee can add a reason and an attachment to their own exception within 3 days of its creation. | Must |
| FR-EX-4 | The Admin chooses: Approve, Reject, Edit amount and approve, or Convert to leave (pick a leave type; the time is taken from that balance instead of the salary). A note is optional. | Must |
| FR-EX-5 | For Missing check-out, the Admin enters the actual check-out time and the system recalculates the day. | Must |
| FR-EX-6 | Bulk approve and bulk reject work on a filtered selection (e.g. all late arrivals under 30 minutes this month). | Must |
| FR-EX-7 | Each decision stores who decided, when, and the final amount. | Must |
| FR-EX-8 | An exception decided after its month's payroll is approved goes to the next month's run as a carried-forward line. | Must |

### 3.9 Leave (LV)

Each company defines its own leave types and request rules; the system enforces them before the Admin sees a request.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-LV-1 | Leave type fields: name (Arabic and English), paid (yes/no), yearly entitlement in days, counted as working days or calendar days, minimum notice in hours (e.g. 48 or 72), exempt from notice (yes/no, for sick and emergency leave), maximum consecutive days, eligible after N months of service, attachment required (yes/no), gender restriction, maximum times per employment, carry-over allowed and its maximum days. | Must |
| FR-LV-2 | When law mode is on, the system pre-creates the statutory leave types from Appendix A; the Admin may make them more generous but not less. | Must |
| FR-LV-3 | Balances are kept per employee, per leave type, per year. Opening balances can be entered when a company starts using the system. | Must |
| FR-LV-4 | The yearly entitlement is granted on 1 January or on the eligibility date, optionally pro-rated by the months left in the year. Unused days carry over up to the type's maximum. | Must |
| FR-LV-5 | An employee requests leave with type, start date, end date, full day or half day (first half or second half of the shift), reason and attachment. A half day counts as 0.5 day; on a half-day leave, attendance is expected only for the other half of the shift. | Must |
| FR-LV-6 | The system validates the request against the rules in BR-10 to BR-15 and refuses it with the reason when a rule fails. | Must |
| FR-LV-7 | The Admin approves or rejects with an optional note. At the moment of approval the system checks BR-10 to BR-15 again; if a rule now fails (for example, another approved request used the balance), the approval is refused with the reason. On approval the balance is deducted and the roster days are marked On leave. | Must |
| FR-LV-8 | The employee can cancel a pending request. The Admin can cancel an approved future leave; the balance is restored. | Must |
| FR-LV-9 | A leave calendar shows who is off on which days. | Should |

### 3.10 Public holidays (PH)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PH-1 | Each company keeps a public holidays calendar per year: name, date or date range, paid (yes/no). | Must |
| FR-PH-2 | The system offers the Egyptian official holidays as a starting list; religious holidays whose dates vary are marked "date to confirm" until the Admin confirms them. | Must |
| FR-PH-3 | Public holidays are excluded from working-day leave counts and from expected attendance. | Must |
| FR-PH-4 | Work on a public holiday creates an Overtime exception at the holiday multiplier. | Must |

### 3.11 Payroll (PR)

The MVP formula is: net salary = base salary + additions − deductions. Social insurance and income tax are manual deduction lines. All payroll amounts are calculated by deterministic backend business logic. AI may review facts and rules but never calculates, approves, changes or writes payroll amounts.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PR-1 | The Admin creates one payroll run per month. It includes every employee who was Active on any day of that month. | Must |
| FR-PR-2 | Base salary is pro-rated by days for employees who joined or left during the month, using the company's daily rate formula. | Must |
| FR-PR-3 | Additions are pulled automatically from approved exceptions (overtime) and recurring allowances; deductions from approved exceptions (lateness, early leave, absence) and unpaid leave days. | Must |
| FR-PR-4 | The Admin can add manual lines per employee: bonus, allowance, penalty, advance repayment, social insurance, income tax, other; each with a label and an amount. | Must |
| FR-PR-5 | Before approval the run shows warnings: pending exceptions for the month, employees with no base salary, negative net salaries. | Must |
| FR-PR-6 | Run states: Draft, Approved (locked), Paid (optional payment date). An Admin can reopen an Approved run back to Draft with a mandatory reason that is logged; it must then be approved again. A Paid run can never be reopened. | Must |
| FR-PR-7 | Each employee gets a payslip (company, employee, month, base, every addition and deduction line, net) as a PDF. Employees see their own payslips once the run is approved. | Must |
| FR-PR-8 | The payroll register lists every employee's base, additions, deductions and net with column totals, exportable to Excel and PDF. | Must |

### 3.12 AI compliance and assistant (AI)

The system calculates the facts; the OpenAI API reads them with the law or company rules and returns warnings and suggestions. Attendance labels, exceptions and payroll amounts are always calculated in code, never by the AI. The AI never changes data.

Release: MVP-2, except FR-AI-10, which moves to v1.1.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AI-1 | Integration with the OpenAI API using a small, low-cost model (for example GPT-5 mini) with structured JSON output. The model name is a setting, so it can be changed without a release. | Must |
| FR-AI-2 | Every night the system builds a fact sheet per active employee from existing data: employment type, months of service, age band, contract type and end date, probation end, scheduled hours per day and week, rest days in the last 7 days, break minutes, leave granted and taken by type, overtime hours and the multiplier paid, maternity leave dates, has a disability (yes/no, law mode only). | Must |
| FR-AI-3 | Rules given to the AI: with law mode on, the versioned law reference in Appendix A plus the company's rules text; with law mode off, the company's rules text only. The Admin writes company rules as free text and they are sent as written. | Must |
| FR-AI-4 | Nightly check: fact sheets are sent in batches (e.g. 20 employees per call) with the rules. The AI returns findings: employee code, rule, severity (yellow or red), message, suggested action, and the facts it relied on. | Must |
| FR-AI-5 | Guardrail: the system checks that every fact a finding quotes matches the fact sheet. A finding that quotes a wrong value is discarded and logged. | Must |
| FR-AI-6 | Policy check: when the Admin saves leave types, shift templates or payroll settings, the AI compares them with the rules and returns warnings at once (e.g. annual leave set below the legal minimum). | Must |
| FR-AI-7 | An employee's status is the worst open finding: green with none, yellow at risk, red on a violation. The company status summarises the counts. The Admin can press "Run check now" a limited number of times a day (system setting, proposed default 3; A-32). | Must |
| FR-AI-8 | Finding states: Open, Resolved (the next run no longer reports it), Dismissed (with a reason). A new red finding creates an in-app notification. The dashboard and the employee Compliance tab list findings, each marked "AI suggestion, review before acting". | Must |
| FR-AI-9 | An "Explain" button on a finding returns a plain-language explanation and next step in the user's language. | Must |
| FR-AI-10 | The Admin can ask questions in Arabic or English. The assistant answers from the company rules, the law reference and the fact sheets, names the rule it relied on, and is read-only. Moved to v1.1 (D-03); not built in the MVP. | v1.1 |
| FR-AI-11 | Privacy: the AI receives employee codes, not names. National ID numbers, contact details, salary amounts and uploaded files are never sent. The system adds names back when it shows results. | Must |
| FR-AI-12 | Every AI output shows that it is guidance, not legal advice. AI calls per company per day are capped (system setting, proposed default 200; A-32). | Must |

### 3.13 Dashboard, notifications and audit (DB)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-DB-1 | Admin dashboard: today's attendance counts, pending leave requests, pending exceptions, contracts expiring or expired, compliance summary, candidates by status. The compliance summary and candidates by status are filled from MVP-2. | Must |
| FR-DB-2 | Employee home: today's shift and check-in button, leave balances, status of own requests, latest payslip. | Must |
| FR-DB-3 | In-app notification centre with unread count, for: leave requested or decided, exception created or decided, payslip available, red finding (from MVP-2), contract expiring. | Must |
| FR-DB-4 | An audit log records who changed what and when for salaries, punches, approvals, payroll runs, settings, employee status, contracts, user roles and account status, Admin changes, leave balance adjustments and document deletions. | Must |

## 4. Business rules

Every amount the system suggests follows from the rules below and the company's settings. Values marked "company setting" are examples, not law.

### 4.1 Attendance labels

| ID | Rule |
| --- | --- |
| BR-1 | Late: check-in after shift start + late grace. Late minutes are counted from shift start. |
| BR-2 | Early leave: check-out before shift end − early-leave grace. Early minutes = shift end − check-out. |
| BR-3 | Absent: no check-in by shift end on a working roster day without approved leave. |
| BR-4 | Missing check-out: a check-in with no check-out when the check-out window closes (shift end + check-out window, default 6 hours). |
| BR-5 | Overtime: time worked after shift end of at least the minimum overtime minutes (company setting, default 30), and any time worked on a rest day or public holiday. Arriving early is not overtime. |

### 4.2 Calculations

| ID | Rule |
| --- | --- |
| BR-6 | Daily rate = monthly base salary ÷ divisor (30, 26 or working days of the month; company setting). Hourly rate = daily rate ÷ (shift hours − unpaid break). |
| BR-7 | Lateness and early-leave deduction. Exact mode: minutes × hourly rate ÷ 60. Tiered mode: company bands, for example 16–60 min = ¼ day, 61–120 min = ½ day, over 120 min = 1 day. In both modes, the total lateness and early-leave deduction for one day never exceeds one daily rate (D-39). |
| BR-8 | Absence deduction suggestion = 1 daily rate per absent day. A multiplier above 1 counts as a penalty and raises a yellow finding for review. |
| BR-9 | Overtime amount = overtime hours × hourly rate × multiplier. With law mode on, multipliers come from Appendix A. |

Worked example: shift 11:00–19:00 (no break), base salary 9,000 EGP, divisor 30. Daily rate = 300 EGP; hourly rate = 37.50 EGP. The employee checks in at 11:00 and out at 14:00, so early leave = 5 h and the suggested deduction = 5 × 37.50 = 187.50 EGP.

### 4.3 Leave validation

| ID | Rule |
| --- | --- |
| BR-10 | Notice: leave start − request time ≥ minimum notice hours, unless the leave type is exempt from notice. |
| BR-11 | Balance: requested days ≤ available balance for paid types with an entitlement. Unpaid leave has no balance check but respects its maximum days. A leave that crosses 31 December uses each year's balance for the days in that year. |
| BR-12 | No overlap with another pending or approved leave of the same employee. |
| BR-13 | Eligibility: months of service ≥ the type's minimum; gender restriction; maximum times per employment. |
| BR-14 | Requested days ≤ the type's maximum consecutive days. |
| BR-15 | Day counting: working-day types skip rest days and public holidays; calendar-day types count every day. A required attachment must be present. |

### 4.4 Payroll

| ID | Rule |
| --- | --- |
| BR-16 | Only approved exceptions enter a run. If the Admin approves a run with pending exceptions, those carry forward to the next month. |
| BR-17 | An Approved or Paid run is locked. Later corrections for that month reach the next run as carried-forward lines, never by editing the locked run. The only exception is reopening an Approved run that is not yet Paid (FR-PR-6). |
| BR-18 | Net = pro-rated base + additions − deductions, rounded to 2 decimals. A negative net blocks approval until the Admin confirms it. |

### 4.5 Compliance

Release: MVP-2.

| ID | Rule |
| --- | --- |
| BR-19 | Red = an open finding that a rule is broken now. Yellow = an open finding that a rule is at risk soon (e.g. a contract ending within 30 days, weekly hours within 4 h of the maximum). The thresholds are written in the versioned rules given to the AI. |
| BR-20 | A finding stays open until a later run no longer reports it, or the Admin dismisses it with a reason. The same finding (employee + rule) is never duplicated between runs. |
| BR-21 | AI findings never change data or amounts. Any correction (e.g. adding leave days, paying an overtime difference) is made by the Admin in the relevant module. |

## 5. Data model

The MVP uses approximately 30 relational tables. Every company-owned table carries company\_id, and every server-side read and write is scoped to the authenticated user's company, so one company can never read another's data. law\_references is shared, versioned reference data.

### 5.1 Company, users and employees

| Table | Key fields |
| --- | --- |
| companies | name, logo, time\_zone, currency, law\_mode, company\_rules\_text |
| company\_settings\_versions | company\_id, effective\_from, daily-rate divisor, lateness policy, overtime multipliers, overtime minimum, contract expiring-soon days, check-in window, check-out window, IP allow-list, created\_by. Payroll and attendance use the version in force on each date (FR-CS-8, D-27). |
| users | company\_id, name, email (unique), phone (unique), password\_hash, role (admin, employee, interviewer), employee\_id, status (invited, active, deactivated), invite\_token, invite\_expires\_at, language |
| job\_titles | company\_id, name\_ar, name\_en |
| employees | code, name\_ar, name\_en, national\_id, birth\_date, gender, phone, email, address, emergency\_name, emergency\_phone, photo, job\_title\_id, employment\_type, hire\_date, probation\_end, training\_end, status, termination\_date, termination\_reason, has\_disability, candidate\_id |
| employee\_status\_history | employee\_id, from\_status, to\_status, effective\_date, reason, changed\_by |
| salary\_history | employee\_id, base\_salary, effective\_from |
| recurring\_pay\_items | employee\_id, kind (addition, deduction), label, amount, valid\_from, valid\_to |
| documents | employee\_id, doc\_type, file\_key, expiry\_date, uploaded\_by. Candidate documents (MVP-2) add candidate\_id, with exactly one owner per document (D-47) |
| contracts | employee\_id, type, start\_date, end\_date, agreed\_salary, file\_key, previous\_contract\_id, notes |

### 5.2 Recruitment

| Table | Key fields |
| --- | --- |
| candidates | name, phone, email, position\_applied, source, cv\_file\_key, expected\_salary, status, on\_hold\_until, rejection\_reason, employee\_id |
| candidate\_status\_log | candidate\_id, from\_status, to\_status, changed\_by, changed\_at, comment |
| candidate\_notes | candidate\_id, author\_id, body, created\_at |
| interviews | candidate\_id, scheduled\_at, type, place\_or\_link, result, score, notes |
| interview\_interviewers | interview\_id, user\_id |

When a hired candidate is converted, candidates.employee\_id and employees.candidate\_id point to each other, so both histories stay linked.

### 5.3 Shifts, attendance and leave

| Table | Key fields |
| --- | --- |
| shift\_templates | name, start\_time, end\_time, crosses\_midnight, break\_min, late\_grace\_min, early\_grace\_min, working\_days |
| shift\_assignments | employee\_id, kind (fixed; rotation from v1.1), template\_ids (ordered), cycle\_weeks (v1.1), start\_date, end\_date |
| roster\_entries | employee\_id, shift\_date, template\_id, expected\_start, expected\_end, break\_min, late\_grace\_min, early\_grace\_min (copied from the template), day\_type (work, rest, holiday, leave, half\_leave, suspended), override\_reason |
| attendance\_records | employee\_id, roster\_entry\_id, shift\_date, check\_in\_at, check\_out\_at, check\_in\_ip, check\_out\_ip, labels, late\_min, early\_min, overtime\_min, source (self, admin) |
| attendance\_exceptions | attendance\_record\_id, employee\_id, type, minutes, days, suggested\_amount, final\_amount, policy\_snapshot, employee\_reason, attachment\_key, status, decided\_by, decided\_at, note, leave\_request\_id, payroll\_run\_id |
| leave\_types | name\_ar, name\_en, paid, entitlement\_days, count\_mode, min\_notice\_hours, notice\_exempt, max\_consecutive, eligible\_after\_months, attachment\_required, gender, max\_times, carry\_over\_max, statutory |
| leave\_balances | employee\_id, leave\_type\_id, year, opening, granted, used, carried\_over |
| leave\_requests | employee\_id, leave\_type\_id, start\_date, end\_date, duration\_type (full, first\_half, second\_half), days, reason, attachment\_key, status, decided\_by, decided\_at, note |
| public\_holidays | name, start\_date, end\_date, paid, confirmed |

### 5.4 Payroll

| Table | Key fields |
| --- | --- |
| payroll\_runs | month, status (draft, approved, paid), approved\_by, approved\_at, paid\_at |
| payroll\_items | run\_id, employee\_id, base\_prorated, total\_additions, total\_deductions, net |
| payroll\_lines | payroll\_item\_id, kind (addition, deduction), category, label, amount, source\_type (exception, recurring, manual, leave, carry-forward), source\_id |

### 5.5 Compliance, AI and system

| Table | Key fields |
| --- | --- |
| law\_references | code (e.g. EG-LABOR), version, effective\_from, text (the rule list given to the AI); shared by all companies |
| compliance\_runs | run\_type (nightly, manual, policy), model, started\_at, finished\_at, tokens\_in, tokens\_out, status |
| compliance\_findings | run\_id, employee\_id, rule\_ref, severity, message, suggestion, evidence, state, first\_seen, resolved\_at, dismissed\_reason |
| ai\_usage | usage\_date, calls, tokens\_in, tokens\_out |
| notifications | user\_id, type, payload, read\_at |
| audit\_log | company\_id, user\_id (empty for a scheduled job), entity\_type, entity\_id, action, before, after, reason, created\_at. Append-only: the database refuses UPDATE and DELETE (NFR-8, D-58 to D-60) |

## 6. Non-functional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-1 | Tenant isolation | Every read and write is scoped to the user's company on the server. Automated tests prove one company cannot reach another's records or files. |
| NFR-2 | Security | Passwords hashed with bcrypt or Argon2; HTTPS only; sessions expire after 12 hours of inactivity. There is no limit on failed login attempts (D-46). |
| NFR-3 | Privacy | National ID, salary and documents are visible only to Admins and the employee concerned. The disability field is visible only to Admins. Files are served through short-lived signed links. Personal data is handled in line with Egypt's Personal Data Protection Law No. 151 of 2020. |
| NFR-4 | Performance | Pages load in under 2 seconds for a company of up to 50 employees; a payroll run for 50 employees completes in under 10 seconds under normal MVP conditions. |
| NFR-5 | Reliability | Daily database backups kept for 30 days. Nightly jobs (roster, attendance labels, compliance) are safe to re-run without creating duplicates. |
| NFR-6 | Localisation | Full Arabic (right-to-left) and English interfaces; dates, numbers and EGP amounts formatted per language. |
| NFR-7 | Usability | Works on phone screens from 360 px wide; check-in takes no more than 2 taps after login. |
| NFR-8 | Auditability | Every change listed in FR-DB-4 is written to an immutable audit log that users cannot edit or delete. |
| NFR-9 | AI cost control | AI calls per company per day are capped, and checks run once a night in batches with a small model. If OpenAI is unavailable, the last results stay on screen with their date and every other module keeps working. Applies from MVP-2. |
| NFR-10 | Maintainability | The law reference given to the AI is stored as versioned data, so a legal change is a data update, not a code release. |

## 7. Out of scope and roadmap

### 7.1 Not in the MVP

- Departments, sections, reporting lines and org chart
- Job postings and online application forms
- Fingerprint or barcode device integration
- Native mobile app, GPS or QR check-in
- Social insurance and income tax calculation
- Multiple salary structures
- Accounting integration, journal entries and cost centres
- Analytics reports and payroll distribution by department
- Email and WhatsApp notifications (except invites and password reset)
- Multi-level approvals
- Weekly rotation shifts and the AI "Ask" chat (moved to v1.1)

### 7.2 Roadmap

Four releases follow the MVP, moving from quick wins (v1.1, 2–3 weeks after the MVP) to new markets and paid tiers (v4).

**MVP (free)**: this document, delivered as the MVP and MVP-2 (see 1.6).

**v1.1 Quick wins**: 2–3 weeks after the MVP

- Weekly rotation shifts (FR-SH-3, moved from the MVP)
- AI "Ask" chat assistant (FR-AI-10, moved from the MVP)
- Excel import of fingerprint logs
- Bulk employee import from Excel
- Email notifications

**v2 Operations**: mobile and payroll depth

- Android app: GPS and QR check-in
- Kiosk check-in tablet
- Social insurance and income tax
- Loans and salary advances
- Departments and org chart
- Multi-level approvals
- Shift swap requests
- WhatsApp notifications

**v3 Intelligence**: AI and integrations

- Analytics dashboard
- AI contract reader
- AI CV screening
- Performance reviews
- Accounting integration
- Cost centres
- Multiple salary structures
- Public careers page

**v4 Expansion**: new markets, paid tiers

- Saudi, UAE and Jordan law packs
- End-of-service workflow
- Paid plans
- E-signature for contracts
- Training management

Each release builds on the MVP's data model; the law reference design lets v4 add new countries as data, not code.

## Appendix A. Egyptian Labor Law reference for the AI (EG-LABOR v1)

The AI compliance check is given the rules below as its law reference, built from Labor Law No. 14 of 2025, in force since 1 September 2025. The values come from a published summary and are reference data only. Confirm each against the official text and the executive regulations with a labor lawyer before launch.

| Code | Rule | Value | How the system uses it | Severity |
| --- | --- | --- | --- | --- |
| EG-01 | Daily hours | Max 8 hours, excluding breaks | Shift template or roster day longer than 8 working hours | Red |
| EG-02 | Weekly hours | Max 48 hours | Scheduled week over 48 h; within 4 h of the limit | Red / Yellow |
| EG-03 | Rest breaks | At least 1 hour a day; no more than 5 continuous working hours | Shift over 5 h with a break under 60 min | Red |
| EG-04 | Weekly rest | At least 24 consecutive hours, fully paid | Roster with no rest day in 7 days | Red |
| EG-05 | Annual leave | 15 days in year 1 (after 6 months); 21 days from year 2; 30 days after 10 years of service or age 50; 45 days for employees with disabilities | Granted balance below the entitlement for the employee's service and age | Red |
| EG-06 | Casual leave | 6 days a year, max 2 consecutive | Pre-created leave type; company setting below this | Red |
| EG-07 | Sick leave | 3 months at 100%, 6 months at 85%, 3 months at 75%; certified; paid through social insurance | Pre-created leave type; information for the assistant | — |
| EG-08 | Maternity leave | 4 months paid, no minimum service, up to 3 times | Pre-created leave type; a refused or shortened request | Red |
| EG-09 | After childbirth | No overtime during pregnancy or for 6 months after birth; 1 hour less a day from the 6th month of pregnancy | Overtime approved within 6 months after a maternity leave | Red |
| EG-10 | Paternity leave | 1 paid day on the day of birth, up to 3 times | Pre-created leave type | — |
| EG-11 | Nursing breaks | 2 breaks of 30+ minutes a day for 2 years after childbirth | Information for the assistant | — |
| EG-12 | Hajj leave | 1 month, full pay, once, after 5 years of continuous service | Pre-created leave type | — |
| EG-13 | Overtime pay | Day +35%; night +70%; weekly rest day double pay plus a compensatory rest day; public holiday: day's wage plus double pay, or a compensatory day off | Default multipliers 1.35, 1.70, 2.00; an approved overtime amount below the multiplier | Red |
| EG-14 | Probation | Max 3 months, once with the same employer | Probation end more than 3 months after hire date | Red |
| EG-15 | Notice period | 3 months for indefinite contracts | Information for the assistant (end-of-service is v4) | — |
| EG-16 | Public holidays | 13 official paid days a year; Islamic dates follow moon sighting | Preloads the public holidays calendar | — |

Two checks are system rules, not law: an Active employee with an expired contract is red, and a contract ending within 30 days is yellow.

Open items:

- EG-05: the 45-day entitlement uses the optional disability field on the employee, shown only when law mode is on (D-04).
- EG-13: confirm how the public holiday rate is applied (total 2× or 3× the hourly wage) and which hours count as night work. Working assumptions until confirmed: A-03 and A-04.
- EG-09: the MVP does not store pregnancy dates, so only the post-birth overtime rule is checked.

Sources: ZenHR, Egypt Labor Law at a Glance (EG-01 to EG-16) · Clyde & Co, New Labour Law issued in Egypt (EG-09).

## Appendix B. Developer implementation baseline

This section translates the SRS into implementation constraints. It does not add product scope. The stack follows decision D-01 (Oct 1, 2026). Implementation choices such as the ORM and the job library are recorded in `decisions.md` (D-21 to D-36).

| Area | Baseline |
| --- | --- |
| Backend | NestJS (TypeScript) |
| Frontend | Next.js (TypeScript, App Router) + Tailwind CSS |
| Database | PostgreSQL |
| Background jobs | Redis-backed job queue with scheduled, retryable jobs (BullMQ, D-23) |
| File storage | S3-compatible object storage; the database stores file metadata/keys |
| AI | OpenAI API behind a dedicated compliance service with structured output validation and rate/cost limits |
| Multi-tenancy | company\_id on every company-owned table; server-side tenant scoping is mandatory |

Implementation rules:

- Core business calculations must be deterministic backend/domain logic; AI is advisory and read-only.
- Use effective-dated settings and salary history so approved payroll is reproducible.
- All scheduled jobs must be idempotent and safe to rerun.
- Testing must include tenant isolation, permissions, payroll calculations, attendance edge cases, leave validation and locked payroll behaviour.
- Build Arabic/English and RTL into the frontend foundation rather than adding localisation after all screens are finished.
