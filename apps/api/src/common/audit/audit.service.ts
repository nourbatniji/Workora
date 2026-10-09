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

export interface AuditEntry {
  /** What kind of record changed (a salary, a contract…) */
  entityType: AuditEntity;
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
      },
    });
  }
}

/** A plain JSON copy of a record: money (Decimal) becomes a string, dates become ISO strings */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
