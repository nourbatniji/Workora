// Employees (SRS 3.3). EM-01 (SCRUM-48): the Admin creates an employee; the system gives the code.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_EMPLOYEE_STATUSES,
  EMPLOYEE_LIMIT,
  employeeCode,
  type CreateEmployeeInput,
  type EmployeeAccessInput,
  type EmployeeProfile,
  type UpdateEmployeeInput,
  type EmployeeListPage,
  type EmployeeSort,
  type ExportEmployeesQuery,
  type ListEmployeesQuery,
} from '@mdarj/shared';
import type { AuthContext } from '../../auth/auth-context.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { requireCompanyId } from '../../common/tenancy/tenant-context.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { employeesWorkbook } from './employees-export.js';

/** "2026-11-01" ↔ the Date Prisma uses for a DATE column (midnight UTC, D-29) */
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const toDay = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;
const optionalDate = (day: string | undefined) =>
  day === undefined ? undefined : toDate(day);

/** What the API shows of an employee. No disability field here: EM-02 adds it, Admin only (D-04) */
const PUBLIC_EMPLOYEE = {
  id: true,
  code: true,
  nameAr: true,
  nameEn: true,
  nationalId: true,
  birthDate: true,
  gender: true,
  phone: true,
  email: true,
  address: true,
  emergencyName: true,
  emergencyPhone: true,
  jobTitle: { select: { id: true, nameAr: true, nameEn: true } },
  employmentType: true,
  hireDate: true,
  probationEnd: true,
  trainingEnd: true,
  status: true,
  createdAt: true,
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = Prisma.EmployeeGetPayload<{
  select: typeof PUBLIC_EMPLOYEE;
}>;

/** Dates as days ("2026-10-12"), like every DATE in the API (D-29) */
function toApi(row: EmployeeRow) {
  return {
    ...row,
    birthDate: toDay(row.birthDate),
    hireDate: toDay(row.hireDate),
    probationEnd: toDay(row.probationEnd),
    trainingEnd: toDay(row.trainingEnd),
    createdAt: row.createdAt.toISOString(),
  };
}

/** One employee's full record, for the profile page (Admin view: includes the disability field) */
const PROFILE = {
  ...PUBLIC_EMPLOYEE,
  terminationDate: true,
  hasDisability: true,
  user: { select: { id: true, status: true } },
} satisfies Prisma.EmployeeSelect;

/** The personal and job fields EM-02 and EM-03 may change; dates are DATE columns */
const EDITABLE_FIELDS = [
  'nameAr',
  'nameEn',
  'nationalId',
  'birthDate',
  'gender',
  'phone',
  'email',
  'address',
  'emergencyName',
  'emergencyPhone',
  'hasDisability',
  'jobTitleId',
  'employmentType',
  'hireDate',
  'probationEnd',
  'trainingEnd',
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What one row of the list shows */
const LIST_ROW = {
  id: true,
  code: true,
  nameAr: true,
  nameEn: true,
  jobTitle: { select: { id: true, nameAr: true, nameEn: true } },
  employmentType: true,
  status: true,
  hireDate: true,
  phone: true,
  email: true,
  user: { select: { id: true, status: true } },
} satisfies Prisma.EmployeeSelect;

/** sort=-hireDate → hire date newest first; the code breaks ties, so pages never shuffle */
function orderBy(
  sort: EmployeeSort,
): Prisma.EmployeeOrderByWithRelationInput[] {
  const dir: Prisma.SortOrder = sort.startsWith('-') ? 'desc' : 'asc';
  switch (sort.replace(/^-/, '')) {
    case 'nameEn':
      return [{ nameEn: dir }, { code: 'asc' }];
    case 'nameAr':
      return [{ nameAr: dir }, { code: 'asc' }];
    case 'hireDate':
      return [{ hireDate: dir }, { code: 'asc' }];
    default:
      return [{ code: dir }];
  }
}

/** The list's filters as a Prisma where; no status filter = Active and Suspended */
function whereFor(
  query: Pick<
    ListEmployeesQuery,
    'q' | 'status' | 'employmentType' | 'jobTitleId'
  >,
): Prisma.EmployeeWhereInput {
  return {
    status: { in: query.status ?? DEFAULT_EMPLOYEE_STATUSES },
    ...(query.employmentType && {
      employmentType: { in: query.employmentType },
    }),
    ...(query.jobTitleId && { jobTitleId: query.jobTitleId }),
    ...(query.q && search(query.q)),
  };
}

type ListRow = Prisma.EmployeeGetPayload<{ select: typeof LIST_ROW }>;

const toListItem = ({ user, ...row }: ListRow) => ({
  ...row,
  hireDate: toDay(row.hireDate)!,
  login: user,
});

/** Safety net for the export: far above what one company can hold in the MVP */
const EXPORT_LIMIT = 5_000;

/**
 * Free-text search (FR-EM-9): name in either language, code, phone or national ID.
 * A phone is stored as +201012345678, so "0101 234" is also tried without spaces and leading 0.
 */
function search(q: string): Prisma.EmployeeWhereInput {
  const or: Prisma.EmployeeWhereInput[] = [
    { nameAr: { contains: q, mode: 'insensitive' } },
    { nameEn: { contains: q, mode: 'insensitive' } },
    { code: { contains: q, mode: 'insensitive' } },
  ];
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3) {
    or.push({ phone: { contains: digits.replace(/^0/, '') } });
    or.push({ nationalId: { contains: digits } });
  }
  return { OR: or };
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  /**
   * GET /employees/:key — by id or by code (the page's address is /employees/EMP-0001).
   * Another company's employee is not found at all (tenancy).
   */
  async profile(key: string): Promise<EmployeeProfile> {
    const db = this.tenantPrisma.db;
    const [row, company] = await Promise.all([
      db.employee.findFirst({
        where: UUID.test(key) ? { id: key } : { code: key.toUpperCase() },
        select: PROFILE,
      }),
      db.company.findUniqueOrThrow({
        where: { id: requireCompanyId() },
        select: { lawMode: true },
      }),
    ]);
    if (!row) throw new NotFoundException({ message: 'notFound' });
    const { user, ...employee } = row;
    return {
      ...toApi(employee),
      hireDate: toDay(employee.hireDate)!,
      terminationDate: toDay(employee.terminationDate),
      hasDisability: employee.hasDisability,
      lawMode: company.lawMode,
      login: user,
    };
  }

  /**
   * PATCH /employees/:id — personal and job data (EM-02, EM-03). Only what is sent changes; the audit
   * row keeps only the fields that really changed, before and after (FR-DB-4 "Admin changes", D-78).
   */
  async update(
    auth: AuthContext,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeProfile> {
    try {
      await this.tenantPrisma.db.$transaction(async (tx) => {
        const current = await tx.employee.findUnique({
          where: { id },
          select: {
            nameAr: true,
            nameEn: true,
            nationalId: true,
            birthDate: true,
            gender: true,
            phone: true,
            email: true,
            address: true,
            emergencyName: true,
            emergencyPhone: true,
            hasDisability: true,
            jobTitleId: true,
            employmentType: true,
            hireDate: true,
            probationEnd: true,
            trainingEnd: true,
          },
        });
        if (!current) throw new NotFoundException({ message: 'notFound' });

        // The disability field exists only for companies that follow the Labor Law (D-04)
        if (input.hasDisability !== undefined) {
          const company = await tx.company.findUniqueOrThrow({
            where: { id: requireCompanyId() },
            select: { lawMode: true },
          });
          if (!company.lawMode) {
            throw new BadRequestException({
              message: 'validationFailed',
              errors: { hasDisability: 'disabilityNeedsLawMode' },
            });
          }
        }

        const hireDate = input.hireDate ?? toDay(current.hireDate)!;
        const employmentType = input.employmentType ?? current.employmentType;
        const probationEnd =
          input.probationEnd === undefined
            ? toDay(current.probationEnd)
            : input.probationEnd;
        // Changing away from trainee clears the trainee-only date in the same transaction.
        const trainingEnd =
          employmentType !== 'trainee'
            ? null
            : input.trainingEnd === undefined
              ? toDay(current.trainingEnd)
              : input.trainingEnd;
        const errors: Record<string, string> = {};
        if (probationEnd && probationEnd < hireDate)
          errors.probationEnd = 'dateBeforeHire';
        if (trainingEnd && trainingEnd < hireDate)
          errors.trainingEnd = 'dateBeforeHire';
        if (input.trainingEnd && employmentType !== 'trainee')
          errors.trainingEnd = 'trainingEndTraineesOnly';
        if (
          input.jobTitleId &&
          !(await tx.jobTitle.findUnique({
            where: { id: input.jobTitleId },
            select: { id: true },
          }))
        ) {
          errors.jobTitleId = 'invalidReference';
        }
        if (Object.keys(errors).length)
          throw new BadRequestException({
            message: 'validationFailed',
            errors,
          });
        const changes = {
          ...input,
          ...(input.employmentType !== undefined && { trainingEnd }),
        };

        // What really changes, compared as the API shows it (dates as days)
        const before: Partial<Record<EditableField, unknown>> = {};
        const after: Partial<Record<EditableField, unknown>> = {};
        for (const field of EDITABLE_FIELDS) {
          const next = changes[field];
          if (next === undefined) continue;
          const old = [
            'birthDate',
            'hireDate',
            'probationEnd',
            'trainingEnd',
          ].includes(field)
            ? toDay(current[field] as Date | null)
            : current[field];
          if (old !== next) {
            before[field] = old;
            after[field] = next;
          }
        }
        if (Object.keys(after).length === 0) {
          throw new BadRequestException({ message: 'nothingToChange' });
        }

        // One person, one record (D-76): another employee may not hold this national ID
        if (after.nationalId) {
          const taken = await tx.employee.findFirst({
            where: { nationalId: after.nationalId as string, id: { not: id } },
            select: { id: true },
          });
          if (taken) throw nationalIdTaken();
        }

        if (after.hireDate) {
          const [statusChanges, salaries, documents, contracts] =
            await Promise.all([
              tx.employeeStatusHistory.count({
                where: { employeeId: id, fromStatus: { not: null } },
              }),
              tx.salaryHistory.count({ where: { employeeId: id } }),
              tx.document.count({ where: { employeeId: id } }),
              tx.contract.count({ where: { employeeId: id } }),
            ]);
          if (statusChanges || salaries || documents || contracts) {
            throw new BadRequestException({
              message: 'validationFailed',
              errors: { hireDate: 'hireDateInUse' },
            });
          }
          const initial = await tx.employeeStatusHistory.findFirst({
            where: { employeeId: id, fromStatus: null },
          });
          if (initial) {
            await tx.employeeStatusHistory.update({
              where: { id: initial.id },
              data: { effectiveDate: toDate(after.hireDate as string) },
            });
            await this.audit.record(tx, auth.userId, {
              entityType: 'employee_status',
              entityId: initial.id,
              employeeId: id,
              action: 'update',
              before: { effectiveDate: toDay(initial.effectiveDate) },
              after: { effectiveDate: after.hireDate },
              reason: 'Hire date correction',
            });
          }
        }

        await tx.employee.update({
          where: { id },
          data: {
            ...after,
            ...Object.fromEntries(
              ['birthDate', 'hireDate', 'probationEnd', 'trainingEnd']
                .filter((field) => field in after)
                .map((field) => [
                  field,
                  after[field as EditableField] === null
                    ? null
                    : toDate(after[field as EditableField] as string),
                ]),
            ),
          } as Prisma.EmployeeUpdateInput,
        });

        await this.audit.record(tx, auth.userId, {
          entityType: 'employee',
          entityId: id,
          employeeId: id,
          action: 'update',
          before,
          after,
          reason: Object.keys(after).some((field) =>
            [
              'jobTitleId',
              'employmentType',
              'hireDate',
              'probationEnd',
              'trainingEnd',
            ].includes(field),
          )
            ? 'Employee data'
            : 'Personal data',
        });
      });
    } catch (error) {
      // Someone saved the same national ID a moment ago
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw nationalIdTaken();
      }
      throw error;
    }
    return this.profile(id);
  }

  /**
   * POST /employees/:id/access (D-77): an app login for this employee, connected to the record.
   * The same 7-day invite as the Users page (email when there is one, link to copy always).
   * Email and phone default to the employee's own; the login's name is the employee's name.
   */
  async giveAccess(
    auth: AuthContext,
    employeeId: string,
    input: EmployeeAccessInput,
  ) {
    // Another company's employee is not found at all (tenancy)
    const employee = await this.tenantPrisma.db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        email: true,
        phone: true,
        status: true,
        user: { select: { id: true } },
      },
    });
    if (!employee) throw new NotFoundException({ message: 'notFound' });
    if (employee.status === 'terminated') {
      throw new ConflictException({ message: 'employeeTerminated' });
    }
    if (employee.user) {
      throw new ConflictException({ message: 'employeeHasLogin' });
    }

    const email = input.email ?? employee.email ?? undefined;
    const phone = input.phone ?? employee.phone ?? undefined;
    if (!email && !phone) {
      // Login needs one of the two (FR-UA-3)
      throw new BadRequestException({
        message: 'validationFailed',
        errors: { email: 'emailOrPhoneRequired' },
      });
    }

    return this.users.create(
      auth,
      {
        name: input.language === 'ar' ? employee.nameAr : employee.nameEn,
        email,
        phone,
        role: 'employee',
        language: input.language,
      },
      employee.id,
    );
  }

  /** GET /employees: this company's employees (the tenant client adds company_id) */
  async list(query: ListEmployeesQuery): Promise<EmployeeListPage> {
    const db = this.tenantPrisma.db;
    const { page, pageSize } = query;
    const where = whereFor(query);

    const [rows, total, byStatus] = await Promise.all([
      db.employee.findMany({
        where,
        select: LIST_ROW,
        orderBy: orderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.employee.count({ where }),
      // The status tabs: the same filters, every status
      db.employee.groupBy({
        by: ['status'],
        where: { ...where, status: undefined },
        _count: { _all: true },
      }),
    ]);
    const counts = { active: 0, suspended: 0, terminated: 0 };
    for (const group of byStatus) counts[group.status] = group._count._all;
    return { items: rows.map(toListItem), total, page, pageSize, counts };
  }

  /**
   * GET /employees/export: the same filters as the list, every matching row, as an Excel file.
   * A company has at most 50 working employees (A-15) plus those who left, so one query is fine;
   * EXPORT_LIMIT is only a safety net.
   */
  async export(query: ExportEmployeesQuery) {
    const rows = await this.tenantPrisma.db.employee.findMany({
      where: whereFor(query),
      select: LIST_ROW,
      orderBy: orderBy(query.sort),
      take: EXPORT_LIMIT,
    });
    const today = new Date().toISOString().slice(0, 10);
    return {
      file: await employeesWorkbook(rows.map(toListItem), query.lang),
      fileName: `employees-${today}.xlsx`,
    };
  }

  /**
   * POST /employees. Everything happens in one transaction: if any step fails, nothing is saved,
   * not even the code number.
   */
  async create(auth: AuthContext, input: CreateEmployeeInput) {
    const companyId = requireCompanyId();

    return this.tenantPrisma.db.$transaction(async (tx) => {
      // 1. Take the next code number. Updating the company row also locks it until the end of
      //    this transaction, so two Admins creating at the same moment wait for each other:
      //    the limit check and the national ID check below can't both pass for two people (D-76)
      const company = await tx.company.update({
        where: { id: companyId },
        data: { nextEmployeeNumber: { increment: 1 } },
        select: { nextEmployeeNumber: true },
      });
      const code = employeeCode(company.nextEmployeeNumber - 1);

      // 2. The MVP limit (A-15): Active and Suspended employees count
      const counted = await tx.employee.count({
        where: { status: { in: ['active', 'suspended'] } },
      });
      if (counted >= EMPLOYEE_LIMIT) {
        throw new ConflictException({ message: 'employeeLimitReached' });
      }

      // 3. One person, one employee record (D-76). The unique index is the last line of defence
      if (input.nationalId) {
        const taken = await tx.employee.findFirst({
          where: { nationalId: input.nationalId },
          select: { id: true },
        });
        if (taken) throw nationalIdTaken();
      }

      // 4. The employee. A job title of another company → the database refuses it (D-48, 400)
      const employee = await tx.employee.create({
        data: {
          companyId,
          code,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          employmentType: input.employmentType,
          hireDate: toDate(input.hireDate),
          jobTitleId: input.jobTitleId,
          probationEnd: optionalDate(input.probationEnd),
          trainingEnd: optionalDate(input.trainingEnd),
          nationalId: input.nationalId,
          birthDate: optionalDate(input.birthDate),
          gender: input.gender,
          phone: input.phone,
          email: input.email,
          address: input.address,
          emergencyName: input.emergencyName,
          emergencyPhone: input.emergencyPhone,
        },
        select: PUBLIC_EMPLOYEE,
      });

      // 5. The first line of the status history: (none) → Active, from the hire date (FR-EM-7)
      const status = await tx.employeeStatusHistory.create({
        data: {
          companyId,
          employeeId: employee.id,
          fromStatus: null,
          toStatus: 'active',
          effectiveDate: toDate(input.hireDate),
          changedById: auth.userId,
        },
        select: { id: true, employeeId: true },
      });

      // 6. The audit row, in the same transaction. employeeId comes from the saved row (D-75)
      await this.audit.record(tx, auth.userId, {
        entityType: 'employee_status',
        entityId: status.id,
        employeeId: status.employeeId,
        action: 'create',
        after: {
          code,
          status: 'active',
          effectiveDate: input.hireDate,
        },
        reason: 'Employee created',
      });

      return toApi(employee);
    });
  }
}

function nationalIdTaken() {
  return new ConflictException({
    message: 'nationalIdTaken',
    errors: { nationalId: 'nationalIdTaken' },
  });
}
