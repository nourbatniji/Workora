# MDARJ HR & Payroll System

A multi-company web system for HR and monthly payroll, sized for companies with up to 50 employees. It covers the employee cycle from candidate to payslip: company setup, employees and contracts, shifts and roster, attendance and exceptions, leave and public holidays, payroll, and an AI compliance assistant (Egyptian Labor Law or each company's own rules).

The interface is bilingual (Arabic right-to-left and English) and works on desktop and phone browsers.

## Status

Requirements are signed off. Development starts with the project skeleton (Jira SCRUM-20, FND-01).

| Release | Target date | Contents |
| --- | --- | --- |
| MVP | Nov 10, 2026 | Everything in the SRS not marked MVP-2 or v1.1 |
| MVP-2 | Nov 16, 2026 | Recruitment, AI compliance, expired-contract findings |
| Pilot | December 2026 | One full month with a pilot company |
| v1.1 | 2–3 weeks after the MVP | Weekly rotation shifts, AI "Ask" chat |

## Requirements

All product and technical decisions live in [`requirements/`](requirements/):

| File | What it holds |
| --- | --- |
| [`srs.md`](requirements/srs.md) | What the system must do: functional requirements (FR-…), business rules (BR-…), non-functional requirements (NFR-…). Current version: v1.2. |
| [`decisions.md`](requirements/decisions.md) | Why and how: every decision that shapes the build (D-01 …), with its status. |
| [`assumptions.md`](requirements/assumptions.md) | Points not yet confirmed (A-01 …) and what changes if they are wrong. |
| [`development-plan.md`](requirements/development-plan.md) | Architecture, modules, scheduled jobs and test plan. The dates in Jira replace its sprint calendar. |

Order of change: decision first (`decisions.md`), then the SRS, then Jira, then code.

## Tech stack

| Layer | Choice |
| --- | --- |
| Backend | NestJS (TypeScript) |
| Frontend | Next.js (TypeScript, App Router), Tailwind CSS, next-intl |
| Database | PostgreSQL with Prisma |
| Background jobs | BullMQ on Redis |
| File storage | S3-compatible storage (MinIO locally) |
| AI | OpenAI API, structured JSON output |
| Local services | Docker Compose: PostgreSQL, Redis, MinIO, Mailpit |

Details and reasons: [`decisions.md`](requirements/decisions.md) D-01 and D-21 to D-36.

## Repository layout

```
HR/
├── requirements/      SRS, decisions, assumptions, development plan
├── apps/
│   ├── api/           NestJS backend
│   └── web/           Next.js frontend
└── packages/
    └── shared/        types, enums and validation used by both apps
```

`apps/` and `packages/` are created by FND-01.

## Getting started

Setup steps are added here as part of FND-01 (project skeleton) and FND-02 (database).

Prerequisites:

- Node.js 20 or newer
- pnpm (enabled with `corepack enable`)
- Docker Desktop

## Working conventions

- Work is tracked in Jira, project "HR-System" (issue keys SCRUM-…). Each issue title starts with its plan ID, for example `FND-01`.
- One branch per Jira task, for example `feat/scrum-20-project-skeleton`. Never commit straight to `main`.
- Commit and pull request titles use `type(scope): description`, for example `feat(auth): log in with email or phone`.
- Put the Jira key and the SRS requirement ID in the commit or pull request, for example `SCRUM-31, FR-UA-3`.
- A task is done when it meets the definition of done in [`development-plan.md`](requirements/development-plan.md) section 6: Arabic and English, 360 px phones, server-side permission and company checks, audit log where needed, tests passing.
