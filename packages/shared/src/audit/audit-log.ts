// Audit log viewer (SCRUM-163, FR-DB-4, NFR-8): what GET /audit-log accepts.
// One schema for both sides (D-30): the page's filters check it before sending, the API checks it again.
import { z } from 'zod';
import { isoDateSchema } from '../settings/settings-versions.js';

/** What kind of record an audit row is about. Same list as the AuditEntity enum in schema.prisma */
export const AUDIT_ENTITY_TYPES = [
  'employee',
  'company_settings',
  'salary',
  'shift_template',
  'shift_assignment',
  'employee_status',
  'contract',
  'document',
  'user',
  'attendance_record',
  'leave_request',
  'leave_balance',
  'exception',
  'payroll_run',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** What happened to the record. Same list as the AuditAction enum in schema.prisma */
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'reopen',
] as const;

export type AuditActionType = (typeof AUDIT_ACTIONS)[number];

/** "user,salary" → ['user', 'salary'] (api-conventions.md §7: comma for several values) */
const typeListSchema = z
  .string('badRequest')
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== ''),
  )
  .pipe(z.array(z.enum(AUDIT_ENTITY_TYPES, 'badRequest')).min(1, 'badRequest'));

/**
 * GET /audit-log?page=&pageSize=&employeeId=&type=&from=&to=
 * - employeeId: only changes about this employee (D-75)
 * - type: one or more record kinds, comma separated
 * - from, to: days in the company's time zone, both included
 */
export const auditLogQuerySchema = z
  .object({
    page: z.coerce
      .number('badRequest')
      .int('badRequest')
      .min(1, 'badRequest')
      .default(1),
    pageSize: z.coerce
      .number('badRequest')
      .int('badRequest')
      .min(1, 'badRequest')
      .max(100, 'badRequest')
      .default(20),
    employeeId: z.uuid('badRequest').optional(),
    type: typeListSchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'dateRangeInvalid',
    path: ['to'],
  });

/** What the page sends (strings from the address bar) */
export type AuditLogQueryRequest = z.input<typeof auditLogQuerySchema>;

/** What the API works with: numbers filled in, type split into a list */
export type AuditLogQuery = z.output<typeof auditLogQuerySchema>;

/** One row as GET /audit-log returns it */
export interface AuditLogItem {
  id: string;
  /** When, as an ISO date-time (UTC); the page shows it in the company's time zone */
  createdAt: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditActionType;
  /** The values before the change; null when the record was created */
  before: unknown;
  /** The values after the change; null when the record was deleted */
  after: unknown;
  reason: string | null;
  /** Who made the change; null for a scheduled job */
  user: { id: string; name: string | null; email: string | null } | null;
  /** The employee the change is about, when there is one */
  employee: { id: string; code: string; nameAr: string; nameEn: string } | null;
  /** For a change to a login (entityType 'user'): whose login it was */
  subjectUser: { name: string | null; email: string | null } | null;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
}
