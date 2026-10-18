import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';
import type { AuthContext } from '../auth/auth-context.js';
import type {
  ChangeEmployeeStatusInput,
  EmployeeStatusHistory,
} from '@mdarj/shared';
import { AuditService } from '../common/audit/audit.service.js';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';
import { todayIn } from '../company/company-settings.service.js';
import { assertOwnEmployee } from '../auth/own-data.js';

@Injectable()
export class EmployeeStatusService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}
  async list(
    auth: AuthContext,
    employeeId: string,
  ): Promise<EmployeeStatusHistory> {
    const employee = await this.tenant.db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException({ message: 'notFound' });
    }

    assertOwnEmployee(auth, employee.id);
    const rows = await this.tenant.db.employeeStatusHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        effectiveDate: true,
        reason: true,
        changedBy: {
          select: { id: true, name: true },
        },
        createdAt: true,
      },
    });
    const company = await this.tenant.db.company.findUniqueOrThrow({
      where: { id: requireCompanyId() },
      select: { timeZone: true },
    });
    return {
      date: todayIn(company.timeZone),
      items: rows.map((row) => ({
        ...row,
        effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
  async add(
    auth: AuthContext,
    employeeId: string,
    input: ChangeEmployeeStatusInput,
  ) {
    return this.tenant.db.$transaction(async (tx) => {
      // Lock the employee row so simultaneous changes cannot fork the timeline.
      const locked = await tx.employee.updateMany({
        where: { id: employeeId },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new NotFoundException({ message: 'notFound' });
      const employee = await tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
      });
      const latest = await tx.employeeStatusHistory.findFirst({
        where: { employeeId },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      });
      const day = (value: Date) => value.toISOString().slice(0, 10);
      if (input.effectiveDate < day(employee.hireDate))
        throw new BadRequestException({
          message: 'validationFailed',
          errors: { effectiveDate: 'dateBeforeHire' },
        });
      if (latest && input.effectiveDate <= day(latest.effectiveDate))
        throw new ConflictException({
          message: 'validationFailed',
          errors: { effectiveDate: 'statusDateOrder' },
        });
      const fromStatus = latest?.toStatus ?? employee.status;
      if (input.toStatus === fromStatus)
        throw new BadRequestException({
          message: 'validationFailed',
          errors: { toStatus: 'statusUnchanged' },
        });
      const row = await tx.employeeStatusHistory.create({
        data: {
          companyId: requireCompanyId(),
          employeeId,
          fromStatus,
          toStatus: input.toStatus,
          effectiveDate: new Date(input.effectiveDate + 'T00:00:00Z'),
          reason: input.reason,
          changedById: auth.userId,
        },
      });
      const company = await tx.company.findUniqueOrThrow({
        where: { id: requireCompanyId() },
        select: { timeZone: true },
      });
      if (input.effectiveDate <= todayIn(company.timeZone))
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            status: input.toStatus,
            terminationDate:
              input.toStatus === 'terminated' ? row.effectiveDate : null,
          },
        });
      await this.audit.record(tx, auth.userId, {
        entityType: 'employee_status',
        entityId: row.id,
        employeeId,
        action: 'update',
        before: { status: fromStatus },
        after: { status: row.toStatus, effectiveDate: input.effectiveDate },
        reason: input.reason,
      });
      return {
        id: row.id,
        fromStatus,
        toStatus: row.toStatus,
        effectiveDate: input.effectiveDate,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  /** Reconcile the stored current status with the timeline on company-local today. */
  async refreshCurrent() {
    const company = await this.tenant.db.company.findUnique({
      where: { id: requireCompanyId() },
      select: { timeZone: true },
    });
    // A worker may have listed the company just before it was deleted.
    if (!company) return;
    const today = new Date(todayIn(company.timeZone) + 'T00:00:00Z');
    const employees = await this.tenant.db.employee.findMany({
      select: { id: true, status: true, terminationDate: true },
    });
    for (const employee of employees) {
      const due = await this.tenant.db.employeeStatusHistory.findFirst({
        where: { employeeId: employee.id, effectiveDate: { lte: today } },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      });
      if (
        !due ||
        (employee.status === due.toStatus &&
          (employee.terminationDate?.getTime() ?? null) ===
            (due.toStatus === 'terminated'
              ? due.effectiveDate.getTime()
              : null))
      )
        continue;
      await this.tenant.db.$transaction(async (tx) => {
        // Same lock as add(): never overwrite a concurrent change with a stale snapshot.
        const locked = await tx.employee.updateMany({
          where: { id: employee.id },
          data: { updatedAt: new Date() },
        });
        if (!locked.count) return;
        const current = await tx.employeeStatusHistory.findFirst({
          where: { employeeId: employee.id, effectiveDate: { lte: today } },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        });
        if (current)
          await tx.employee.updateMany({
            where: { id: employee.id },
            data: {
              status: current.toStatus,
              terminationDate:
                current.toStatus === 'terminated'
                  ? current.effectiveDate
                  : null,
            },
          });
      });
    }
  }
}
