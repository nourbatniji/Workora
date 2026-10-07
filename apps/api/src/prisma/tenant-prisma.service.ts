import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';
import { tenancyExtension } from '../common/tenancy/tenancy.extension.js';
import { PrismaService } from './prisma.service.js';

/**
 * Raw SQL methods skip the tenancy extension, so a raw query would see every company's rows.
 * The guarded client refuses them (api-conventions.md §8, SCRUM-167).
 */
export const RAW_SQL_METHODS = [
  '$queryRaw',
  '$queryRawUnsafe',
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRawTyped',
] as const;

export const RAW_SQL_REFUSED =
  'Raw SQL is not allowed on the company-scoped client: it skips company isolation (api-conventions.md §8)';

/** Wraps a client so raw SQL throws, including inside $transaction(async (tx) => …) */
function refuseRawSql<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      if ((RAW_SQL_METHODS as readonly (string | symbol)[]).includes(prop)) {
        return () => {
          throw new Error(RAW_SQL_REFUSED);
        };
      }
      const value: unknown = Reflect.get(target, prop);
      if (prop === '$transaction' && typeof value === 'function') {
        // Interactive transactions hand out a new client (tx): guard that one too
        return (arg: unknown, ...rest: unknown[]) =>
          typeof arg === 'function'
            ? (value as (...a: unknown[]) => unknown).call(
                target,
                (tx: object) =>
                  (arg as (t: object) => unknown)(refuseRawSql(tx)),
                ...rest,
              )
            : (value as (...a: unknown[]) => unknown).call(
                target,
                arg,
                ...rest,
              );
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Plugs the tenancy guard into a Prisma client, and refuses raw SQL on it. */
export function withTenancy(client: PrismaClient) {
  return refuseRawSql(client.$extends(tenancyExtension));
}

export type TenantPrismaClient = ReturnType<typeof withTenancy>;

/**
 * The database client modules use: every query is limited to the company on the badge (D-25),
 * and raw SQL is refused. The plain PrismaService is only for system work: sign-up, login lookup,
 * sessions, seed and scheduled jobs.
 */
@Injectable()
export class TenantPrismaService {
  readonly db: TenantPrismaClient;

  constructor(prisma: PrismaService) {
    this.db = withTenancy(prisma);
  }
}
