import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SalaryChangeInput, SalaryHistory } from '@mdarj/shared';
import type { AuthContext } from '../../auth/auth-context.js';
import { assertOwnEmployee } from '../../auth/own-data.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { requireCompanyId } from '../../common/tenancy/tenant-context.js';
import { Prisma } from '../../generated/prisma/client.js';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service.js';
import { todayIn } from '../company/company-settings.service.js';

const day = (date: Date) => date.toISOString().slice(0, 10);
const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const toEntry = (row: {
  id: string;
  baseSalary: Prisma.Decimal;
  effectiveFrom: Date;
  createdAt: Date;
}) => ({
  id: row.id,
  baseSalary: row.baseSalary.toFixed(2),
  effectiveFrom: day(row.effectiveFrom),
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class EmployeeSalaryService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async history(
    auth: AuthContext,
    employeeId: string,
    date?: string,
  ): Promise<SalaryHistory> {
    const db = this.tenant.db;
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException({ message: 'notFound' });
    assertOwnEmployee(auth, employee.id);
    const company = await db.company.findUniqueOrThrow({
      where: { id: requireCompanyId() },
      select: { currency: true, timeZone: true },
    });
    const asOf = date ?? todayIn(company.timeZone);
    const rows = await db.salaryHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { effectiveFrom: 'desc' },
    });
    const items = rows.map(toEntry);
    return {
      date: asOf,
      currency: company.currency,
      current: items.find((row) => row.effectiveFrom <= asOf) ?? null,
      items,
    };
  }

  async add(auth: AuthContext, employeeId: string, input: SalaryChangeInput) {
    try {
      return await this.tenant.db.$transaction(async (tx) => {
        // Serialize salary additions with hire-date edits on the employee row.
        const locked = await tx.employee.updateMany({
          where: { id: employeeId },
          data: { updatedAt: new Date() },
        });
        if (!locked.count) throw new NotFoundException({ message: 'notFound' });
        const employee = await tx.employee.findUniqueOrThrow({
          where: { id: employeeId },
          select: { id: true, hireDate: true },
        });
        if (input.effectiveFrom < day(employee.hireDate))
          throw new BadRequestException({
            message: 'validationFailed',
            errors: { effectiveFrom: 'dateBeforeHire' },
          });
        const row = await tx.salaryHistory.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employee.id,
            baseSalary: new Prisma.Decimal(input.baseSalary),
            effectiveFrom: toDate(input.effectiveFrom),
            createdById: auth.userId,
          },
        });
        await this.audit.record(tx, auth.userId, {
          entityType: 'salary',
          entityId: row.id,
          employeeId: row.employeeId,
          action: 'create',
          after: {
            baseSalary: row.baseSalary.toFixed(2),
            effectiveFrom: day(row.effectiveFrom),
          },
        });
        return toEntry(row);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          message: 'validationFailed',
          errors: { effectiveFrom: 'salaryDateTaken' },
        });
      throw error;
    }
  }
}
