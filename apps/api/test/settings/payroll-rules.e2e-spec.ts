// CS-05 (SCRUM-42): payroll rules (daily-rate divisor, lateness policy, overtime multipliers and
// minimum) are saved from a date like every dated setting (CS-08). Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { todayIn } from '../../src/company/company-settings.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

const TIERED = {
  mode: 'tiered',
  bands: [
    { fromMinutes: 16, toMinutes: 60, dayFraction: 0.25 },
    { fromMinutes: 61, toMinutes: 120, dayFraction: 0.5 },
    { fromMinutes: 121, toMinutes: null, dayFraction: 1 },
  ],
};

describe('Payroll rules (CS-05, SCRUM-42)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  const today = todayIn('Africa/Cairo');
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
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await app.close();
  });

  it('starts with the SRS defaults', async () => {
    const res = await r.admin.get('/company/settings').expect(200);
    expect(res.body.version).toMatchObject({
      dailyRateDivisor: 'days_30',
      latenessPolicy: { mode: 'exact' },
      overtimeDayRate: '1.35',
      overtimeNightRate: '1.70',
      overtimeRestDayRate: '2.00',
      overtimeHolidayRate: '2.00',
      overtimeMinMinutes: 30,
    });
  });

  it('saves new payroll rules from a date and keeps the work week', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: nextMonth,
        dailyRateDivisor: 'days_26',
        latenessPolicy: TIERED,
        overtimeDayRate: '1.5',
        overtimeMinMinutes: 15,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      dailyRateDivisor: 'days_26',
      latenessPolicy: TIERED,
      overtimeDayRate: '1.50',
      overtimeNightRate: '1.70', // not sent: copied
      overtimeMinMinutes: 15,
      restDays: [5, 6], // the work week is untouched
    });

    // Today's rules have not changed
    const now = await r.admin.get('/company/settings').expect(200);
    expect(now.body.version.dailyRateDivisor).toBe('days_30');
  });

  it('records exactly what changed, before and after', async () => {
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { companyId: r.companyId, entityType: 'company_settings' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.before).toEqual({
      effectiveFrom: today,
      dailyRateDivisor: 'days_30',
      latenessPolicy: { mode: 'exact' },
      overtimeDayRate: '1.35',
      overtimeMinMinutes: 30,
    });
    expect(audit.after).toMatchObject({
      effectiveFrom: nextMonth,
      dailyRateDivisor: 'days_26',
      overtimeDayRate: '1.5',
    });
  });

  it('refuses lateness bands that overlap or leave an open band in the middle', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: nextMonth,
        latenessPolicy: {
          mode: 'tiered',
          bands: [
            { fromMinutes: 16, toMinutes: null, dayFraction: 0.25 },
            { fromMinutes: 50, toMinutes: 120, dayFraction: 0.5 },
          ],
        },
      })
      .expect(400);
    expect(res.body.errors).toEqual({
      'latenessPolicy.bands.0': 'openBandNotLast',
      'latenessPolicy.bands.1': 'bandsOverlap',
    });
  });

  it('refuses a gap between bands and a closed last band (D-72)', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: nextMonth,
        latenessPolicy: {
          mode: 'tiered',
          bands: [
            { fromMinutes: 16, toMinutes: 60, dayFraction: 0.25 },
            // 61–89 missing: would cost nothing
            { fromMinutes: 90, toMinutes: 120, dayFraction: 0.5 },
            // closed: 200 minutes late would cost nothing
            { fromMinutes: 121, toMinutes: 180, dayFraction: 1 },
          ],
        },
      })
      .expect(400);
    expect(res.body.errors).toEqual({
      'latenessPolicy.bands.1': 'bandsGap',
      'latenessPolicy.bands.2': 'lastBandNotOpen',
    });
  });

  it('accepts touching bands with both ends included (60 then 61)', async () => {
    await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: nextMonth, latenessPolicy: TIERED })
      .expect(201);
  });

  it('checks the multipliers and the minimum', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: nextMonth,
        overtimeDayRate: '7',
        overtimeHolidayRate: 'two',
        overtimeMinMinutes: 500,
        dailyRateDivisor: 'days_31',
      })
      .expect(400);
    expect(res.body.errors).toEqual({
      overtimeDayRate: 'rateOutOfRange',
      overtimeHolidayRate: 'rateInvalid',
      overtimeMinMinutes: 'minutesInvalid',
      dailyRateDivisor: 'divisorInvalid',
    });
  });
});
