// EM-09 (SCRUM-56, FR-EM-9): GET /employees lists this company's employees for Admins: search by
// name, code, phone or national ID; filter by status, employment type and job title; sort; pages.
// Without a status filter it shows Active and Suspended people only. Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Employee list (EM-09, SCRUM-56)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  let baker: string;

  const codes = (body: { items: { code: string }[] }) =>
    body.items.map((item) => item.code);

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

    baker = (
      await prisma.jobTitle.create({
        data: { companyId: r.companyId, nameAr: 'خباز', nameEn: 'Baker' },
      })
    ).id;

    // The test helper already made R-001 and R-002 (Active, full time, hired 2026-01-01).
    // Through the API, so the codes come from the counter:
    const add = async (employee: Record<string, string>) =>
      (await r.admin.post('/employees').send(employee).expect(201)).body as {
        id: string;
      };
    await add({
      nameAr: 'منى علي',
      nameEn: 'Mona Ali',
      employmentType: 'full_time',
      hireDate: '2026-01-10',
      jobTitleId: baker,
      phone: '01012345678',
    }); // EMP-0001
    await add({
      nameAr: 'عمر حسن',
      nameEn: 'Omar Hassan',
      employmentType: 'part_time',
      hireDate: '2026-03-01',
    }); // EMP-0002
    await add({
      nameAr: 'كريم سمير',
      nameEn: 'Karim Samir',
      employmentType: 'trainee',
      hireDate: '2026-02-01',
      jobTitleId: baker,
      nationalId: '29901011234567',
    }); // EMP-0003
    const sara = await add({
      nameAr: 'سارة عادل',
      nameEn: 'Sara Adel',
      employmentType: 'full_time',
      hireDate: '2025-12-01',
    }); // EMP-0004, then Terminated
    const hana = await add({
      nameAr: 'هناء فوزي',
      nameEn: 'Hana Fawzy',
      employmentType: 'part_time',
      hireDate: '2026-04-01',
    }); // EMP-0005, then Suspended
    // Status changes have their own story (EM-07); here they are set directly
    await prisma.employee.update({
      where: { id: sara.id },
      data: { status: 'terminated' },
    });
    await prisma.employee.update({
      where: { id: hana.id },
      data: { status: 'suspended' },
    });

    // Another company's employee, who must never appear
    await other.admin
      .post('/employees')
      .send({
        nameAr: 'منى أخرى',
        nameEn: 'Mona Other',
        employmentType: 'full_time',
        hireDate: '2026-01-01',
      })
      .expect(201);
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  describe('who may see it', () => {
    it('needs a login (401)', async () => {
      await r.anonymous().get('/employees').expect(401);
    });

    it('is Admin only (403 for Employee and Interviewer)', async () => {
      await r.employee.get('/employees').expect(403);
      await r.interviewer.get('/employees').expect(403);
    });
  });

  describe('the list', () => {
    it("shows Active and Suspended people of this company, by code, never another company's", async () => {
      const res = await r.admin.get('/employees').expect(200);
      expect(codes(res.body)).toEqual([
        'EMP-0001',
        'EMP-0002',
        'EMP-0003',
        'EMP-0005',
        'R-001',
        'R-002',
      ]);
      expect(res.body).toMatchObject({ total: 6, page: 1, pageSize: 20 });
    });

    it('shows what the table needs, and no national ID', async () => {
      const res = await r.admin.get('/employees').expect(200);
      expect(res.body.items[0]).toEqual({
        id: expect.any(String),
        code: 'EMP-0001',
        nameAr: 'منى علي',
        nameEn: 'Mona Ali',
        jobTitle: { id: baker, nameAr: 'خباز', nameEn: 'Baker' },
        employmentType: 'full_time',
        status: 'active',
        hireDate: '2026-01-10',
        phone: '+201012345678',
      });
    });

    it('splits the list into pages', async () => {
      const res = await r.admin.get('/employees?page=2&pageSize=2').expect(200);
      expect(codes(res.body)).toEqual(['EMP-0003', 'EMP-0005']);
      expect(res.body).toMatchObject({ total: 6, page: 2, pageSize: 2 });
    });
  });

  describe('filters', () => {
    it('by status, one or several', async () => {
      const left = await r.admin
        .get('/employees?status=terminated')
        .expect(200);
      expect(codes(left.body)).toEqual(['EMP-0004']);

      const all = await r.admin
        .get('/employees?status=active,suspended,terminated')
        .expect(200);
      expect(all.body.total).toBe(7);
    });

    it('by employment type', async () => {
      const trainees = await r.admin
        .get('/employees?employmentType=trainee')
        .expect(200);
      expect(codes(trainees.body)).toEqual(['EMP-0003']);

      const partTime = await r.admin
        .get('/employees?employmentType=part_time')
        .expect(200);
      expect(codes(partTime.body)).toEqual(['EMP-0002', 'EMP-0005']);
    });

    it('by job title', async () => {
      const res = await r.admin
        .get(`/employees?jobTitleId=${baker}`)
        .expect(200);
      expect(codes(res.body)).toEqual(['EMP-0001', 'EMP-0003']);
    });

    it('combines filters', async () => {
      const res = await r.admin
        .get(`/employees?jobTitleId=${baker}&employmentType=trainee`)
        .expect(200);
      expect(codes(res.body)).toEqual(['EMP-0003']);
    });
  });

  describe('search', () => {
    it.each([
      ['an English name, any case', 'mona', ['EMP-0001']],
      ['an Arabic name', 'منى', ['EMP-0001']],
      ['part of a code', 'emp-0002', ['EMP-0002']],
      ['a phone as people type it', '0101 234', ['EMP-0001']],
      ['part of a national ID', '2990101', ['EMP-0003']],
    ])('finds by %s', async (_label, q, expected) => {
      const res = await r.admin
        .get(`/employees?q=${encodeURIComponent(q)}`)
        .expect(200);
      expect(codes(res.body)).toEqual(expected);
    });

    it("never finds another company's employee", async () => {
      const res = await r.admin.get('/employees?q=Other').expect(200);
      expect(res.body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('sort', () => {
    it('by hire date, newest first, code breaking ties', async () => {
      const res = await r.admin.get('/employees?sort=-hireDate').expect(200);
      expect(codes(res.body)).toEqual([
        'EMP-0005',
        'EMP-0002',
        'EMP-0003',
        'EMP-0001',
        'R-001',
        'R-002',
      ]);
    });

    it('by English name', async () => {
      const res = await r.admin.get('/employees?sort=nameEn').expect(200);
      expect(codes(res.body)).toEqual([
        'R-001',
        'R-002',
        'EMP-0005',
        'EMP-0003',
        'EMP-0001',
        'EMP-0002',
      ]);
    });
  });

  describe('bad queries (400)', () => {
    it.each([
      ['an unknown status', 'status=fired'],
      ['an unknown employment type', 'employmentType=freelance'],
      ['a job title id that is not a uuid', 'jobTitleId=abc'],
      ['a sort the list does not allow', 'sort=salary'],
      ['a page size over 100', 'pageSize=500'],
    ])('refuses %s', async (_label, query) => {
      await r.admin.get(`/employees?${query}`).expect(400);
    });
  });
});
