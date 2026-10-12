// Audit log viewer (SCRUM-163, FR-DB-4, NFR-8): reads audit rows. It never changes them; the
// writer is AuditService (common/audit), and the database refuses UPDATE and DELETE (D-60).
import { Injectable } from '@nestjs/common';
import type { AuditLogItem, AuditLogPage, AuditLogQuery } from '@mdarj/shared';
import { requireCompanyId } from '../../common/tenancy/tenant-context.js';
import { nextDay, startOfDayIn } from '../../common/time/zoned-day.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service.js';

/** What the viewer shows of each row, with the person who made it and the employee it is about */
const AUDIT_ROW = {
  id: true,
  createdAt: true,
  entityType: true,
  entityId: true,
  action: true,
  before: true,
  after: true,
  reason: true,
  user: { select: { id: true, name: true, email: true } },
  employee: { select: { id: true, code: true, nameAr: true, nameEn: true } },
} satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof AUDIT_ROW }>;

function toItem(row: AuditRow): AuditLogItem {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class AuditLogService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** GET /audit-log: newest first, this company only (the tenant client adds company_id) */
  async list(query: AuditLogQuery): Promise<AuditLogPage> {
    const db = this.tenantPrisma.db;
    const { page, pageSize } = query;
    const where = await this.filters(query);

    const [rows, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        select: AUDIT_ROW,
        // id as a tie-break, so two rows saved in the same millisecond keep one order across pages
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ]);
    return { items: rows.map(toItem), total, page, pageSize };
  }

  /** The query's filters as a Prisma where. Dates are days in the company's time zone */
  private async filters(query: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.entityType = { in: query.type };

    if (query.from || query.to) {
      const { timeZone } = await this.tenantPrisma.db.company.findUniqueOrThrow(
        {
          where: { id: requireCompanyId() },
          select: { timeZone: true },
        },
      );
      where.createdAt = {
        // from the start of "from" …
        ...(query.from && { gte: startOfDayIn(query.from, timeZone) }),
        // … up to, but not including, the start of the day after "to"
        ...(query.to && { lt: startOfDayIn(nextDay(query.to), timeZone) }),
      };
    }
    return where;
  }
}
