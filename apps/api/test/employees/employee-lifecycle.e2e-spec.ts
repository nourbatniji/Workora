import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { EmployeeStatusService } from '../../src/employees/employee-status.service.js';
import { AuditService } from '../../src/common/audit/audit.service.js';
import { runInCompany } from '../../src/common/tenancy/tenant-context.js';
import { TenantPrismaService } from '../../src/prisma/tenant-prisma.service.js';
import * as companyTime from '../../src/company/company-settings.service.js';
import { hashInviteToken } from '../../src/auth/invite-token.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Termination access and safe employee removal (SCRUM-54)', () => {
  let app: INestApplication<App>,
    prisma: PrismaService,
    r: RoleBrowsers,
    other: RoleBrowsers;
  const add = async () => {
    const res = await r.admin
      .post('/employees')
      .send({
        nameAr: 'موظف تجريبي',
        nameEn: 'Lifecycle Employee',
        employmentType: 'full_time',
        hireDate: '2026-01-01',
      })
      .expect(201);
    return res.body as { id: string; code: string };
  };
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
    vi.restoreAllMocks();
    await app.close();
    await prisma.contract.deleteMany({ where: { companyId: r.companyId } });
    await prisma.document.deleteMany({ where: { companyId: r.companyId } });
    await r.cleanup();
    await other.cleanup();
  });

  it('removes a mistaken employee from reads and counts while retaining immutable audit history', async () => {
    const person = await add();
    await r.admin.delete(`/employees/${person.id}`).expect(204);
    await r.admin.get(`/employees/${person.code}`).expect(404);
    await r.admin
      .patch(`/employees/${person.id}`)
      .send({ nameEn: 'Return' })
      .expect(404);
    await r.admin.get(`/employees/${person.id}/status-history`).expect(404);
    await r.admin
      .post(`/employees/${person.id}/salary-history`)
      .send({ baseSalary: '100', effectiveFrom: '2026-02-01' })
      .expect(404);
    await r.admin
      .post(`/employees/${person.id}/access`)
      .send({ email: 'removed@lifecycle.test', language: 'en' })
      .expect(404);
    const list = await r.admin
      .get(`/employees?q=${person.code}&status=active,suspended,terminated`)
      .expect(200);
    expect(list.body.items).toHaveLength(0);
    expect(
      (await prisma.employee.findUniqueOrThrow({ where: { id: person.id } }))
        .deletedAt,
    ).not.toBeNull();
    expect(
      await prisma.auditLog.findFirstOrThrow({
        where: { employeeId: person.id, action: 'delete' },
      }),
    ).toMatchObject({ entityType: 'employee', entityId: person.id });
    await r.admin.delete(`/employees/${person.id}`).expect(404);
    const next = await add();
    expect(next.code).not.toBe(person.code);
    const scoped = app.get(TenantPrismaService);
    await runInCompany(r.companyId, async () => {
      expect(await scoped.db.employee.count({ where: { id: person.id } })).toBe(
        0,
      );
      expect(
        await scoped.db.employee.findFirst({
          where: { id: person.id, deletedAt: { not: null } },
        }),
      ).toBeNull();
    });
  });

  it('refuses removal with salary, shift, contract, document, photo, login or later status records', async () => {
    for (const kind of [
      'salary',
      'shift',
      'contract',
      'document',
      'photo',
      'login',
      'status',
    ]) {
      const person = await add();
      if (kind === 'salary')
        await prisma.salaryHistory.create({
          data: {
            companyId: r.companyId,
            employeeId: person.id,
            baseSalary: '100',
            effectiveFrom: new Date('2026-01-01'),
          },
        });
      if (kind === 'contract')
        await prisma.contract.create({
          data: {
            companyId: r.companyId,
            employeeId: person.id,
            type: 'indefinite',
            startDate: new Date('2026-01-01'),
            fileKey: 'test/contract',
          },
        });
      if (kind === 'document')
        await prisma.document.create({
          data: {
            companyId: r.companyId,
            employeeId: person.id,
            docType: 'Test',
            fileKey: 'test/document',
          },
        });
      if (kind === 'photo')
        await prisma.employee.update({
          where: { id: person.id },
          data: { photo: 'test/photo' },
        });
      if (kind === 'login')
        await prisma.user.create({
          data: {
            companyId: r.companyId,
            employeeId: person.id,
            role: 'employee',
            status: 'invited',
          },
        });
      if (kind === 'status')
        await r.admin
          .post(`/employees/${person.id}/status-changes`)
          .send({
            toStatus: 'suspended',
            effectiveDate: '2026-02-01',
            reason: 'Test',
          })
          .expect(201);
      if (kind === 'shift') {
        const template = await prisma.shiftTemplate.create({
          data: {
            companyId: r.companyId,
            name: `Delete guard ${person.id}`,
            startTime: '09:00',
            endTime: '17:00',
            crossesMidnight: false,
            breakMinutes: 0,
            lateGraceMinutes: 0,
            earlyLeaveGraceMinutes: 0,
            workingDays: [0, 1, 2, 3, 4],
          },
        });
        await prisma.shiftAssignment.create({
          data: {
            companyId: r.companyId,
            employeeId: person.id,
            shiftTemplateId: template.id,
            startDate: new Date('2026-01-01'),
          },
        });
      }
      const res = await r.admin.delete(`/employees/${person.id}`).expect(409);
      expect(res.body.message).toBe('employeeHasRecords');
      expect(
        (await prisma.employee.findUniqueOrThrow({ where: { id: person.id } }))
          .deletedAt,
      ).toBeNull();
    }
  });

  it('enforces permissions and rolls back removal when its audit fails', async () => {
    const person = await add();
    await r.anonymous().delete(`/employees/${person.id}`).expect(401);
    await r.employee.delete(`/employees/${person.id}`).expect(403);
    await r.interviewer.delete(`/employees/${person.id}`).expect(403);
    await other.admin.delete(`/employees/${person.id}`).expect(404);
    const audit = vi
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('Test removal audit failure'));
    try {
      await r.admin.delete(`/employees/${person.id}`).expect(500);
    } finally {
      audit.mockRestore();
    }
    await r.admin.get(`/employees/${person.code}`).expect(200);
    expect(
      (await prisma.employee.findUniqueOrThrow({ where: { id: person.id } }))
        .deletedAt,
    ).toBeNull();
  });

  it('keeps suspended accounts usable, terminates existing sessions and clears invite links atomically', async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { employeeId: r.ownEmployeeId },
    });
    const path = `/employees/${r.ownEmployeeId}/status-changes`;
    await r.admin
      .post(path)
      .send({
        toStatus: 'suspended',
        effectiveDate: '2026-02-01',
        reason: 'Suspended',
      })
      .expect(201);
    await r.employee.get('/auth/me').expect(200);
    await r.employee
      .post('/auth/login')
      .send({ identifier: user.email, password: 'role-pass1' })
      .expect(200);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        inviteToken: hashInviteToken('termination-test-link'),
        inviteExpiresAt: new Date('2099-01-01'),
      },
    });
    await r.admin
      .post(path)
      .send({
        toStatus: 'terminated',
        effectiveDate: '2026-03-01',
        reason: 'Departure',
      })
      .expect(201);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({
      status: 'deactivated',
      inviteToken: null,
      inviteExpiresAt: null,
    });
    expect(
      await prisma.session.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.employee.findUniqueOrThrow({
        where: { id: r.ownEmployeeId },
      }),
    ).toMatchObject({ terminationReason: 'Departure' });
    await r.employee.get('/auth/me').expect(401);
    await r
      .anonymous()
      .post('/auth/login')
      .send({ identifier: user.email, password: 'role-pass1' })
      .expect(403);
    await r.anonymous().get('/auth/invites/termination-test-link').expect(404);
    await r.admin.post(`/users/${user.id}/activate`).expect(409);
    await r.admin
      .post(path)
      .send({
        toStatus: 'active',
        effectiveDate: '2026-03-02',
        reason: 'Rehired',
      })
      .expect(201);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe('deactivated');
    await r.admin.post(`/users/${user.id}/activate`).expect(200);
    await r.employee
      .post('/auth/login')
      .send({ identifier: user.email, password: 'role-pass1' })
      .expect(200);
  });

  it('enforces a future termination at the next authenticated request, even before the worker runs', async () => {
    const user = await prisma.user.findFirstOrThrow({
      where: { employeeId: r.ownEmployeeId },
    });
    await r.admin
      .post(`/employees/${r.ownEmployeeId}/status-changes`)
      .send({
        toStatus: 'terminated',
        effectiveDate: '2099-01-01',
        reason: 'Future departure',
      })
      .expect(201);
    await r.employee.get('/auth/me').expect(200);
    const clock = vi
      .spyOn(companyTime, 'todayIn')
      .mockReturnValue('2099-01-01');
    try {
      await r.employee.get('/auth/me').expect(401);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .status,
      ).toBe('deactivated');
      expect(
        await prisma.session.count({
          where: { userId: user.id, revokedAt: null },
        }),
      ).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });
  it('blocks a new login when a scheduled termination becomes due before any worker tick', async () => {
    const person = await add();
    const source = await prisma.user.findFirstOrThrow({
      where: { employeeId: r.ownEmployeeId },
    });
    const user = await prisma.user.create({
      data: {
        companyId: r.companyId,
        employeeId: person.id,
        role: 'employee',
        status: 'active',
        email: `${person.id}@lifecycle.test`,
        passwordHash: source.passwordHash,
      },
    });
    await r.admin
      .post(`/employees/${person.id}/status-changes`)
      .send({
        toStatus: 'terminated',
        effectiveDate: '2099-01-01',
        reason: 'Scheduled departure',
      })
      .expect(201);
    await r
      .anonymous()
      .post('/auth/login')
      .send({ identifier: user.email, password: 'role-pass1' })
      .expect(200);
    const clock = vi
      .spyOn(companyTime, 'todayIn')
      .mockReturnValue('2099-01-01');
    try {
      await r
        .anonymous()
        .post('/auth/login')
        .send({ identifier: user.email, password: 'role-pass1' })
        .expect(403);
    } finally {
      clock.mockRestore();
    }
  });

  it('applies scheduled invite deactivation without a login and never duplicates the audit entry', async () => {
    const person = await add();
    const user = await prisma.user.create({
      data: {
        companyId: r.companyId,
        employeeId: person.id,
        role: 'employee',
        status: 'invited',
        inviteToken: hashInviteToken(`scheduled-${person.id}`),
        inviteExpiresAt: new Date('2099-02-01'),
      },
    });
    await r.admin
      .post(`/employees/${person.id}/status-changes`)
      .send({
        toStatus: 'terminated',
        effectiveDate: '2099-01-01',
        reason: 'Offer cancelled',
      })
      .expect(201);
    const clock = vi
      .spyOn(companyTime, 'todayIn')
      .mockReturnValue('2099-01-01');
    try {
      const statuses = app.get(EmployeeStatusService);
      await runInCompany(r.companyId, () => statuses.refreshCurrent(person.id));
      await runInCompany(r.companyId, () => statuses.refreshCurrent(person.id));
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).toMatchObject({ status: 'deactivated', inviteToken: null });
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: 'user',
            entityId: user.id,
            reason: 'Employment terminated',
          },
        }),
      ).toBe(1);
    } finally {
      clock.mockRestore();
    }
  });

  it('protects the last active Admin and rolls back the employment change', async () => {
    const person = await add();
    const admin = await prisma.user.findFirstOrThrow({
      where: { companyId: r.companyId, role: 'admin' },
    });
    await prisma.user.update({
      where: { id: admin.id },
      data: { employeeId: person.id },
    });
    try {
      const result = await r.admin
        .post(`/employees/${person.id}/status-changes`)
        .send({
          toStatus: 'terminated',
          effectiveDate: '2026-02-01',
          reason: 'Leaving',
        })
        .expect(409);
      expect(result.body.message).toBe('lastActiveAdmin');
      expect(
        (await prisma.employee.findUniqueOrThrow({ where: { id: person.id } }))
          .status,
      ).toBe('active');
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: admin.id } }))
          .status,
      ).toBe('active');
    } finally {
      await prisma.user.update({
        where: { id: admin.id },
        data: { employeeId: null },
      });
    }
  });
});
