// Employees (SRS 3.3). EM-01 (SCRUM-48): the Admin creates an employee; the system gives the code.
import { ConflictException, Injectable } from '@nestjs/common';
import {
  EMPLOYEE_LIMIT,
  employeeCode,
  type CreateEmployeeInput,
} from '@mdarj/shared';
import type { AuthContext } from '../../auth/auth-context.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { requireCompanyId } from '../../common/tenancy/tenant-context.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service.js';

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

@Injectable()
export class EmployeesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

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
        if (taken) {
          throw new ConflictException({
            message: 'nationalIdTaken',
            errors: { nationalId: 'nationalIdTaken' },
          });
        }
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
