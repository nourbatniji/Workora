// CS-09 (SCRUM-46): the Admin adds, renames and removes job titles. A title employees still
// use can't be removed (D-48). Each company sees only its own list. Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Job titles (CS-09, SCRUM-46)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;

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
    // Employees point at job titles: clear the link before the helpers delete them
    await prisma.employee.updateMany({
      where: { companyId: { in: [r.companyId, other.companyId] } },
      data: { jobTitleId: null },
    });
    await prisma.jobTitle.deleteMany({
      where: { companyId: { in: [r.companyId, other.companyId] } },
    });
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  it('adds a title in both languages, trimmed', async () => {
    const res = await r.admin
      .post('/job-titles')
      .send({ nameAr: ' كاشير ', nameEn: ' Cashier ' })
      .expect(201);
    expect(res.body).toMatchObject({
      nameAr: 'كاشير',
      nameEn: 'Cashier',
      employeeCount: 0,
    });
  });

  it('needs both names', async () => {
    const res = await r.admin
      .post('/job-titles')
      .send({ nameEn: 'Baker' })
      .expect(400);
    expect(res.body.errors).toEqual({ nameAr: 'required' });
  });

  it('refuses a name the company already has (any letter case)', async () => {
    const res = await r.admin
      .post('/job-titles')
      .send({ nameAr: 'أمين صندوق', nameEn: 'CASHIER' })
      .expect(409);
    expect(res.body).toEqual({
      message: 'jobTitleExists',
      errors: { nameEn: 'jobTitleExists' },
    });
  });

  it('lists A→Z with how many employees use each title', async () => {
    await r.admin
      .post('/job-titles')
      .send({ nameAr: 'خباز', nameEn: 'Baker' })
      .expect(201);
    const res = await r.admin.get('/job-titles').expect(200);
    expect(res.body.items.map((t: { nameEn: string }) => t.nameEn)).toEqual([
      'Baker',
      'Cashier',
    ]);
  });

  it('renames a title', async () => {
    const created = await r.admin
      .post('/job-titles')
      .send({ nameAr: 'سائق', nameEn: 'Drivr' })
      .expect(201);
    const res = await r.admin
      .patch(`/job-titles/${created.body.id}`)
      .send({ nameAr: 'سائق', nameEn: 'Driver' })
      .expect(200);
    expect(res.body.nameEn).toBe('Driver');
  });

  it('refuses to remove a title employees use, and removes it once nobody does (D-48)', async () => {
    const created = await r.admin
      .post('/job-titles')
      .send({ nameAr: 'مدير وردية', nameEn: 'Shift lead' })
      .expect(201);
    await prisma.employee.update({
      where: { id: r.ownEmployeeId },
      data: { jobTitleId: created.body.id },
    });

    const list = await r.admin.get('/job-titles').expect(200);
    const used = list.body.items.find(
      (t: { id: string }) => t.id === created.body.id,
    );
    expect(used.employeeCount).toBe(1);

    const refused = await r.admin
      .delete(`/job-titles/${created.body.id}`)
      .expect(409);
    expect(refused.body).toEqual({ message: 'jobTitleInUse' });

    await prisma.employee.update({
      where: { id: r.ownEmployeeId },
      data: { jobTitleId: null },
    });
    await r.admin.delete(`/job-titles/${created.body.id}`).expect(204);
  });

  it("keeps each company's list to itself", async () => {
    const theirs = await other.admin
      .post('/job-titles')
      .send({ nameAr: 'كاشير', nameEn: 'Cashier' }) // the same name is fine in another company
      .expect(201);

    const ours = await r.admin.get('/job-titles').expect(200);
    expect(ours.body.items.map((t: { id: string }) => t.id)).not.toContain(
      theirs.body.id,
    );
    await r.admin
      .patch(`/job-titles/${theirs.body.id}`)
      .send({ nameAr: 'x', nameEn: 'x' })
      .expect(404);
    await r.admin.delete(`/job-titles/${theirs.body.id}`).expect(404);
  });

  it('is for Admins only', async () => {
    await r.anonymous().get('/job-titles').expect(401);
    await r.employee.get('/job-titles').expect(403);
    await r.interviewer
      .post('/job-titles')
      .send({ nameAr: 'x', nameEn: 'x' })
      .expect(403);
  });
});
