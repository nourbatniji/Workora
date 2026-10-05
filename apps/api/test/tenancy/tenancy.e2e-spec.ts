// FND-03 / NFR-1: one company must never see or change another company's data.
// Needs the local database: pnpm db:up
import { requireCompanyId } from '../../src/common/tenancy/tenant-context.js';
import { setupTwoCompanies, type TwoCompanies } from './two-companies.js';

// The fields an employee needs, for the company on the badge
function newEmployee(code: string, companyId: string) {
  return {
    companyId,
    code,
    nameAr: 'موظف تجريبي',
    nameEn: 'Test Employee',
    employmentType: 'full_time' as const,
    hireDate: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('Company data isolation (FND-03, NFR-1)', () => {
  let t: TwoCompanies;
  let employeeOfA: string;

  // Prepare: two companies, one employee each
  beforeAll(async () => {
    t = await setupTwoCompanies();
    const created = await t.asA(() =>
      t.db.employee.create({ data: newEmployee('A-001', requireCompanyId()) }),
    );
    employeeOfA = created.id;
    await t.asB(() =>
      t.db.employee.create({ data: newEmployee('B-001', requireCompanyId()) }),
    );
  });

  // Clean up: remove both companies and their rows
  afterAll(async () => {
    await t.cleanup();
  });

  it('blocks a query with no badge', async () => {
    await expect(t.db.employee.findMany()).rejects.toThrow(
      'No company context',
    );
  });

  it('lists only the rows of the company on the badge', async () => {
    const rows = await t.asB(() => t.db.employee.findMany());
    expect(rows.map((row) => row.code)).toEqual(['B-001']);
  });

  it("cannot read another company's row by id", async () => {
    const row = await t.asB(() =>
      t.db.employee.findUnique({ where: { id: employeeOfA } }),
    );
    expect(row).toBeNull();
  });

  it("cannot reach another company's rows by asking for its companyId", async () => {
    const rows = await t.asB(() =>
      t.db.employee.findMany({ where: { companyId: t.companyA } }),
    );
    expect(rows).toEqual([]);
  });

  it("does not count another company's rows", async () => {
    const count = await t.asB(() => t.db.employee.count());
    expect(count).toBe(1);
  });

  it("cannot update another company's row", async () => {
    const result = await t.asB(() =>
      t.db.employee.updateMany({
        where: { id: employeeOfA },
        data: { nameEn: 'Changed' },
      }),
    );
    expect(result.count).toBe(0);
    await expect(
      t.asB(() =>
        t.db.employee.update({
          where: { id: employeeOfA },
          data: { nameEn: 'Changed' },
        }),
      ),
    ).rejects.toThrow();
    const row = await t.prisma.employee.findUniqueOrThrow({
      where: { id: employeeOfA },
    });
    expect(row.nameEn).toBe('Test Employee');
  });

  it("cannot delete another company's row", async () => {
    const result = await t.asB(() =>
      t.db.employee.deleteMany({ where: { id: employeeOfA } }),
    );
    expect(result.count).toBe(0);
    await expect(
      t.asB(() => t.db.employee.delete({ where: { id: employeeOfA } })),
    ).rejects.toThrow();
    expect(await t.prisma.employee.count({ where: { id: employeeOfA } })).toBe(
      1,
    );
  });

  it('saves new rows under the company on the badge', async () => {
    const row = await t.prisma.employee.findUniqueOrThrow({
      where: { id: employeeOfA },
    });
    expect(row.companyId).toBe(t.companyA);
  });

  it('refuses to create a row for another company', async () => {
    await expect(
      t.asB(() =>
        t.db.employee.create({ data: newEmployee('X-001', t.companyA) }),
      ),
    ).rejects.toThrow('for another company');
  });

  it('refuses to move a row to another company', async () => {
    await expect(
      t.asA(() =>
        t.db.employee.update({
          where: { id: employeeOfA },
          data: { companyId: t.companyB },
        }),
      ),
    ).rejects.toThrow('for another company');
  });

  it('reads only its own row in the companies table', async () => {
    const own = await t.asB(() =>
      t.db.company.findUnique({ where: { id: t.companyB } }),
    );
    const other = await t.asB(() =>
      t.db.company.findUnique({ where: { id: t.companyA } }),
    );
    expect(own?.id).toBe(t.companyB);
    expect(other).toBeNull();
  });

  it('cannot create or delete companies through the guarded client', async () => {
    await expect(
      t.asA(() => t.db.company.create({ data: { name: 'Sneaky' } })),
    ).rejects.toThrow('Cannot create companies here');
    await expect(
      t.asA(() => t.db.company.delete({ where: { id: t.companyB } })),
    ).rejects.toThrow('Cannot delete companies here');
  });
});
