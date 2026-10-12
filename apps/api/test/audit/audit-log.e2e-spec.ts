// SCRUM-163 (FR-DB-4, NFR-8): GET /audit-log shows the company's audit rows to Admins only,
// newest first, with who made each change and the employee it is about; filters by employee,
// record type and dates (days in the company's time zone); no route can change a row; a
// company never sees another company's rows. Needs the local database: pnpm db:up
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import type {
  AuditAction,
  AuditEntity,
} from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Audit log viewer (SCRUM-163)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let adminId: string;

  /** One audit row for company r, written directly (the writer itself is tested in audit.e2e-spec) */
  const addRow = (row: {
    entityType: AuditEntity;
    action?: AuditAction;
    createdAt: string;
    employeeId?: string;
    companyId?: string;
  }) =>
    prisma.auditLog.create({
      data: {
        companyId: row.companyId ?? r.companyId,
        userId: row.companyId ? null : adminId,
        entityType: row.entityType,
        entityId: randomUUID(),
        action: row.action ?? 'update',
        before: { value: 'old' },
        after: { value: 'new' },
        employeeId: row.employeeId,
        createdAt: new Date(row.createdAt),
      },
    });

  let salaryOwn: string; // salary change of r's own employee, Oct 12 00:30 Cairo
  let statusOther: string; // status change of the other employee, Oct 11 23:30 Cairo
  let settings: string; // company settings change, Oct 10 12:00 Cairo
  let userRow: string; // user change, Oct 9 12:00 Cairo

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    r = await setupRoleBrowsers(app);
    other = await setupRoleBrowsers(app);

    adminId = (
      await prisma.user.findFirstOrThrow({
        where: { companyId: r.companyId, role: 'admin' },
      })
    ).id;

    // Cairo is UTC+3 in October 2026, so 21:30 UTC on Oct 11 is already Oct 12 in Cairo
    salaryOwn = (
      await addRow({
        entityType: 'salary',
        createdAt: '2026-10-11T21:30:00Z',
        employeeId: r.ownEmployeeId,
      })
    ).id;
    statusOther = (
      await addRow({
        entityType: 'employee_status',
        createdAt: '2026-10-11T20:30:00Z',
        employeeId: r.otherEmployeeId,
      })
    ).id;
    settings = (
      await addRow({
        entityType: 'company_settings',
        createdAt: '2026-10-10T09:00:00Z',
      })
    ).id;
    userRow = (
      await addRow({
        entityType: 'user',
        action: 'create',
        createdAt: '2026-10-09T09:00:00Z',
      })
    ).id;
    // A row of another company, at the newest moment of all
    await addRow({
      entityType: 'salary',
      createdAt: '2026-10-12T08:00:00Z',
      companyId: other.companyId,
    });
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  const ids = (body: { items: { id: string }[] }) =>
    body.items.map((item) => item.id);

  describe('who may see it', () => {
    it('needs a login (401)', async () => {
      await r.anonymous().get('/audit-log').expect(401);
    });

    it('is Admin only (403 for Employee and Interviewer)', async () => {
      await r.employee.get('/audit-log').expect(403);
      await r.interviewer.get('/audit-log').expect(403);
    });

    it('has no route that changes a row', async () => {
      await r.admin.post('/audit-log').send({}).expect(404);
      await r.admin.patch(`/audit-log/${salaryOwn}`).send({}).expect(404);
      await r.admin.delete(`/audit-log/${salaryOwn}`).expect(404);
    });
  });

  describe('the list', () => {
    it("shows this company's rows newest first, never another company's", async () => {
      const res = await r.admin.get('/audit-log').expect(200);
      expect(ids(res.body)).toEqual([
        salaryOwn,
        statusOther,
        settings,
        userRow,
      ]);
      expect(res.body).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    });

    it('shows who made the change, the employee, and the values before and after', async () => {
      const res = await r.admin.get('/audit-log').expect(200);
      expect(res.body.items[0]).toMatchObject({
        id: salaryOwn,
        createdAt: '2026-10-11T21:30:00.000Z',
        entityType: 'salary',
        action: 'update',
        before: { value: 'old' },
        after: { value: 'new' },
        reason: null,
        user: { id: adminId, name: 'Role Admin' },
        employee: { id: r.ownEmployeeId, code: 'R-001' },
      });
      // A change that is not about an employee
      expect(res.body.items[2]).toMatchObject({
        id: settings,
        employee: null,
        subjectUser: null,
      });
    });

    it('splits the list into pages', async () => {
      const res = await r.admin.get('/audit-log?page=2&pageSize=2').expect(200);
      expect(ids(res.body)).toEqual([settings, userRow]);
      expect(res.body).toMatchObject({ total: 4, page: 2, pageSize: 2 });
    });
  });

  describe('filters', () => {
    it('by employee', async () => {
      const res = await r.admin
        .get(`/audit-log?employeeId=${r.ownEmployeeId}`)
        .expect(200);
      expect(ids(res.body)).toEqual([salaryOwn]);
      expect(res.body.total).toBe(1);
    });

    it("finds nothing for another company's employee", async () => {
      const res = await r.admin
        .get(`/audit-log?employeeId=${other.ownEmployeeId}`)
        .expect(200);
      expect(res.body).toMatchObject({ items: [], total: 0 });
    });

    it('by one or more record types', async () => {
      const one = await r.admin.get('/audit-log?type=user').expect(200);
      expect(ids(one.body)).toEqual([userRow]);

      const two = await r.admin
        .get('/audit-log?type=salary,company_settings')
        .expect(200);
      expect(ids(two.body)).toEqual([salaryOwn, settings]);
    });

    it('by days in the company time zone (Cairo), both days included', async () => {
      // Oct 12 in Cairo = from 2026-10-11T21:00Z: only the 21:30Z row
      const oct12 = await r.admin
        .get('/audit-log?from=2026-10-12&to=2026-10-12')
        .expect(200);
      expect(ids(oct12.body)).toEqual([salaryOwn]);

      // Oct 10 to Oct 11 in Cairo
      const range = await r.admin
        .get('/audit-log?from=2026-10-10&to=2026-10-11')
        .expect(200);
      expect(ids(range.body)).toEqual([statusOther, settings]);

      // Only "to"
      const until = await r.admin.get('/audit-log?to=2026-10-09').expect(200);
      expect(ids(until.body)).toEqual([userRow]);
    });

    it('combines filters', async () => {
      const res = await r.admin
        .get(
          `/audit-log?employeeId=${r.otherEmployeeId}&type=employee_status&from=2026-10-11`,
        )
        .expect(200);
      expect(ids(res.body)).toEqual([statusOther]);
    });
  });

  describe('bad queries (400)', () => {
    it.each([
      ['an unknown type', 'type=salaryx'],
      ['an employee id that is not a uuid', 'employeeId=123'],
      ['a date that is not a day', 'from=12-10-2026'],
      ['"from" after "to"', 'from=2026-10-12&to=2026-10-11'],
      ['a page size over 100', 'pageSize=500'],
      ['page 0', 'page=0'],
    ])('refuses %s', async (_label, query) => {
      await r.admin.get(`/audit-log?${query}`).expect(400);
    });
  });

  // Last, because it adds a row that the counts above don't expect
  describe('changes to a login', () => {
    it('names whose login a user change was about', async () => {
      const admin = await prisma.user.findUniqueOrThrow({
        where: { id: adminId },
      });
      const row = await prisma.auditLog.create({
        data: {
          companyId: r.companyId,
          userId: adminId,
          entityType: 'user',
          entityId: adminId,
          action: 'update',
          before: { role: 'employee' },
          after: { role: 'admin' },
          createdAt: new Date('2026-10-01T09:00:00Z'),
        },
      });
      const res = await r.admin.get('/audit-log?to=2026-10-01').expect(200);
      expect(res.body.items).toEqual([
        expect.objectContaining({
          id: row.id,
          subjectUser: { name: admin.name, email: admin.email },
        }),
      ]);
    });
  });
});
