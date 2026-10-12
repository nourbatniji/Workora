// FND-07 (SCRUM-26) / FR-DB-4 / NFR-8: the audit writer adds one row per change, in the same
// transaction as the change; the database refuses to change or delete audit rows; and each
// company sees only its own entries. D-75: entries about an employee record name that employee,
// never another company's. Needs the local database: pnpm db:up
import { randomUUID } from 'node:crypto';
import {
  AuditService,
  type AuditEntry,
} from '../../src/common/audit/audit.service.js';
import { requireCompanyId } from '../../src/common/tenancy/tenant-context.js';
import {
  setupTwoCompanies,
  type TwoCompanies,
} from '../tenancy/two-companies.js';

describe('Audit log (FND-07, NFR-8)', () => {
  let t: TwoCompanies;
  const audit = new AuditService();
  let adminA: string;
  let employeeA: string; // Ahmad, company A
  let employeeB: string; // Sara, company B
  let entryA: string;

  /** An employee of the company on the badge */
  const newEmployee = (code: string, nameEn: string) =>
    t.db.employee.create({
      data: {
        companyId: requireCompanyId(),
        code: `${code}-${randomUUID().slice(0, 8)}`,
        nameAr: 'موظف',
        nameEn,
        employmentType: 'full_time',
        hireDate: new Date('2026-01-01T00:00:00Z'),
      },
    });

  beforeAll(async () => {
    t = await setupTwoCompanies();
    adminA = (
      await t.asA(() =>
        t.db.user.create({
          data: {
            companyId: requireCompanyId(),
            email: `admin-${randomUUID()}@a.test`,
            role: 'admin',
          },
        }),
      )
    ).id;
    employeeA = (await t.asA(() => newEmployee('A', 'Ahmad'))).id;
    employeeB = (await t.asB(() => newEmployee('B', 'Sara'))).id;
  });

  afterAll(async () => {
    await t.cleanup();
  });

  it('records who, what, before, after, when and the employee, under the company on the badge', async () => {
    const salaryId = randomUUID();
    await t.asA(() =>
      audit.record(t.db, adminA, {
        entityType: 'salary',
        entityId: salaryId,
        action: 'update',
        before: { baseSalary: '9000.00' },
        after: { baseSalary: '10000.00' },
        employeeId: employeeA,
      }),
    );

    const row = await t.prisma.auditLog.findFirstOrThrow({
      where: { entityId: salaryId },
    });
    entryA = row.id;
    expect(row).toMatchObject({
      companyId: t.companyA,
      userId: adminA,
      entityType: 'salary',
      action: 'update',
      before: { baseSalary: '9000.00' },
      after: { baseSalary: '10000.00' },
      reason: null,
      employeeId: employeeA,
    });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('keeps before empty on create, and the user empty for a scheduled job', async () => {
    const contractId = randomUUID();
    await t.asA(() =>
      audit.record(t.db, null, {
        entityType: 'contract',
        entityId: contractId,
        action: 'create',
        after: { type: 'fixed_term', startDate: '2026-10-09' },
        employeeId: employeeA,
      }),
    );

    const row = await t.prisma.auditLog.findFirstOrThrow({
      where: { entityId: contractId },
    });
    expect(row.userId).toBeNull();
    expect(row.before).toBeNull();
    expect(row.after).toEqual({ type: 'fixed_term', startDate: '2026-10-09' });
  });

  it('disappears together with a change that fails (same transaction)', async () => {
    const salaryId = randomUUID();
    await expect(
      t.asA(() =>
        t.db.$transaction(async (tx) => {
          await audit.record(tx, adminA, {
            entityType: 'salary',
            entityId: salaryId,
            action: 'create',
            after: { baseSalary: '9000.00' },
            employeeId: employeeA,
          });
          throw new Error('the salary change failed');
        }),
      ),
    ).rejects.toThrow('the salary change failed');

    expect(
      await t.prisma.auditLog.count({ where: { entityId: salaryId } }),
    ).toBe(0);
  });

  it('cannot be changed, even with no guard', async () => {
    await expect(
      t.prisma.auditLog.update({
        where: { id: entryA },
        data: { reason: 'edited later' },
      }),
    ).rejects.toThrow();

    const row = await t.prisma.auditLog.findUniqueOrThrow({
      where: { id: entryA },
    });
    expect(row.reason).toBeNull();
  });

  it('cannot be deleted, even with no guard', async () => {
    await expect(
      t.prisma.auditLog.delete({ where: { id: entryA } }),
    ).rejects.toThrow();

    expect(await t.prisma.auditLog.count({ where: { id: entryA } })).toBe(1);
  });

  it("does not show company A's entries to company B", async () => {
    const seenByB = await t.asB(() => t.db.auditLog.findMany());
    expect(seenByB).toEqual([]);

    const seenByA = await t.asA(() => t.db.auditLog.findMany());
    expect(seenByA.length).toBe(2);
  });

  it('refuses a user from another company (D-48)', async () => {
    // Everything else is valid for company B, so only the user can be the reason
    await expect(
      t.asB(() =>
        audit.record(t.db, adminA, {
          entityType: 'salary',
          entityId: randomUUID(),
          action: 'create',
          employeeId: employeeB,
        }),
      ),
    ).rejects.toThrow();
  });

  describe('the employee of the record (D-75)', () => {
    it('refuses an employee from another company', async () => {
      const salaryId = randomUUID();
      await expect(
        t.asA(() =>
          audit.record(t.db, adminA, {
            entityType: 'salary',
            entityId: salaryId,
            action: 'create',
            employeeId: employeeB,
          }),
        ),
      ).rejects.toThrow();
      expect(
        await t.prisma.auditLog.count({ where: { entityId: salaryId } }),
      ).toBe(0);
    });

    it('refuses an employee record entry that leaves the employee out', async () => {
      // TypeScript already refuses this; the cast plays a caller that slipped past it
      const salaryId = randomUUID();
      const noEmployee = {
        entityType: 'salary',
        entityId: salaryId,
        action: 'update',
      } as unknown as AuditEntry;

      await expect(
        t.asA(() => audit.record(t.db, adminA, noEmployee)),
      ).rejects.toThrow(/needs the employeeId/);
      expect(
        await t.prisma.auditLog.count({ where: { entityId: salaryId } }),
      ).toBe(0);
    });

    it('lets a settings or user change leave the employee empty', async () => {
      const settingsId = randomUUID();
      await t.asA(() =>
        audit.record(t.db, adminA, {
          entityType: 'company_settings',
          entityId: settingsId,
          action: 'update',
          after: { restDays: [5] },
        }),
      );

      const row = await t.prisma.auditLog.findFirstOrThrow({
        where: { entityId: settingsId },
      });
      expect(row.employeeId).toBeNull();
    });
  });
});
