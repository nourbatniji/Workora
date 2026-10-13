import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { AuditService } from '../../src/common/audit/audit.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Fixed shift assignments (SCRUM-50, FR-SH-1/2)', () => {
  let app: INestApplication<App>,
    prisma: PrismaService,
    r: RoleBrowsers,
    other: RoleBrowsers,
    shiftId: string,
    foreignShift: string;
  const template = {
    name: 'Morning',
    startTime: '09:00',
    endTime: '17:00',
    crossesMidnight: false,
    breakMinutes: 30,
    lateGraceMinutes: 10,
    earlyLeaveGraceMinutes: 5,
    workingDays: [0, 1, 2, 3, 4],
  };
  const path = () => `/employees/${r.ownEmployeeId}/shift-assignments`;
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
    foreignShift = (
      await other.admin.post('/shift-templates').send(template).expect(201)
    ).body.id;
  }, 30000);
  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });
  it('creates a template and audits all fields', async () => {
    const response = await r.admin
      .post('/shift-templates')
      .send(template)
      .expect(201);
    shiftId = response.body.id;
    expect(response.body).toMatchObject(template);
    expect(
      (await r.admin.get('/shift-templates').expect(200)).body.items,
    ).toHaveLength(1);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: shiftId },
    });
    expect(audit.after).toEqual(template);
    await r.admin.post('/shift-templates').send(template).expect(409);
  });
  it('validates times, overnight shifts, break, grace and weekdays', async () => {
    for (const change of [
      { startTime: '25:00' },
      { endTime: '08:00' },
      { breakMinutes: 480 },
      { lateGraceMinutes: 480 },
      { workingDays: [] },
      { workingDays: [1, 1] },
      { workingDays: [7] },
      { crossesMidnight: true },
    ])
      await r.admin
        .post('/shift-templates')
        .send({ ...template, name: 'Invalid', ...change })
        .expect(400);
    await r.admin
      .post('/shift-templates')
      .send({
        ...template,
        name: 'Night',
        startTime: '22:00',
        endTime: '06:00',
        crossesMidnight: true,
      })
      .expect(201);
  });
  it('preserves assignment history and selects the shift valid on a date', async () => {
    const first = await r.admin
      .post(path())
      .send({ shiftTemplateId: shiftId, startDate: '2026-01-01' })
      .expect(201);
    await r.admin
      .post(path())
      .send({ shiftTemplateId: shiftId, startDate: '2099-01-01' })
      .expect(201);
    const history = await r.admin.get(path() + '?date=2026-03-01').expect(200);
    expect(history.body.current.id).toBe(first.body.id);
    expect(history.body.current.shiftTemplate.id).toBe(shiftId);
    expect(history.body.items).toHaveLength(2);
    expect(
      (await r.admin.get(path() + '?date=2025-12-31').expect(200)).body.current,
    ).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: first.body.id },
    });
    expect(audit.employeeId).toBe(r.ownEmployeeId);
    await r.admin
      .patch(`/employees/${r.ownEmployeeId}`)
      .send({ hireDate: '2026-01-02' })
      .expect(400);
  });
  it('enforces roles, tenant isolation and same-company links', async () => {
    await r.employee.get('/shift-templates').expect(403);
    await r.anonymous().get('/shift-templates').expect(401);
    await r.interviewer.post('/shift-templates').send(template).expect(403);
    await r.employee.get(path()).expect(403);
    await r.employee
      .post(path())
      .send({ shiftTemplateId: shiftId, startDate: '2026-02-01' })
      .expect(403);
    await r.admin
      .get(`/employees/${other.ownEmployeeId}/shift-assignments`)
      .expect(404);
    await r.admin
      .post(`/employees/${other.ownEmployeeId}/shift-assignments`)
      .send({ shiftTemplateId: shiftId, startDate: '2026-02-01' })
      .expect(404);
    await r.admin
      .post(path())
      .send({ shiftTemplateId: foreignShift, startDate: '2026-02-01' })
      .expect(400);
    await expect(
      prisma.shiftAssignment.create({
        data: {
          companyId: r.companyId,
          employeeId: r.ownEmployeeId,
          shiftTemplateId: foreignShift,
          startDate: new Date('2026-02-01'),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const mine = await r.admin.get('/shift-templates').expect(200);
    expect(
      mine.body.items.some((row: { id: string }) => row.id === foreignShift),
    ).toBe(false);
  });
  it('refuses dates before hire, malformed dates and concurrent duplicate dates', async () => {
    await r.admin
      .post(path())
      .send({ shiftTemplateId: shiftId, startDate: '2025-12-31' })
      .expect(400);
    await r.admin
      .post(path())
      .send({ shiftTemplateId: shiftId, startDate: '2026-02-30' })
      .expect(400);
    await r.admin.get(path() + '?date=bad').expect(400);
    const responses = await Promise.all([
      r.admin
        .post(path())
        .send({ shiftTemplateId: shiftId, startDate: '2026-02-01' }),
      r.admin
        .post(path())
        .send({ shiftTemplateId: shiftId, startDate: '2026-02-01' }),
    ]);
    expect(responses.map((row) => row.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
  });
  it('rolls back assignment when the audit fails', async () => {
    const spy = vi
      .spyOn(app.get(AuditService), 'record')
      .mockRejectedValueOnce(new Error('test shift audit failure'));
    try {
      await r.admin
        .post(path())
        .send({ shiftTemplateId: shiftId, startDate: '2026-03-01' })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.shiftAssignment.count({
        where: {
          employeeId: r.ownEmployeeId,
          startDate: new Date('2026-03-01'),
        },
      }),
    ).toBe(0);
  });
});
