// D-77 (SCRUM-34 groundwork, FR-UA-1, FR-UA-2): "Give app access" on an employee creates an
// Employee login connected to that record, with the usual 7-day invite link. One login per
// employee; never for someone who left; another company's employee is not found.
// Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Give an employee app access (D-77)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  const run = Date.now();

  /** A new employee of company r, through the API */
  const addEmployee = async (extra: Record<string, string> = {}) =>
    (
      await r.admin
        .post('/employees')
        .send({
          nameAr: 'منى علي',
          nameEn: 'Mona Ali',
          employmentType: 'full_time',
          hireDate: '2026-10-01',
          ...extra,
        })
        .expect(201)
    ).body as { id: string; code: string };

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
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  it('needs a login and is Admin only', async () => {
    const mona = await addEmployee({ email: `mona-${run}-a@bakery.test` });
    await r
      .anonymous()
      .post(`/employees/${mona.id}/access`)
      .send({})
      .expect(401);
    await r.employee.post(`/employees/${mona.id}/access`).send({}).expect(403);
    await r.interviewer
      .post(`/employees/${mona.id}/access`)
      .send({})
      .expect(403);
  });

  it("creates an invited Employee login connected to the record, using the employee's email", async () => {
    const mona = await addEmployee({ email: `mona-${run}@bakery.test` });
    const res = await r.admin
      .post(`/employees/${mona.id}/access`)
      .send({ language: 'en' })
      .expect(201);

    expect(res.body.inviteLink).toMatch(/\/en\/set-password\?token=/);
    expect(res.body.user).toMatchObject({
      name: 'Mona Ali',
      email: `mona-${run}@bakery.test`,
      role: 'employee',
      status: 'invited',
    });

    const login = await prisma.user.findUniqueOrThrow({
      where: { id: res.body.user.id },
    });
    expect(login.employeeId).toBe(mona.id);

    // The audit row of the new login is listed under the employee (D-75)
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'user', entityId: login.id },
    });
    expect(audit.employeeId).toBe(mona.id);

    // The list shows that she has been invited
    const list = await r.admin
      .get(`/employees?q=${encodeURIComponent(mona.code)}`)
      .expect(200);
    expect(list.body.items[0].login).toEqual({
      id: login.id,
      status: 'invited',
    });

    // Once only: a second login for the same employee is refused
    const again = await r.admin
      .post(`/employees/${mona.id}/access`)
      .send({})
      .expect(409);
    expect(again.body.message).toBe('employeeHasLogin');
  });

  it('uses the phone given in the dialog, and the Arabic name for an Arabic invite', async () => {
    const omar = await addEmployee({
      nameAr: 'عمر حسن',
      nameEn: 'Omar Hassan',
    });
    const res = await r.admin
      .post(`/employees/${omar.id}/access`)
      .send({ phone: `0109${String(run).slice(-7)}`, language: 'ar' })
      .expect(201);
    expect(res.body.user).toMatchObject({
      name: 'عمر حسن',
      email: null,
      language: 'ar',
    });
    expect(res.body.inviteLink).toMatch(/\/ar\/set-password\?token=/);
    expect(res.body.emailSent).toBe(false);
  });

  it('needs an email or a phone, from the record or the dialog', async () => {
    const sara = await addEmployee({ nameEn: 'Sara Adel' });
    const res = await r.admin
      .post(`/employees/${sara.id}/access`)
      .send({})
      .expect(400);
    expect(res.body.errors).toEqual({ email: 'emailOrPhoneRequired' });
  });

  it('refuses an email that another login already uses (409)', async () => {
    const hana = await addEmployee({ nameEn: 'Hana Fawzy' });
    const taken = await prisma.user.findFirstOrThrow({
      where: { companyId: r.companyId, role: 'admin' },
    });
    const res = await r.admin
      .post(`/employees/${hana.id}/access`)
      .send({ email: taken.email })
      .expect(409);
    expect(res.body.message).toBe('emailTaken');
  });

  it('refuses someone who has left (409)', async () => {
    const karim = await addEmployee({ nameEn: 'Karim Samir' });
    await prisma.employee.update({
      where: { id: karim.id },
      data: { status: 'terminated' },
    });
    const res = await r.admin
      .post(`/employees/${karim.id}/access`)
      .send({ email: `karim-${run}@bakery.test` })
      .expect(409);
    expect(res.body.message).toBe('employeeTerminated');
  });

  it("does not find another company's employee (404)", async () => {
    const theirs = (
      await other.admin
        .post('/employees')
        .send({
          nameAr: 'موظف',
          nameEn: 'Their Person',
          employmentType: 'full_time',
          hireDate: '2026-10-01',
        })
        .expect(201)
    ).body as { id: string };
    await r.admin
      .post(`/employees/${theirs.id}/access`)
      .send({ email: `their-${run}@bakery.test` })
      .expect(404);
  });

  it('refuses a bad email in the dialog (400)', async () => {
    const lina = await addEmployee({ nameEn: 'Lina' });
    const res = await r.admin
      .post(`/employees/${lina.id}/access`)
      .send({ email: 'lina@' })
      .expect(400);
    expect(res.body.errors.email).toBe('emailInvalid');
  });
});
