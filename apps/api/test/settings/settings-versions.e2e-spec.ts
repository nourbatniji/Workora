// CS-04 (SCRUM-41) and CS-08 (SCRUM-45): settings are versions with a start date. A change adds a
// version from a day (today or later); the rules for a day come from the version in force on it;
// versions already in force are never edited. Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { todayIn } from '../../src/modules/company/company-settings.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

/** "2026-10-11" + n days */
function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

describe('Work week and dated settings (CS-04 SCRUM-41, CS-08 SCRUM-45)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers;
  const today = todayIn('Africa/Cairo'); // the test companies keep the default time zone
  const nextMonth = addDays(today, 30);

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

  it('starts with the version made at sign-up: Friday and Saturday off', async () => {
    const res = await r.admin.get('/company/settings').expect(200);
    expect(res.body.date).toBe(today);
    expect(res.body.version).toMatchObject({
      effectiveFrom: today,
      restDays: [5, 6],
      checkInWindowMinutes: 60,
      overtimeDayRate: '1.35',
    });
  });

  it('adds a version from a future day; each day gets its own rules', async () => {
    // Something else set on the current version, to check it is carried over
    await prisma.companySettingsVersion.updateMany({
      where: { companyId: r.companyId },
      data: { checkInWindowMinutes: 45 },
    });

    const res = await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: nextMonth, restDays: [5] })
      .expect(201);
    expect(res.body).toMatchObject({
      effectiveFrom: nextMonth,
      restDays: [5],
      checkInWindowMinutes: 45, // copied from the version in force that day
    });

    const now = await r.admin.get('/company/settings').expect(200);
    expect(now.body.version.restDays).toEqual([5, 6]);
    const later = await r.admin
      .get(`/company/settings?date=${addDays(nextMonth, 3)}`)
      .expect(200);
    expect(later.body.version.restDays).toEqual([5]);

    const history = await r.admin.get('/company/settings/versions').expect(200);
    expect(
      history.body.items.map((v: { effectiveFrom: string; state: string }) => [
        v.effectiveFrom,
        v.state,
      ]),
    ).toEqual([
      [nextMonth, 'scheduled'],
      [today, 'inForce'],
    ]);
    expect(history.body.items[0].createdBy).toBe('Role Admin');
  });

  it('replaces a version that starts on the same day instead of adding one', async () => {
    await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: nextMonth, restDays: [4, 5] })
      .expect(201);
    const history = await r.admin.get('/company/settings/versions').expect(200);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.items[0].restDays).toEqual([4, 5]);
  });

  it('never starts in the past (D-70)', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: addDays(today, -1), restDays: [5] })
      .expect(400);
    expect(res.body.errors).toEqual({ effectiveFrom: 'effectiveDateInPast' });
  });

  it('records each change in the audit log', async () => {
    const audit = await prisma.auditLog.findMany({
      where: { companyId: r.companyId, entityType: 'company_settings' },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual(['create', 'update']);
    expect(audit[0].after).toEqual({ effectiveFrom: nextMonth, restDays: [5] });
  });

  it('checks the work week', async () => {
    const all = await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: nextMonth, restDays: [0, 1, 2, 3, 4, 5, 6] })
      .expect(400);
    expect(all.body.errors).toEqual({ restDays: 'needWorkingDay' });

    const nothing = await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: nextMonth })
      .expect(400);
    expect(nothing.body.errors).toEqual({ body: 'nothingToChange' });

    const badDate = await r.admin
      .get('/company/settings?date=2026-02-30')
      .expect(400);
    expect(badDate.body.errors).toEqual({ date: 'dateInvalid' });
  });

  it("keeps each company's settings to itself", async () => {
    const theirs = await other.admin
      .get('/company/settings/versions')
      .expect(200);
    expect(theirs.body.items).toHaveLength(1);
    expect(theirs.body.items[0].restDays).toEqual([5, 6]);
  });

  it('is for Admins only', async () => {
    await r.anonymous().get('/company/settings').expect(401);
    await r.employee.get('/company/settings/versions').expect(403);
    await r.interviewer
      .post('/company/settings/versions')
      .send({ effectiveFrom: nextMonth, restDays: [5] })
      .expect(403);
  });
});
