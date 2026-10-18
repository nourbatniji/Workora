import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ShiftAssignmentInput, ShiftTemplateInput } from '@mdarj/shared';
import type { AuthContext } from '../auth/auth-context.js';
import { AuditService } from '../common/audit/audit.service.js';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';
import { todayIn } from '../company/company-settings.service.js';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}
  async templates() {
    return {
      items: await this.tenant.db.shiftTemplate.findMany({
        orderBy: { name: 'asc' },
      }),
    };
  }
  async create(auth: AuthContext, input: ShiftTemplateInput) {
    try {
      return await this.tenant.db.$transaction(async (tx) => {
        const row = await tx.shiftTemplate.create({
          data: {
            ...input,
            workingDays: [...input.workingDays].sort((a, b) => a - b),
            companyId: requireCompanyId(),
          },
        });
        await this.audit.record(tx, auth.userId, {
          entityType: 'shift_template',
          entityId: row.id,
          action: 'create',
          after: input,
        });
        return row;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          message: 'validationFailed',
          errors: { name: 'shiftNameTaken' },
        });
      throw error;
    }
  }
  async assignments(employeeId: string, date?: string) {
    const db = this.tenant.db;
    if (
      !(await db.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      }))
    )
      throw new NotFoundException({ message: 'notFound' });
    const company = await db.company.findUniqueOrThrow({
      where: { id: requireCompanyId() },
      select: { timeZone: true },
    });
    const asOf = date ?? todayIn(company.timeZone);
    const rows = await db.shiftAssignment.findMany({
      where: { employeeId },
      include: { shiftTemplate: true },
      orderBy: { startDate: 'desc' },
    });
    const items = rows.map((row) => ({
      id: row.id,
      startDate: row.startDate.toISOString().slice(0, 10),
      shiftTemplate: row.shiftTemplate,
    }));
    return {
      date: asOf,
      current: items.find((row) => row.startDate <= asOf) ?? null,
      items,
    };
  }
  async assign(
    auth: AuthContext,
    employeeId: string,
    input: ShiftAssignmentInput,
  ) {
    try {
      return await this.tenant.db.$transaction(async (tx) => {
        const locked = await tx.employee.updateMany({
          where: { id: employeeId },
          data: { updatedAt: new Date() },
        });
        if (!locked.count) throw new NotFoundException({ message: 'notFound' });
        const employee = await tx.employee.findUniqueOrThrow({
          where: { id: employeeId },
          select: { id: true, hireDate: true },
        });
        const errors: Record<string, string> = {};
        if (input.startDate < employee.hireDate.toISOString().slice(0, 10))
          errors.startDate = 'dateBeforeHire';
        if (
          !(await tx.shiftTemplate.findUnique({
            where: { id: input.shiftTemplateId },
            select: { id: true },
          }))
        )
          errors.shiftTemplateId = 'invalidReference';
        if (Object.keys(errors).length)
          throw new BadRequestException({
            message: 'validationFailed',
            errors,
          });
        const row = await tx.shiftAssignment.create({
          data: {
            ...input,
            startDate: new Date(`${input.startDate}T00:00:00Z`),
            employeeId: employee.id,
            companyId: requireCompanyId(),
          },
        });
        await this.audit.record(tx, auth.userId, {
          entityType: 'shift_assignment',
          entityId: row.id,
          employeeId: row.employeeId,
          action: 'create',
          after: {
            shiftTemplateId: row.shiftTemplateId,
            startDate: input.startDate,
          },
        });
        return {
          id: row.id,
          startDate: input.startDate,
          shiftTemplateId: row.shiftTemplateId,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          message: 'validationFailed',
          errors: { startDate: 'shiftDateTaken' },
        });
      throw error;
    }
  }
}
