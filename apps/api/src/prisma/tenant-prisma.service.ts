import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';
import { tenancyExtension } from '../common/tenancy/tenancy.extension.js';
import { PrismaService } from './prisma.service.js';

/** Plugs the tenancy guard into a Prisma client. */
export function withTenancy(client: PrismaClient) {
  return client.$extends(tenancyExtension);
}

export type TenantPrismaClient = ReturnType<typeof withTenancy>;

/**
 * The database client modules use: every query is limited to the company on the badge (D-25).
 * The plain PrismaService is only for system work: sign-up, login lookup, seed and scheduled jobs.
 */
@Injectable()
export class TenantPrismaService {
  readonly db: TenantPrismaClient;

  constructor(prisma: PrismaService) {
    this.db = withTenancy(prisma);
  }
}
