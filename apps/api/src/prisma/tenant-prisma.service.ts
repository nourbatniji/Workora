import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';
import { tenancyExtension } from '../common/tenancy/tenancy.extension.js';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';
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

/** The one raw statement allowed on a transaction: the company settings lock (D-70) */
const SETTINGS_LOCK = Symbol('settingsLock');

/**
 * The company's settings lock (D-70), held until the transaction ends.
 * - 'exclusive': a settings save. It waits until running attendance, exception and payroll writes
 *   finish, and blocks new ones while it checks which dates are still free and saves.
 * - 'shared': attendance, exception and payroll writes. Many can hold it at once; they only wait
 *   while a settings save runs, so a punch can never slip in between that check and the save.
 * Only works inside tenantPrisma.db.$transaction(async (tx) => …). The company comes from the
 * logged-in user, never from input. It is a Postgres advisory lock: a named lock that guards no
 * table row, keyed by (70, hash of the company id).
 */
export async function lockCompanySettings(
  tx: object,
  mode: 'shared' | 'exclusive',
): Promise<void> {
  const lock: unknown = Reflect.get(tx, SETTINGS_LOCK);
  if (typeof lock !== 'function') {
    throw new Error(
      'lockCompanySettings needs the tx of tenantPrisma.db.$transaction',
    );
  }
  await (lock as (m: typeof mode) => Promise<unknown>)(mode);
}

type RawExecutor = {
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<number>;
};

/** Wraps a client so raw SQL throws, including inside $transaction(async (tx) => …) */
function refuseRawSql<T extends object>(client: T, inTransaction = false): T {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === SETTINGS_LOCK) {
        // Outside a transaction the lock would be released at once, so it is not offered
        if (!inTransaction) return undefined;
        const raw = target as unknown as RawExecutor;
        return (mode: 'shared' | 'exclusive') => {
          const companyId = requireCompanyId();
          // $executeRaw, not $queryRaw: these functions return nothing (void)
          return mode === 'shared'
            ? raw.$executeRaw`SELECT pg_advisory_xact_lock_shared(70, hashtext(${companyId}))`
            : raw.$executeRaw`SELECT pg_advisory_xact_lock(70, hashtext(${companyId}))`;
        };
      }
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
                  (arg as (t: object) => unknown)(refuseRawSql(tx, true)),
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
