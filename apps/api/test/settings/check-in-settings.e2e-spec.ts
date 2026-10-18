// CS-07 (SCRUM-44): check-in window, check-out window and the office IP list are dated settings
// (CS-08). Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { todayIn } from '../../src/company/company-settings.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Check-in settings (CS-07, SCRUM-44)', () => {
  let app: INestApplication<App>;
  let r: RoleBrowsers;
  const today = todayIn('Africa/Cairo');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    r = await setupRoleBrowsers(app);
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await app.close();
  });

  it('starts with 60 minutes before, 6 hours after, and no IP list', async () => {
    const res = await r.admin.get('/company/settings').expect(200);
    expect(res.body.version).toMatchObject({
      checkInWindowMinutes: 60,
      checkOutWindowMinutes: 360,
      ipAllowList: [],
    });
  });

  it('saves the windows and a cleaned IP list, keeping everything else', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: today,
        checkInWindowMinutes: 30,
        checkOutWindowMinutes: 240,
        ipAllowList: [' 41.33.10.0/24 ', '41.33.10.0/24', '2001:DB8::1'],
      })
      .expect(201);
    expect(res.body).toMatchObject({
      checkInWindowMinutes: 30,
      checkOutWindowMinutes: 240,
      ipAllowList: ['41.33.10.0/24', '2001:db8::1'], // trimmed, lowercased, no duplicates
      restDays: [5, 6],
      overtimeMinMinutes: 30,
    });
  });

  it('writes each IP one way, so duplicates are found (D-73)', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: today,
        ipAllowList: [
          '::ffff:41.33.10.7', // IPv4 written as IPv6
          '41.33.10.7', // the same address: a duplicate
          '2001:DB8:0:0::1', // long IPv6 form
          '::ffff:41.33.10.0/120', // IPv4 range written as IPv6
        ],
      })
      .expect(201);
    expect(res.body.ipAllowList).toEqual([
      '41.33.10.7',
      '2001:db8::1',
      '41.33.10.0/24',
    ]);
  });

  it('empties the IP list so check-in works from anywhere again', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({ effectiveFrom: today, ipAllowList: [] })
      .expect(201);
    expect(res.body.ipAllowList).toEqual([]);
    expect(res.body.checkInWindowMinutes).toBe(30); // the window saved above stays
  });

  it('refuses addresses that are not IPs and windows out of range', async () => {
    const res = await r.admin
      .post('/company/settings/versions')
      .send({
        effectiveFrom: today,
        checkInWindowMinutes: 300,
        checkOutWindowMinutes: 10,
        ipAllowList: ['41.33.10.0/24', '256.1.1.1', 'office-wifi'],
      })
      .expect(400);
    expect(res.body.errors).toEqual({
      checkInWindowMinutes: 'minutesInvalid',
      checkOutWindowMinutes: 'minutesInvalid',
      'ipAllowList.1': 'ipInvalid',
      'ipAllowList.2': 'ipInvalid',
    });
  });
});
