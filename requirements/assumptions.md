# MDARJ HR & Payroll — Assumptions

MVP · Oct 1, 2026 · @trendow

Development starts on the assumptions below. Each one is either **To confirm** (needs an answer from the product owner, a lawyer or the client before the module that depends on it is finished) or **Working** (the build goes ahead on it; change it here if it is wrong). When an assumption is settled, move it to `decisions.md` and mark it **Closed** here.

## 1. Legal and compliance

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-01 | The legal values in Appendix A (EG-01 to EG-16) are correct for Labor Law No. 14 of 2025 and its executive regulations. They are seeded as `law_references` EG-LABOR v1 and verified by a labor lawyer before production launch. | FR-LV-2, FR-AI-3, BR-9 | Data update to a new law reference version (no release) | To confirm |
| A-02 | Until D-04 is decided, no disability field is stored. The annual leave check (EG-05) applies 15, 21 and 30 days only; the 45-day entitlement is not checked. | EG-05, FR-AI-2 | Add one employee field and one fact to the fact sheet | Closed (D-04, Oct 3, 2026) |
| A-03 | Public holiday overtime uses the Appendix A default multiplier 2.00, editable in payroll settings. Whether the law means 2× or 3× the hourly wage in total is still open. | EG-13, FR-PH-4, BR-9 | Change the default multiplier and the law reference | To confirm |
| A-04 | The night work definition is open. The night overtime multiplier (1.70) is a payroll setting, but overtime is classed as day overtime until the night window is confirmed. | EG-13, BR-5, BR-9 | Add a night window setting and split overtime minutes by window | To confirm |
| A-05 | Pregnancy dates are not stored, so only the post-birth overtime rule of EG-09 is checked (overtime within 6 months after a maternity leave). | EG-09 | Add pregnancy dates (sensitive data, needs a privacy review) | Working |
| A-06 | Sending pseudonymised fact sheets (employee codes, no names or salaries) to the OpenAI API is acceptable under Personal Data Protection Law No. 151 of 2020. | FR-AI-11, NFR-3 | Add consent text or a data-processing agreement; possibly a company opt-out | To confirm |
| A-07 | Contract "expiring soon" uses 30 days by default and is a company setting. | FR-CT-2, BR-19 | None (setting) | Working |

## 2. Tenancy, users and access

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-08 | A user belongs to exactly one company. An email address or phone number can be used by only one user in the whole system (D-26). | FR-UA-3, NFR-1 | Add a company picker at login | Closed (SRS v1.3) |
| A-09 | Phone numbers are stored in international format (+20…). Users can type the local format and it is normalised. | FR-UA-3 | Normalisation rule only | Working |
| A-10 | An Admin who is also on the payroll has both an `admin` user role and a linked employee record, and sees the employee self-service pages too. | 2.2, FR-UA-7 | Separate admin and employee accounts | Working |
| A-11 | An interviewer may be an existing employee or an outside person with an interviewer-only login. | 2.2, FR-RC-6 | Restrict interviewers to employees | Working |
| A-12 | Transactional email (invites, password reset) is sent through a free-tier email provider, which counts as part of "basic hosting". | FR-UA-2, FR-UA-4, 2.4 | Invites go by copied link only | To confirm |
| A-13 | The lock after 5 failed logins counts consecutive failures for that user account; a successful login resets the count. | NFR-2, FR-UA-8 | Counter logic only | Dropped: no lockout (D-46) |

## 3. Employees, recruitment and contracts

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-14 | Employee codes are sequential per company (EMP-0001, EMP-0002 …) and never reused. | FR-EM-1 | Code format setting | Working |
| A-15 | The 50-employee limit counts Active and Suspended employees. Terminated employees and candidates do not count. Creating employee 51 shows a clear message. | 2.4, D-05 | Change the count rule | To confirm |
| A-16 | A contract's agreed salary is informational. Payroll uses `salary_history` only; the Admin updates salary history separately. | FR-CT-1, FR-EM-4 | Create a salary history row when a contract is saved | Closed (SRS v1.3) |

## 4. Shifts, attendance and leave

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-17 | Every working employee has one fixed shift assignment (D-02). An employee with no assignment has no roster, so no attendance is expected and no exceptions are created. | FR-SH-2, FR-SH-4 | Add a default company shift | Working |
| A-18 | Attendance labelling runs every 15 minutes and labels each shift whose check-out window (shift end + check-out window, default 6 hours) has closed. It is not a once-a-night job. | FR-AT-4, BR-4 | Job schedule only | Working |
| A-19 | One check-in and one check-out per shift date. A second check-in after check-out is refused. | FR-AT-1, FR-AT-3 | Support multiple punch pairs per day | Closed (SRS v1.3) |
| A-20 | The employee's 3-day window to add a reason to an exception counts calendar days from its creation time. | FR-EX-3 | Count working days | Working |
| A-21 | A half-day leave counts as 0.5 day against the balance. | FR-LV-5 | Count half days in hours | Closed (SRS v1.3) |
| A-22 | The leave year is the calendar year. Entitlements are granted on 1 January or on the eligibility date, and carry-over is applied on 1 January. | FR-LV-4 | Add a configurable leave-year start | Working |
| A-23 | Converting an exception to leave (FR-EX-4) takes the exception's minutes as a fraction of a day (minutes ÷ shift working minutes), rounded up to 0.5 day. | FR-EX-4 | Change the conversion rule | To confirm |

## 5. Payroll

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-24 | A payroll month is the calendar month in the company time zone. | FR-PR-1 | Add a configurable cut-off day | Working |
| A-25 | With the "working days of the month" divisor, working days are the days of the company work week in that month. Paid public holidays count as working days for this divisor. | BR-6, FR-CS-5 | Exclude public holidays from the divisor | To confirm |
| A-26 | The hourly rate uses the employee's assigned shift hours minus unpaid break. If the employee has no shift, 8 hours is used. | BR-6 | Change the fallback | To confirm |
| A-27 | Pro-rating for joiners and leavers counts calendar days employed in the month × daily rate, using the same divisor as the company setting. | FR-PR-2 | Count working days employed | To confirm |
| A-28 | Unpaid leave deduction = unpaid leave days × daily rate. | FR-PR-3 | Change the formula | Working |
| A-29 | Each payroll line is rounded half-up to 2 decimals and net is the sum of rounded lines. | BR-18, D-28 | Round only the net | Working |
| A-30 | A Suspended employee stays in the run and is paid the full base for the suspended days. If the suspension is unpaid, the Admin adds a manual deduction line. | FR-PR-1, FR-EM-7 | Deduct suspended days automatically | To confirm |
| A-31 | Payslips are generated in the language of the user viewing or downloading them. | FR-PR-7, NFR-6 | Use a company default language | Working |

## 6. AI and limits

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-32 | Default caps: "Run check now" 3 times per company per day; 200 AI calls per company per day. Both are system settings. | FR-AI-7, FR-AI-12, NFR-9 | Change the settings | To confirm |
| A-33 | The nightly compliance check runs after the attendance and roster jobs, at 02:00 company time. | FR-AI-4 | Schedule only | Working |
| A-34 | The policy check (FR-AI-6) runs on save but never blocks the save; warnings are shown after saving. | FR-AI-6 | Block saving on a red warning | To confirm |

## 7. Delivery

| ID | Assumption | Depends on it | If wrong | Status |
| --- | --- | --- | --- | --- |
| A-35 | The development plan estimates assume one full-stack developer working full time in 2-week sprints. | development-plan.md | Re-estimate | Working |
| A-36 | Hosting provider and region are not chosen yet and do not block development (local Docker Compose, D-36). They must be chosen before user acceptance testing. | NFR-4, NFR-5, A-06 | — | To confirm |
