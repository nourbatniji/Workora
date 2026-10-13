import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { AuditService } from '../../src/common/audit/audit.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Effective-dated base salaries (SCRUM-50, FR-EM-3/4)', () => {
  let app: INestApplication<App>,
    prisma: PrismaService,
    r: RoleBrowsers,
    other: RoleBrowsers;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    r = await setupRoleBrowsers(app);
    other = await setupRoleBrowsers(app);
  }, 30000);
  afterAll(async () => {
    await prisma.salaryHistory.deleteMany({
      where: { companyId: { in: [r.companyId, other.companyId] } },
    });
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });
  const path = () => `/employees/${r.ownEmployeeId}/salary-history`;
  it('keeps old salaries and resolves the amount valid on the requested date', async () => {
    const first = await r.admin
      .post(path())
      .send({ baseSalary: '9000.50', effectiveFrom: '2026-01-01' })
      .expect(201);
    await r.admin
      .post(path())
      .send({ baseSalary: '10000', effectiveFrom: '2026-04-01' })
      .expect(201);
    await r.admin
      .post(path())
      .send({ baseSalary: '12000', effectiveFrom: '2099-01-01' })
      .expect(201);
    const past = await r.admin.get(path() + '?date=2026-03-01').expect(200);
    expect(past.body.current).toMatchObject({
      id: first.body.id,
      baseSalary: '9000.50',
    });
    expect(past.body.items).toHaveLength(3);
    expect(
      (await r.admin.get(path() + '?date=2026-04-01').expect(200)).body.current
        .baseSalary,
    ).toBe('10000.00');
    expect(
      (await r.admin.get(path() + '?date=2025-12-31').expect(200)).body.current,
    ).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: first.body.id },
    });
    expect(audit.employeeId).toBe(r.ownEmployeeId);
    expect(audit.after).toEqual({
      baseSalary: '9000.50',
      effectiveFrom: '2026-01-01',
    });
  });
  it('allows employee-own reads, denies colleagues/interviewers and cross-company records', async () => {
    await r.employee.get(path()).expect(200);
    await r.employee
      .get(`/employees/${r.otherEmployeeId}/salary-history`)
      .expect(403);
    await r.interviewer.get(path()).expect(403);
    await r.anonymous().get(path()).expect(401);
    const foreign = `/employees/${other.ownEmployeeId}/salary-history`;
    await r.admin.get(foreign).expect(404);
    await r.admin
      .post(foreign)
      .send({ baseSalary: '1', effectiveFrom: '2026-01-01' })
      .expect(404);
    await r.employee
      .post(path())
      .send({ baseSalary: '1', effectiveFrom: '2026-01-01' })
      .expect(403);
  });
  it('validates decimal precision, maximum size, dates and duplicate effective dates', async () => {
    for (const amount of ['-1', '1.234', '10000000000', 'NaN', '1e3', ''])
      await r.admin
        .post(path())
        .send({ baseSalary: amount, effectiveFrom: '2026-05-01' })
        .expect(400);
    await r.admin
      .post(path())
      .send({ baseSalary: 1, effectiveFrom: '2026-05-01' })
      .expect(400);
    await r.admin
      .post(path())
      .send({ baseSalary: '1', effectiveFrom: '2025-12-31' })
      .expect(400);
    await r.admin
      .post(path())
      .send({ baseSalary: '1', effectiveFrom: '2026-02-30' })
      .expect(400);
    await r.admin.get(path() + '?date=bad').expect(400);
    const duplicate = await r.admin
      .post(path())
      .send({ baseSalary: '1', effectiveFrom: '2026-01-01' })
      .expect(409);
    expect(duplicate.body.errors.effectiveFrom).toBe('salaryDateTaken');
    await r.admin
      .patch(`/employees/${r.ownEmployeeId}`)
      .send({ hireDate: '2026-01-02' })
      .expect(400);
  });
  it('concurrent additions at the same date keep only one row', async () => {
    const responses = await Promise.all([
      r.admin
        .post(path())
        .send({ baseSalary: '0', effectiveFrom: '2026-06-01' }),
      r.admin
        .post(path())
        .send({ baseSalary: '2', effectiveFrom: '2026-06-01' }),
    ]);
    expect(responses.map((row) => row.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.salaryHistory.count({
        where: {
          employeeId: r.ownEmployeeId,
          effectiveFrom: new Date('2026-06-01'),
        },
      }),
    ).toBe(1);
  });
  it('rolls back the salary when its audit fails', async () => {
    const spy = vi
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('test salary audit failure'));
    try {
      await r.admin
        .post(path())
        .send({ baseSalary: '5', effectiveFrom: '2026-07-01' })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.salaryHistory.count({
        where: {
          employeeId: r.ownEmployeeId,
          effectiveFrom: new Date('2026-07-01'),
        },
      }),
    ).toBe(0);
  });
});
