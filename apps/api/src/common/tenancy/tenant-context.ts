// The "badge": which company the current request works for (FND-03, NFR-1, D-25).
// Login (UA-03) will call runInCompany() once per request with the user's company.
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage<{ companyId: string }>();

/**
 * Runs fn with the company badge on. fn is awaited inside, so lazy Prisma queries
 * run while the badge is still on.
 */
export async function runInCompany<T>(
  companyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ companyId }, async () => await fn());
}

/** The company on the badge, or undefined when there is no badge. */
export function currentCompanyId(): string | undefined {
  return storage.getStore()?.companyId;
}

/** The company on the badge. Throws when there is no badge. */
export function requireCompanyId(): string {
  const companyId = currentCompanyId();
  if (!companyId) {
    throw new Error('No company context');
  }
  return companyId;
}
