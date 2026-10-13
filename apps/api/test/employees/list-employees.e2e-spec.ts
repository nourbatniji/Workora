// EM-09 (SCRUM-56, FR-EM-9): GET /employees lists this company's employees for Admins: search by
// name, code, phone or national ID; filter by status, employment type and job title; sort; pages.
// Without a status filter it shows Active and Suspended people only. Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
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

  /** Downloads an export and opens its first sheet */
  const download = async (browser: RoleBrowsers['admin'], query = '') => {
    const res = await browser
      .get(`/employees/export${query}`)
      .buffer(true)
      .parse((stream, done) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    // ExcelJS reads an ArrayBuffer: the bytes of the downloaded Buffer
    const bytes = res.body as Buffer;
    await workbook.xlsx.load(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );
    const sheet = workbook.worksheets[0];
    const values = (n: number) =>
      (sheet.getRow(n).values as unknown[]).slice(1); // ExcelJS rows start at index 1
    return { res, sheet, values };
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

    it('counts each status for the status tabs, with the other filters applied', async () => {
      const all = await r.admin.get('/employees').expect(200);
      expect(all.body.counts).toEqual({
        active: 5,
        suspended: 1,
        terminated: 1,
      });

      // Counts follow search, type and job title, but not the status filter itself
      const partTime = await r.admin
        .get('/employees?employmentType=part_time&status=terminated')
        .expect(200);
      expect(partTime.body.counts).toEqual({
        active: 1,
        suspended: 1,
        terminated: 0,
      });
    });

    it('shows what the table needs, and no national ID', async () => {
      const res = await r.admin.get('/employees').expect(200);
      expect(res.body.items[0]).toEqual({
        id: expect.any(String),
        hasPhoto: false,
        code: 'EMP-0001',
        nameAr: 'منى علي',
        nameEn: 'Mona Ali',
        jobTitle: { id: baker, nameAr: 'خباز', nameEn: 'Baker' },
        employmentType: 'full_time',
        status: 'active',
        hireDate: '2026-01-10',
        phone: '+201012345678',
        email: null,
        login: null,
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

  describe('Excel export', () => {
    it('needs a login and is Admin only', async () => {
      await r.anonymous().get('/employees/export').expect(401);
      await r.employee.get('/employees/export').expect(403);
      await r.interviewer.get('/employees/export').expect(403);
    });

    it('downloads the list as an .xlsx file with the same default rows', async () => {
      const { res, sheet, values } = await download(r.admin);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="employees-\d{4}-\d{2}-\d{2}\.xlsx"$/,
      );
      expect(values(1)).toEqual([
        'Code',
        'Name (Arabic)',
        'Name (English)',
        'Job title',
        'Employment type',
        'Status',
        'Hire date',
        'Phone',
      ]);
      expect(values(2)).toEqual([
        'EMP-0001',
        'منى علي',
        'Mona Ali',
        'Baker',
        'Full time',
        'Active',
        new Date('2026-01-10T00:00:00.000Z'),
        '+201012345678',
      ]);
      // A header row and the 6 people of the default list, never another company's
      expect(sheet.actualRowCount).toBe(7);
    });

    it('applies the filters and the sort', async () => {
      const { sheet, values } = await download(
        r.admin,
        `?jobTitleId=${baker}&sort=-hireDate`,
      );
      expect(sheet.actualRowCount).toBe(3);
      expect(values(2)[0]).toBe('EMP-0003');
      expect(values(3)[0]).toBe('EMP-0001');
    });

    it('writes an Arabic sheet that reads right to left', async () => {
      const { sheet, values } = await download(
        r.admin,
        '?lang=ar&status=terminated',
      );
      expect(sheet.views[0]).toMatchObject({ rightToLeft: true });
      expect(values(1)[0]).toBe('الكود');
      const row = sheet.getRow(2);
      expect(row.getCell(1).value).toBe('EMP-0004');
      expect(row.getCell(2).value).toBe('سارة عادل');
      expect(row.getCell(5).value).toBe('دوام كامل');
      expect(row.getCell(6).value).toBe('منتهية خدمته');
      expect(row.getCell(7).value).toEqual(
        new Date('2025-12-01T00:00:00.000Z'),
      );
      // No job title, no phone: empty cells
      expect(row.getCell(4).value).toBeNull();
      expect(row.getCell(8).value).toBeNull();
    });

    it('refuses a bad query (400)', async () => {
      await r.admin.get('/employees/export?lang=fr').expect(400);
      await r.admin.get('/employees/export?status=fired').expect(400);
    });
  });
});
