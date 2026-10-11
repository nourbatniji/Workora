// CS-02 (SCRUM-39): the setup wizard remembers which steps each company has done or skipped
// (companies.setup_steps, D-74). Needs the local database (with the latest migration): pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { SETUP_STEPS } from '@mdarj/shared';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Setup wizard progress (CS-02, SCRUM-39)', () => {
  let app: INestApplication<App>;
  let r: RoleBrowsers;
  let other: RoleBrowsers;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    r = await setupRoleBrowsers(app);
    other = await setupRoleBrowsers(app);
  }, 30_000);

  afterAll(async () => {
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  const statuses = (body: { steps: { key: string; status: string }[] }) =>
    Object.fromEntries(body.steps.map((s) => [s.key, s.status]));

  it('starts with every step to do, in order', async () => {
    const res = await r.admin.get('/company/setup').expect(200);
    expect(res.body.steps.map((s: { key: string }) => s.key)).toEqual([
      ...SETUP_STEPS,
    ]);
    expect(
      res.body.steps.every((s: { status: string }) => s.status === 'todo'),
    ).toBe(true);
    expect(res.body.complete).toBe(false);
  });

  it('marks steps done or skipped', async () => {
    await r.admin
      .patch('/company/setup')
      .send({ step: 'profile', status: 'done' })
      .expect(200);
    const res = await r.admin
      .patch('/company/setup')
      .send({ step: 'payroll', status: 'skipped' })
      .expect(200);
    expect(statuses(res.body)).toMatchObject({
      profile: 'done',
      payroll: 'skipped',
      workWeek: 'todo',
    });
  });

  it('never turns a done step back into skipped', async () => {
    const res = await r.admin
      .patch('/company/setup')
      .send({ step: 'profile', status: 'skipped' })
      .expect(200);
    expect(statuses(res.body).profile).toBe('done');
  });

  it('is complete once every step is done or skipped', async () => {
    let last;
    for (const step of SETUP_STEPS) {
      last = await r.admin
        .patch('/company/setup')
        .send({ step, status: 'skipped' })
        .expect(200);
    }
    expect(last!.body.complete).toBe(true);
    expect(statuses(last!.body).profile).toBe('done');
  });

  it("keeps each company's progress to itself", async () => {
    const theirs = await other.admin.get('/company/setup').expect(200);
    expect(theirs.body.complete).toBe(false);
  });

  it('checks the step and the status', async () => {
    const res = await r.admin
      .patch('/company/setup')
      .send({ step: 'payday', status: 'finished' })
      .expect(400);
    expect(res.body.errors).toEqual({
      step: 'stepInvalid',
      status: 'statusInvalid',
    });
  });

  it('is for Admins only', async () => {
    await r.anonymous().get('/company/setup').expect(401);
    await r.employee.get('/company/setup').expect(403);
    await r.interviewer
      .patch('/company/setup')
      .send({ step: 'profile', status: 'done' })
      .expect(403);
  });
});
