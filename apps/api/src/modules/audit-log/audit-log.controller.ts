// Audit log viewer (SCRUM-163, FR-DB-4, NFR-8). Admin only (permissions.md §11: "View the audit log").
// There is no POST, PATCH or DELETE here on purpose: audit rows are never edited or removed.
import { Controller, Get, Query } from '@nestjs/common';
import { auditLogQuerySchema, type AuditLogQuery } from '@mdarj/shared';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuditLogService } from './audit-log.service.js';

@Controller('audit-log')
@Roles('admin')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  // GET /audit-log?page=&pageSize=&employeeId=&type=&from=&to=
  @Get()
  list(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
  ) {
    return this.auditLog.list(query);
  }
}
