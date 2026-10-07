// SCRUM-167 / api-conventions.md §8: raw SQL skips the tenancy guard, so the company-scoped
// client refuses it. Normal queries keep working, inside and outside transactions.
// Needs the local database: pnpm db:up
import { requireCompanyId } from '../../src/common/tenancy/tenant-context.js';
import {
  RAW_SQL_METHODS,
  RAW_SQL_REFUSED,
} from '../../src/prisma/tenant-prisma.service.js';
import { setupTwoCompanies, type TwoCompanies } from './two-companies.js';

describe('Raw SQL is refused on the company-scoped client (SCRUM-167)', () => {
  let t: TwoCompanies;

  beforeAll(async () => {
    t = await setupTwoCompanies();
    await t.asA(() =>
      t.db.jobTitle.create({
        data: {
          companyId: requireCompanyId(),
          nameAr: 'محاسب',
          nameEn: 'Accountant',
        },
      }),
    );
  });

  afterAll(async () => {
    await t.cleanup();
  });

  it.each(RAW_SQL_METHODS)('refuses %s', async (method) => {
    const db = t.db as unknown as Record<string, (...a: unknown[]) => unknown>;
    await expect(
      t.asB(async () => db[method]('SELECT company_id FROM job_titles')),
    ).rejects.toThrow(RAW_SQL_REFUSED);
  });

  it('refuses raw SQL inside an interactive transaction too', async () => {
    await expect(
      t.asB(() =>
        t.db.$transaction(async (tx) =>
          tx.$queryRawUnsafe('SELECT company_id FROM job_titles'),
        ),
      ),
    ).rejects.toThrow(RAW_SQL_REFUSED);
  });

  it('still runs normal, company-scoped queries inside a transaction', async () => {
    const titles = await t.asA(() =>
      t.db.$transaction(async (tx) => tx.jobTitle.findMany()),
    );
    expect(titles.map((title) => title.nameEn)).toEqual(['Accountant']);
  });

  it('keeps the plain client usable for system work (seed, jobs)', async () => {
    const rows =
      await t.prisma.$queryRawUnsafe<{ n: number }[]>('SELECT 1 AS n');
    expect(rows[0].n).toBe(1);
  });
});
