# MDARJ HR & Payroll System

A multi-company web system for HR and monthly payroll, sized for companies with up to 50 employees. It covers the employee cycle from candidate to payslip: company setup, employees and contracts, shifts and roster, attendance and exceptions, leave and public holidays, payroll, and an AI compliance assistant (Egyptian Labor Law or each company's own rules).

The interface is bilingual (Arabic right-to-left and English) and works on desktop and phone browsers.

## Status

Requirements are signed off. Done: project skeleton (SCRUM-20, FND-01) and database (SCRUM-21, FND-02). In progress: company data isolation (SCRUM-22, FND-03).

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
| [`srs.md`](requirements/srs.md) | What the system must do: functional requirements (FR-…), business rules (BR-…), non-functional requirements (NFR-…). Current version: v1.4. |
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

`packages/shared` is added when the first shared code is needed.

## Getting started

### Prerequisites

- Node.js 22 (check with `node -v`)
- pnpm, turned on once with `corepack enable`
- Docker Desktop (needed from FND-02, the database)

### First-time setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up        # start PostgreSQL in Docker
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

### Other commands

| Command | What it does |
| --- | --- |
| `pnpm db:up` | Starts PostgreSQL in Docker |
| `pnpm db:migrate` | Applies new migrations to the local database |
| `pnpm db:generate` | Rebuilds the Prisma client after a schema change (Prisma 7 no longer does this inside `db:migrate`) |
| `pnpm db:seed` | Adds the demo company and its Admin |
| `pnpm test` | Runs the backend unit tests (no database needed) |
| `pnpm test:e2e` | Runs the backend tests that use the database (start it first with `pnpm db:up`) |
| `pnpm lint` | Checks both apps for code mistakes |
| `pnpm format` | Formats all code with Prettier |
| `pnpm format:check` | Only reports formatting problems |

### Settings (environment variables)

| App | File | Variable | Default | Meaning |
| --- | --- | --- | --- | --- |
| api | `apps/api/.env` | `PORT` | `4000` | Port the backend listens on |
| api | `apps/api/.env` | `DATABASE_URL` | `postgresql://mdarj:mdarj@localhost:5432/mdarj?schema=public` | PostgreSQL connection |
| api | `apps/api/.env` | `SEED_ADMIN_EMAIL` | `admin@demo.mdarj.test` | Email of the demo Admin |
| api | `apps/api/.env` | `SEED_ADMIN_PASSWORD` | `ChangeMe123!` | Password of the demo Admin |

Restart the backend after changing `.env`.

## Working conventions

- Work is tracked in Jira, project "HR-System" (issue keys SCRUM-…). Each issue title starts with its plan ID, for example `FND-01`.
- One branch per Jira task, for example `feat/scrum-20-project-skeleton`. Never commit straight to `main`.
- Commit and pull request titles use `type(scope): description`, for example `feat(auth): log in with email or phone`.
- Put the Jira key and the SRS requirement ID in the commit or pull request, for example `SCRUM-31, FR-UA-3`.
- Company data (D-25): modules read and write through `TenantPrismaService` (`this.tenantPrisma.db`). Its guard adds the logged-in user's company to every query and blocks queries with no company. New rows carry `companyId: requireCompanyId()`. Code that uses company data runs inside `runInCompany(companyId, async () => ...)`. The plain `PrismaService` is only for system work: sign-up, login lookup, seed and scheduled jobs.
- A new table with `company_id` must be added to `COMPANY_TABLES` in `apps/api/src/common/tenancy/tenancy.extension.ts`. A unit test fails until it is.
- A task is done when it meets the definition of done in [`development-plan.md`](requirements/development-plan.md) section 6: Arabic and English, 360 px phones, server-side permission and company checks, audit log where needed, tests passing.
