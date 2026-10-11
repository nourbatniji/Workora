// Company profile (CS-03, FR-CS-3). Each Admin sees and edits only their own company:
// the guarded client limits the companies table to the company on the badge (D-25).
import { Injectable } from '@nestjs/common';
import type { CompanyProfileInput } from '@mdarj/shared';
import type { AuthContext } from '../../auth/auth-context.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { requireCompanyId } from '../../common/tenancy/tenant-context.js';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service.js';

/** What the API shows of the company */
const PROFILE = {
  id: true,
  name: true,
  logo: true,
  address: true,
  phone: true,
  timeZone: true,
  currency: true,
} as const;

@Injectable()
export class CompanyService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** GET /company */
  async profile() {
    return this.tenantPrisma.db.company.findUniqueOrThrow({
      where: { id: requireCompanyId() },
      select: PROFILE,
    });
  }

  /** PATCH /company: saves the profile and records what changed (FR-DB-4) */
  async updateProfile(auth: AuthContext, input: CompanyProfileInput) {
    const id = requireCompanyId();
    return this.tenantPrisma.db.$transaction(async (tx) => {
      const before = await tx.company.findUniqueOrThrow({
        where: { id },
        select: PROFILE,
      });
      const after = await tx.company.update({
        where: { id },
        data: input,
        select: PROFILE,
      });
      await this.audit.record(tx, auth.userId, {
        entityType: 'company_settings',
        entityId: id,
        action: 'update',
        before,
        after,
        reason: 'Company profile',
      });
      return after;
    });
  }
}
