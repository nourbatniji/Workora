// EM-01 (SCRUM-48, FR-EM-1 to FR-EM-3): the Admin creates an employee; the system assigns the code
// EMP-0001, EMP-0002… per company, never reused (D-76); the first status history line and the
// audit row (with the right employee, D-75) are saved with it; the 50-employee limit (A-15);
// one national ID per company; another company's job title is refused (D-48).
// Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Create an employee (EM-01, SCRUM-48)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let full: RoleBrowsers; // a company at the 50-employee limit
  let bakerTitle: string; // r's job title
  let otherTitle: string; // other's job title

  /** Mona, with only what the form requires */
  const mona = {
    nameAr: 'منى علي',
    nameEn: 'Mona Ali',
    employmentType: 'full_time',
    hireDate: '2026-10-01',
  };

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
    full = await setupRoleBrowsers(app);

    bakerTitle = (
      await prisma.jobTitle.create({
        data: { companyId: r.companyId, nameAr: 'خباز', nameEn: 'Baker' },
      })
    ).id;
    otherTitle = (
      await prisma.jobTitle.create({
        data: {
          companyId: other.companyId,
          nameAr: 'كاشير',
          nameEn: 'Cashier',
        },
      })
    ).id;

    // "full" already has 2 employees (R-001, R-002): add 48 more, so it holds 50
    await prisma.employee.createMany({
      data: Array.from({ length: 48 }, (_, i) => ({
        companyId: full.companyId,
        code: `F-${String(i + 1).padStart(3, '0')}`,
        nameAr: 'موظف',
        nameEn: `Filler ${i + 1}`,
        employmentType: 'full_time' as const,
        hireDate: new Date('2026-01-01T00:00:00Z'),
      })),
    });
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await full.cleanup();
    await app.close();
  });

  describe('who may create', () => {
    it('needs a login (401)', async () => {
      await r.anonymous().post('/employees').send(mona).expect(401);
    });

    it('is Admin only (403 for Employee and Interviewer)', async () => {
      await r.employee.post('/employees').send(mona).expect(403);
      await r.interviewer.post('/employees').send(mona).expect(403);
    });
  });

  describe('the code', () => {
    let first: string;

    it('gives the first one EMP-0001, Active, with only the required fields', async () => {
      // r already holds R-001 and R-002 made by the test helper: the code comes from the
      // company's counter, not from counting employees (count + 1 would say EMP-0003)
      const res = await r.admin.post('/employees').send(mona).expect(201);
      first = res.body.id;
      expect(res.body).toMatchObject({
        code: 'EMP-0001',
        nameAr: 'منى علي',
        nameEn: 'Mona Ali',
        employmentType: 'full_time',
        hireDate: '2026-10-01',
        status: 'active',
        jobTitle: null,
        nationalId: null,
        probationEnd: null,
      });
      expect(res.body).not.toHaveProperty('hasDisability');
    });

    it('gives the next one EMP-0002', async () => {
      const res = await r.admin
        .post('/employees')
        .send({ ...mona, nameEn: 'Omar Hassan', nameAr: 'عمر حسن' })
        .expect(201);
      expect(res.body.code).toBe('EMP-0002');
    });

    it('never reuses a code, even after an employee is deleted', async () => {
      // Delete EMP-0002 the way the delete feature will (FR-EM-11: no records yet). Its status
      // line and audit row go too; test-only, the audit log refuses DELETE in the app (NFR-8)
      const second = await prisma.employee.findFirstOrThrow({
        where: { companyId: r.companyId, code: 'EMP-0002' },
      });
      await prisma.$transaction([
        prisma.$executeRawUnsafe(
          'SET LOCAL session_replication_role = replica',
        ),
        prisma.auditLog.deleteMany({ where: { employeeId: second.id } }),
        prisma.employeeStatusHistory.deleteMany({
          where: { employeeId: second.id },
        }),
        prisma.employee.delete({ where: { id: second.id } }),
      ]);

      const res = await r.admin
        .post('/employees')
        .send({ ...mona, nameEn: 'Sara Adel', nameAr: 'سارة عادل' })
        .expect(201);
      expect(res.body.code).toBe('EMP-0003');
    });

    it('counts separately for each company', async () => {
      const res = await other.admin.post('/employees').send(mona).expect(201);
      expect(res.body.code).toBe('EMP-0001');
    });

    it('saves the first status line and an audit row that names this employee (D-75)', async () => {
      const status = await prisma.employeeStatusHistory.findMany({
        where: { employeeId: first },
      });
      expect(status).toEqual([
        expect.objectContaining({
          companyId: r.companyId,
          fromStatus: null,
          toStatus: 'active',
          effectiveDate: new Date('2026-10-01T00:00:00Z'),
        }),
      ]);

      const audit = await prisma.auditLog.findMany({
        where: { employeeId: first },
      });
      expect(audit).toEqual([
        expect.objectContaining({
          companyId: r.companyId,
          entityType: 'employee_status',
          entityId: status[0].id,
          action: 'create',
          after: {
            code: 'EMP-0001',
            status: 'active',
            effectiveDate: '2026-10-01',
          },
        }),
      ]);
    });
  });

  describe('the data', () => {
    it('saves every optional field, cleaned', async () => {
      const res = await r.admin
        .post('/employees')
        .send({
          nameAr: ' كريم سمير ',
          nameEn: ' Karim Samir ',
          employmentType: 'trainee',
          hireDate: '2026-09-01',
          jobTitleId: bakerTitle,
          probationEnd: '2026-12-01',
          trainingEnd: '2027-03-01',
          nationalId: '2990101 0123456',
          birthDate: '1999-01-01',
          gender: 'male',
          phone: '010 1234 5678',
          email: ' Karim@Bakery.EG ',
          address: '12 Tahrir St, Cairo',
          emergencyName: 'Samir',
          emergencyPhone: '01112345678',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        nameAr: 'كريم سمير',
        nameEn: 'Karim Samir',
        employmentType: 'trainee',
        jobTitle: { id: bakerTitle, nameEn: 'Baker' },
        probationEnd: '2026-12-01',
        trainingEnd: '2027-03-01',
        nationalId: '29901010123456',
        birthDate: '1999-01-01',
        gender: 'male',
        phone: '+201012345678',
        email: 'karim@bakery.eg',
        emergencyPhone: '+201112345678',
      });
    });

    it('treats empty boxes as not given', async () => {
      const res = await r.admin
        .post('/employees')
        .send({
          ...mona,
          nameEn: 'Hana',
          nationalId: '',
          phone: ' ',
          email: '',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        nationalId: null,
        phone: null,
        email: null,
      });
    });

    it('refuses a national ID already used in the company (409)', async () => {
      const res = await r.admin
        .post('/employees')
        .send({ ...mona, nationalId: '29901010123456' })
        .expect(409);
      expect(res.body).toEqual({
        message: 'nationalIdTaken',
        errors: { nationalId: 'nationalIdTaken' },
      });
    });

    it('allows the same national ID in another company', async () => {
      await other.admin
        .post('/employees')
        .send({ ...mona, nationalId: '29901010123456' })
        .expect(201);
    });

    it("refuses another company's job title (D-48)", async () => {
      const before = await prisma.company.findUniqueOrThrow({
        where: { id: r.companyId },
      });
      const res = await r.admin
        .post('/employees')
        .send({ ...mona, jobTitleId: otherTitle })
        .expect(400);
      expect(res.body.message).toBe('invalidReference');

      // Nothing was saved, not even the code number
      const after = await prisma.company.findUniqueOrThrow({
        where: { id: r.companyId },
      });
      expect(after.nextEmployeeNumber).toBe(before.nextEmployeeNumber);
    });

    it.each([
      ['no Arabic name', { nameAr: '' }, 'nameAr', 'required'],
      [
        'an unknown employment type',
        { employmentType: 'freelance' },
        'employmentType',
        'employmentTypeInvalid',
      ],
      [
        'a hire date that is not a day',
        { hireDate: '01/10/2026' },
        'hireDate',
        'dateInvalid',
      ],
      [
        'a national ID that is not 14 digits',
        { nationalId: '1234' },
        'nationalId',
        'nationalIdInvalid',
      ],
      [
        'a probation end before the hire date',
        { probationEnd: '2026-09-30' },
        'probationEnd',
        'dateBeforeHire',
      ],
      [
        'a training end for someone who is not a trainee',
        { trainingEnd: '2027-01-01' },
        'trainingEnd',
        'trainingEndTraineesOnly',
      ],
      ['a bad phone', { phone: '123' }, 'phone', 'phoneInvalid'],
      ['a bad email', { email: 'mona@' }, 'email', 'emailInvalid'],
    ])('refuses %s (400)', async (_label, change, field, key) => {
      const res = await r.admin
        .post('/employees')
        .send({ ...mona, ...change })
        .expect(400);
      expect(res.body.errors[field]).toBe(key);
    });
  });

  describe('the 50-employee limit (A-15)', () => {
    it('refuses employee 51 and keeps the code number', async () => {
      const res = await full.admin.post('/employees').send(mona).expect(409);
      expect(res.body.message).toBe('employeeLimitReached');
    });

    it('does not count Terminated employees', async () => {
      await prisma.employee.updateMany({
        where: { companyId: full.companyId, code: 'F-001' },
        data: { status: 'terminated' },
      });
      const res = await full.admin.post('/employees').send(mona).expect(201);
      // The refused attempt above did not use up a number
      expect(res.body.code).toBe('EMP-0001');
    });

    it('counts Suspended employees', async () => {
      await prisma.employee.updateMany({
        where: { companyId: full.companyId, code: 'F-002' },
        data: { status: 'suspended' },
      });
      await full.admin.post('/employees').send(mona).expect(409);
    });
  });
});
