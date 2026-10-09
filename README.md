# MDARJ HR & Payroll System

A multi-company web system for HR and monthly payroll, sized for companies with up to 50 employees. It covers the employee cycle from candidate to payslip: company setup, employees and contracts, shifts and roster, attendance and exceptions, leave and public holidays, payroll, and an AI compliance assistant (Egyptian Labor Law or each company's own rules).

The interface is bilingual (Arabic right-to-left and English) and works on desktop and phone browsers.

## Status

Requirements are signed off. The foundation is verified (SCRUM-176, see [`requirements/foundation-check.md`](requirements/foundation-check.md)): project skeleton, database, company data isolation (direct and linked rows), Arabic/English shell and phone layout, company sign-up, login with sessions, role permissions on every API route, the web app behind login, the audit log, API conventions and CI on every pull request. The dashboard and exceptions inbox are UI prototypes with sample data. Next: email, invites and company settings (Sprint 2).

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
| [`srs.md`](requirements/srs.md) | What the system must do: functional requirements (FR-…), business rules (BR-…), non-functional requirements (NFR-…). Current version: v1.6. |
| [`decisions.md`](requirements/decisions.md) | Why and how: every decision that shapes the build (D-01 …), with its status. |
| [`assumptions.md`](requirements/assumptions.md) | Points not yet confirmed (A-01 …) and what changes if they are wrong. |
| [`development-plan.md`](requirements/development-plan.md) | Architecture, modules, scheduled jobs and test plan. The dates in Jira replace its sprint calendar. |
| [`workflow.md`](requirements/workflow.md) | How we build: the 15-stage lifecycle and where we are, the vertical feature slice, how Jira is organised, and the build order. |

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

`packages/shared` is added when the first shared code is needed.

## Getting started

### Prerequisites

- Node.js 22, the exact version in `.nvmrc` (check with `node -v`)
- pnpm, turned on once with `corepack enable`
- Docker Desktop (needed from FND-02, the database)

### First-time setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up        # start PostgreSQL and Mailpit in Docker
pnpm db:migrate   # create the tables
pnpm db:generate  # build the Prisma client
pnpm db:seed      # add the demo company and its Admin
```

The seed creates "MDARJ Demo Company" with one Admin. Log in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `apps/api/.env`. Running the seed again is safe: it never creates duplicates and resets the Admin's password to the value in `.env`.

### Run the apps

| Command | What it starts | Address |
| --- | --- | --- |
| `pnpm dev:api` | NestJS backend | http://localhost:4000 |
| `pnpm dev:web` | Next.js frontend | http://localhost:3000 |
| `pnpm db:up` | Mailpit, the fake inbox: every email the API sends lands here, never with real people | http://localhost:8025 |

### Other commands

| Command | What it does |
| --- | --- |
| `pnpm build:shared` | Builds `packages/shared` (validation rules and types used by both apps). `pnpm dev:api` runs it first; run it yourself after changing shared code while `pnpm dev:web` is running |
| `pnpm db:up` | Starts PostgreSQL and Mailpit (the fake inbox) in Docker |
| `pnpm db:migrate` | Applies new migrations to the local database |
| `pnpm db:generate` | Rebuilds the Prisma client after a schema change (Prisma 7 no longer does this inside `db:migrate`) |
| `pnpm db:seed` | Adds the demo company and its Admin |
| `pnpm test` | Runs the backend unit tests (no database needed) |
| `pnpm test:e2e` | Runs the backend tests that use the database and Mailpit (start them first with `pnpm db:up`) |
| `pnpm lint` | Checks both apps for code mistakes |
| `pnpm typecheck` | Builds `packages/shared`, then checks the types of shared, api and web without building them |
| `pnpm check:raw-sql` | Fails if `apps/api/src` uses raw SQL outside `src/prisma/` (api-conventions.md §8) |
| `pnpm format` | Formats all code with Prettier |
| `pnpm format:check` | Only reports formatting problems |

### Settings (environment variables)

| App | File | Variable | Default | Meaning |
| --- | --- | --- | --- | --- |
| api | `apps/api/.env` | `PORT` | `4000` | Port the backend listens on |
| api | `apps/api/.env` | `DATABASE_URL` | `postgresql://mdarj:mdarj@localhost:5432/mdarj?schema=public` | PostgreSQL connection |
| api | `apps/api/.env` | `SEED_ADMIN_EMAIL` | `admin@demo.mdarj.test` | Email of the demo Admin |
| api | `apps/api/.env` | `SEED_ADMIN_PASSWORD` | `ChangeMe123!` | Password of the demo Admin |
| api | `apps/api/.env` | `SMTP_HOST`, `SMTP_PORT` | `localhost`, `1025` | The mail server: Mailpit locally, the email provider in production |
| api | `apps/api/.env` | `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | `false`, empty, empty | Only for a real provider |
| api | `apps/api/.env` | `MAIL_FROM` | `MDARJ <no-reply@mdarj.local>` | The sender shown in the email |
| api | `apps/api/.env` | `MAILPIT_URL` | `http://localhost:8025` | Used by the email tests to read the fake inbox |
| web | `apps/web/.env.local` | `API_URL` | `http://localhost:4000` | Where the web app forwards `/api/*` requests |

Restart the backend after changing `.env`.

## Working conventions

- Work is tracked in Jira, project "HR-System" (issue keys SCRUM-…). Each issue title starts with its plan ID, for example `FND-01`.
- One branch per Jira task, for example `feat/scrum-20-project-skeleton`. Never commit straight to `main`.
- Commit and pull request titles use `type(scope): description`, for example `feat(auth): log in with email or phone`.
- Put the Jira key and the SRS requirement ID in the commit or pull request, for example `SCRUM-31, FR-UA-3`.
- Company data (D-25): modules read and write through `TenantPrismaService` (`this.tenantPrisma.db`). Its guard adds the logged-in user's company to every query and blocks queries with no company. New rows carry `companyId: requireCompanyId()`. Code that uses company data runs inside `runInCompany(companyId, async () => ...)`. The plain `PrismaService` is only for system work: sign-up, login lookup, seed and scheduled jobs.
- A new table with `company_id` must be added to `COMPANY_TABLES` in `apps/api/src/common/tenancy/tenancy.extension.ts`. A unit test fails until it is.
- Every pull request and every merge into `main` runs CI (`.github/workflows/ci.yml`, SCRUM-168): Prisma schema check, format, lint, typecheck, raw-SQL check, all migrations on an empty database, unit and e2e tests, and both builds. Merge only when it is green. When a step is red, open it in the pull request's Checks tab, run the same `pnpm` command on your Mac, fix it and push again.
- A task is done when it meets the definition of done in [`development-plan.md`](requirements/development-plan.md) section 6: Arabic and English, 360 px phones, server-side permission and company checks, audit log where needed, tests passing.
