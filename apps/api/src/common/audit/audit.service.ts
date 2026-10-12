// The audit writer (FND-07, FR-DB-4, NFR-8): the one place every feature adds an audit row.
// It only ever adds rows. The database itself refuses UPDATE and DELETE on audit_log
// (trigger in migration 20261009155405_audit_log).
import { Injectable } from '@nestjs/common';
import type {
  AuditAction,
  AuditEntity,
  Prisma,
} from '../../generated/prisma/client.js';
import type { TenantPrismaClient } from '../../prisma/tenant-prisma.service.js';
import { requireCompanyId } from '../tenancy/tenant-context.js';

/** A client that can write audit rows: tenant.db, or tx inside tenant.db.$transaction(...) */
export type AuditDb = Pick<TenantPrismaClient, 'auditLog'>;

/**
 * Records that always belong to one employee (D-75). Their audit entries must say which employee,
 * so the viewer can filter by employee. The service takes that id from the record as stored in the
 * database (a salary change: the salary row's employee_id), never from an id the browser sent.
 */
export const EMPLOYEE_AUDIT_ENTITIES = [
  'salary',
  'employee_status',
  'contract',
  'document',
  'attendance_record',
  'leave_request',
  'leave_balance',
  'exception',
] as const satisfies readonly AuditEntity[];

export type EmployeeAuditEntity = (typeof EMPLOYEE_AUDIT_ENTITIES)[number];

interface AuditEntryBase {
  /** The id of the changed row */
  entityId: string;
  /** What happened to it */
  action: AuditAction;
  /** The record before the change. Leave out on create */
  before?: unknown;
  /** The record after the change. Leave out on delete */
  after?: unknown;
  /** Why. Each feature decides when a reason is required (D-59) */
  reason?: string;
}

/**
 * One audit entry. For an employee record (a salary, a contract…) employeeId is required, so
 * TypeScript refuses an entry that forgets it; for company settings, users and payroll runs it is
 * optional (D-75).
 */
export type AuditEntry =
  | (AuditEntryBase & {
      /** What kind of record changed */
      entityType: EmployeeAuditEntity;
      /** The employee the record belongs to, read from the database (D-75) */
      employeeId: string;
    })
  | (AuditEntryBase & {
      entityType: Exclude<AuditEntity, EmployeeAuditEntity>;
      /** The employee the change is about, if any (a user login linked to an employee) */
      employeeId?: string;
    });

const isEmployeeEntity = (type: AuditEntity): type is EmployeeAuditEntity =>
  (EMPLOYEE_AUDIT_ENTITIES as readonly AuditEntity[]).includes(type);

@Injectable()
export class AuditService {
  /**
   * Adds one audit row.
   * Pass the transaction (tx) the change runs in, so the change and its audit row are saved
   * together or not at all. userId is the person who made the change, or null for a
   * scheduled job (D-58). The company always comes from the badge, never from the caller.
   */
  async record(
    db: AuditDb,
    userId: string | null,
    entry: AuditEntry,
  ): Promise<void> {
    // Second lock behind the type (D-75): a cast or plain JavaScript can't skip the employee
    if (isEmployeeEntity(entry.entityType) && !entry.employeeId) {
      throw new Error(
        `AuditService: a ${entry.entityType} entry needs the employeeId of its record (D-75)`,
      );
    }
    await db.auditLog.create({
      data: {
        companyId: requireCompanyId(),
        userId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: toJson(entry.before),
        after: toJson(entry.after),
        reason: entry.reason,
        employeeId: entry.employeeId,
      },
    });
  }
}

/** A plain JSON copy of a record: money (Decimal) becomes a string, dates become ISO strings */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
