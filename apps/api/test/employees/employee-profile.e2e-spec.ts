// EM-02 (SCRUM-49, FR-EM-2) and the profile read (EM-08): GET /employees/:key (id or code) and
// PATCH /employees/:id for personal data. Admin only; only what is sent changes; the audit row
// keeps only the changed fields (D-78); one national ID per company (D-76); the disability field
// only when the company follows the Labor Law (D-04). Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Employee profile and personal data (EM-02, SCRUM-49)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let mona: { id: string; code: string };
  let omar: { id: string; code: string };
  let theirs: { id: string; code: string };

  const add = async (browser: RoleBrowsers, extra: Record<string, string>) =>
    (
      await browser.admin
        .post('/employees')
        .send({
          nameAr: 'موظف',
          nameEn: 'Someone',
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

    mona = await add(r, {
      nameAr: 'منى علي',
      nameEn: 'Mona Ali',
      email: 'mona@bakery.test',
      nationalId: '29901011234567',
    });
    omar = await add(r, { nameAr: 'عمر حسن', nameEn: 'Omar Hassan' });
    theirs = await add(other, { nameEn: 'Their Person' });
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  describe('who may', () => {
    it('needs a login (401)', async () => {
      await r.anonymous().get(`/employees/${mona.id}`).expect(401);
      await r.anonymous().patch(`/employees/${mona.id}`).send({}).expect(401);
    });

    it('is Admin only for now (403); Employees read their own with EM-10', async () => {
      await r.employee.get(`/employees/${mona.id}`).expect(403);
      await r.interviewer.get(`/employees/${mona.id}`).expect(403);
      await r.employee
        .patch(`/employees/${mona.id}`)
        .send({ nameEn: 'X' })
        .expect(403);
    });
  });

  describe('GET /employees/:key', () => {
    it('finds by id and by code (any case), with the full record', async () => {
      const byId = await r.admin.get(`/employees/${mona.id}`).expect(200);
      const byCode = await r.admin
        .get(`/employees/${mona.code.toLowerCase()}`)
        .expect(200);
      expect(byCode.body).toEqual(byId.body);
      expect(byId.body).toMatchObject({
        id: mona.id,
        code: mona.code,
        nameEn: 'Mona Ali',
        email: 'mona@bakery.test',
        nationalId: '29901011234567',
        hireDate: '2026-10-01',
        status: 'active',
        terminationDate: null,
        hasDisability: false,
        lawMode: false,
        login: null,
      });
    });

    it("never finds another company's employee, by id or by code (404)", async () => {
      await r.admin.get(`/employees/${theirs.id}`).expect(404);
      // Codes repeat across companies: EMP-0001 here is ours, not theirs
      const res = await r.admin.get(`/employees/${theirs.code}`).expect(200);
      expect(res.body.id).not.toBe(theirs.id);
    });

    it('answers 404 for an unknown code or a key that cannot be one', async () => {
      await r.admin.get('/employees/EMP-9999').expect(404);
      await r.admin.get('/employees/not%20a%20code!').expect(404);
    });
  });

  describe('PATCH /employees/:id (personal data)', () => {
    it('changes only what is sent, cleaned, and audits only the changed fields', async () => {
      const res = await r.admin
        .patch(`/employees/${mona.id}`)
        .send({
          nameEn: ' Mona A. Ali ',
          nameAr: 'منى علي', // the same as before: not a change
          phone: '010 1234 5678',
          email: '', // an empty box clears it
          birthDate: '1999-01-01',
          gender: 'female',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        nameEn: 'Mona A. Ali',
        nameAr: 'منى علي',
        phone: '+201012345678',
        email: null,
        birthDate: '1999-01-01',
        gender: 'female',
        nationalId: '29901011234567', // not sent: unchanged
      });

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'employee', entityId: mona.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).toMatchObject({
        action: 'update',
        employeeId: mona.id,
        before: {
          nameEn: 'Mona Ali',
          phone: null,
          email: 'mona@bakery.test',
          birthDate: null,
          gender: null,
        },
        after: {
          nameEn: 'Mona A. Ali',
          phone: '+201012345678',
          email: null,
          birthDate: '1999-01-01',
          gender: 'female',
        },
      });
      expect(audit.before).not.toHaveProperty('nameAr');
    });

    it('refuses a save that changes nothing (400)', async () => {
      const res = await r.admin
        .patch(`/employees/${mona.id}`)
        .send({ nameEn: 'Mona A. Ali' })
        .expect(400);
      expect(res.body.message).toBe('nothingToChange');
    });

    it("refuses another employee's national ID (409), keeps one's own", async () => {
      const res = await r.admin
        .patch(`/employees/${omar.id}`)
        .send({ nationalId: '2990101 1234567' })
        .expect(409);
      expect(res.body).toEqual({
        message: 'nationalIdTaken',
        errors: { nationalId: 'nationalIdTaken' },
      });

      // Mona sending her own ID back is "nothing to change", never a clash with herself
      await r.admin
        .patch(`/employees/${mona.id}`)
        .send({ nationalId: '29901011234567' })
        .expect(400);
    });

    it('allows the disability field only when the company follows the Labor Law (D-04)', async () => {
      const refused = await r.admin
        .patch(`/employees/${omar.id}`)
        .send({ hasDisability: true })
        .expect(400);
      expect(refused.body.errors).toEqual({
        hasDisability: 'disabilityNeedsLawMode',
      });

      await prisma.company.update({
        where: { id: r.companyId },
        data: { lawMode: true },
      });
      const saved = await r.admin
        .patch(`/employees/${omar.id}`)
        .send({ hasDisability: true })
        .expect(200);
      expect(saved.body).toMatchObject({ hasDisability: true, lawMode: true });
    });

    it("does not find another company's employee (404)", async () => {
      await r.admin
        .patch(`/employees/${theirs.id}`)
        .send({ nameEn: 'Changed' })
        .expect(404);
      const unchanged = await prisma.employee.findUniqueOrThrow({
        where: { id: theirs.id },
      });
      expect(unchanged.nameEn).toBe('Their Person');
    });

    it.each([
      ['an empty English name', { nameEn: '' }, 'nameEn', 'required'],
      [
        'a national ID that is not 14 digits',
        { nationalId: '123' },
        'nationalId',
        'nationalIdInvalid',
      ],
      ['a bad phone', { phone: '123' }, 'phone', 'phoneInvalid'],
      ['a bad email', { email: 'x@' }, 'email', 'emailInvalid'],
      ['an unknown gender', { gender: 'other' }, 'gender', 'genderInvalid'],
      [
        'a birth date that is not a day',
        { birthDate: '1/1/1999' },
        'birthDate',
        'dateInvalid',
      ],
    ])('refuses %s (400)', async (_label, change, field, key) => {
      const res = await r.admin
        .patch(`/employees/${omar.id}`)
        .send(change)
        .expect(400);
      expect(res.body.errors[field]).toBe(key);
    });
  });
});
