import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { EmployeeStatusService } from '../../src/employees/employee-status.service.js';
import { runInCompany } from '../../src/common/tenancy/tenant-context.js';
import * as companyTime from '../../src/company/company-settings.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Employee status changes (SCRUM-54)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let employeeId: string;
  const changes = () => `/employees/${employeeId}/status-changes`;
  const history = () => `/employees/${employeeId}/status-history`;

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
    const person = await r.admin
      .post('/employees')
      .send({
        nameAr: 'موظف الحالة',
        nameEn: 'Status Employee',
        employmentType: 'full_time',
        hireDate: '2026-01-01',
      })
      .expect(201);
    employeeId = person.body.id;
  }, 30000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
    await r.cleanup();
    await other.cleanup();
  });

  it('applies a due change and records the reason, author and audit entry', async () => {
    const change = await r.admin
      .post(changes())
      .send({
        toStatus: 'suspended',
        effectiveDate: '2026-02-01',
        reason: 'Temporary suspension',
      })
      .expect(201);
    expect(
      await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    ).toMatchObject({ status: 'suspended', terminationDate: null });
    const result = await r.admin.get(history()).expect(200);
    expect(result.body.items).toHaveLength(2);
    expect(result.body.items[0]).toMatchObject({
      fromStatus: 'active',
      toStatus: 'suspended',
      reason: 'Temporary suspension',
      changedBy: { name: 'Role Admin' },
    });
    expect(
      await prisma.auditLog.findFirstOrThrow({
        where: { entityId: change.body.id },
      }),
    ).toMatchObject({ employeeId, reason: 'Temporary suspension' });
  });

  it('rejects empty reasons, unchanged statuses and out-of-order dates', async () => {
    await r.admin
      .post(changes())
      .send({
        toStatus: 'terminated',
        effectiveDate: '2026-03-01',
        reason: ' ',
      })
      .expect(400);
    await r.admin
      .post(changes())
      .send({
        toStatus: 'suspended',
        effectiveDate: '2026-03-01',
        reason: 'No change',
      })
      .expect(400);
    await r.admin
      .post(changes())
      .send({
        toStatus: 'active',
        effectiveDate: '2026-02-01',
        reason: 'Same day',
      })
      .expect(409);
    await r.admin
      .post(changes())
      .send({
        toStatus: 'active',
        effectiveDate: '2025-12-31',
        reason: 'Before hire',
      })
      .expect(400);
    expect((await r.admin.get(history()).expect(200)).body.items).toHaveLength(
      2,
    );
  });

  it('enforces authentication, roles, employee-own reads and company isolation', async () => {
    await r.anonymous().get(history()).expect(401);
    await r.employee
      .post(changes())
      .send({
        toStatus: 'active',
        effectiveDate: '2026-03-01',
        reason: 'Unauthorized',
      })
      .expect(403);
    await r.employee.get(history()).expect(403);
    await r.employee
      .get(`/employees/${r.ownEmployeeId}/status-history`)
      .expect(200);
    await r.interviewer.get(history()).expect(403);
    await other.admin.get(history()).expect(404);
    await other.admin
      .post(changes())
      .send({
        toStatus: 'active',
        effectiveDate: '2026-03-01',
        reason: 'Foreign company',
      })
      .expect(404);
  });

  it('keeps future changes scheduled and applies them once due, safely on repeat', async () => {
    await r.admin
      .post(changes())
      .send({
        toStatus: 'terminated',
        effectiveDate: '2099-01-01',
        reason: 'Scheduled departure',
      })
      .expect(201);
    expect(
      (await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }))
        .status,
    ).toBe('suspended');
    const clock = vi
      .spyOn(companyTime, 'todayIn')
      .mockReturnValue('2099-01-01');
    try {
      const statuses = app.get(EmployeeStatusService);
      await runInCompany(r.companyId, () => statuses.refreshCurrent());
      await runInCompany(r.companyId, () => statuses.refreshCurrent());
      expect(
        await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
      ).toMatchObject({
        status: 'terminated',
        terminationDate: new Date('2099-01-01T00:00:00Z'),
      });
      expect(
        await prisma.employeeStatusHistory.count({ where: { employeeId } }),
      ).toBe(3);
    } finally {
      clock.mockRestore();
    }
  });
});
