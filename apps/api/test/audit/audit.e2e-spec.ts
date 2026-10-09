// FND-07 (SCRUM-26) / FR-DB-4 / NFR-8: the audit writer adds one row per change, in the same
// transaction as the change; the database refuses to change or delete audit rows; and each
// company sees only its own entries. Needs the local database: pnpm db:up
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../src/common/audit/audit.service.js';
import { requireCompanyId } from '../../src/common/tenancy/tenant-context.js';
import {
  setupTwoCompanies,
  type TwoCompanies,
} from '../tenancy/two-companies.js';

describe('Audit log (FND-07, NFR-8)', () => {
  let t: TwoCompanies;
  const audit = new AuditService();
  let adminA: string;
  let entryA: string;

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
  });

  afterAll(async () => {
    await t.cleanup();
  });

  it('records who, what, before, after and when, under the company on the badge', async () => {
    const salaryId = randomUUID();
    await t.asA(() =>
      audit.record(t.db, adminA, {
        entityType: 'salary',
        entityId: salaryId,
        action: 'update',
        before: { baseSalary: '9000.00' },
        after: { baseSalary: '10000.00' },
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
    await expect(
      t.asB(() =>
        audit.record(t.db, adminA, {
          entityType: 'salary',
          entityId: randomUUID(),
          action: 'create',
        }),
      ),
    ).rejects.toThrow();
  });
});
