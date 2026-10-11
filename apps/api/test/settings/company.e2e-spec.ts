// CS-03 (SCRUM-40) and CS-06 (SCRUM-43): the Admin reads and edits the company profile and the
// compliance mode (Labor Law yes/no and the company rules text); every change is audited;
// a company only ever sees its own profile. Needs the local database: pnpm db:up
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe('Company profile (CS-03, SCRUM-40)', () => {
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
    await r.cleanup();
    await other.cleanup();
    await app.close();
  });

  it('shows the profile with the Cairo and EGP defaults', async () => {
    const res = await r.admin.get('/company').expect(200);
    expect(res.body).toMatchObject({
      id: r.companyId,
      timeZone: 'Africa/Cairo',
      currency: 'EGP',
      logo: null,
    });
  });

  it('saves the profile, cleans the values, and audits the change', async () => {
    const res = await r.admin
      .patch('/company')
      .send({
        name: ' Nile Bakery ',
        address: ' 12 Tahrir St, Cairo ',
        phone: '010 1234 5678',
        timeZone: 'Africa/Cairo',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      name: 'Nile Bakery',
      address: '12 Tahrir St, Cairo',
      phone: '+201012345678',
    });

    // The logged-in user's company name follows (the top bar reads it from /auth/me)
    const me = await r.admin.get('/auth/me').expect(200);
    expect(me.body.user.company.name).toBe('Nile Bakery');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { companyId: r.companyId, entityType: 'company_settings' },
      orderBy: { createdAt: 'desc' },
    });
    expect((audit.after as { name: string }).name).toBe('Nile Bakery');
  });

  it('clears the address and phone when the boxes are emptied', async () => {
    const res = await r.admin
      .patch('/company')
      .send({
        name: 'Nile Bakery',
        address: '',
        phone: '',
        timeZone: 'Africa/Cairo',
      })
      .expect(200);
    expect(res.body.address).toBeNull();
    expect(res.body.phone).toBeNull();
  });

  it('checks every field', async () => {
    const res = await r.admin
      .patch('/company')
      .send({ name: '', phone: '123', timeZone: 'Mars/Olympus' })
      .expect(400);
    expect(res.body.errors).toEqual({
      name: 'required',
      phone: 'phoneInvalid',
      timeZone: 'timeZoneInvalid',
    });
  });

  it('never shows or changes another company', async () => {
    await other.admin
      .patch('/company')
      .send({ name: 'Other Co', timeZone: 'Africa/Cairo' })
      .expect(200);
    const ours = await r.admin.get('/company').expect(200);
    expect(ours.body.id).toBe(r.companyId);
    expect(ours.body.name).not.toBe('Other Co');
  });

  it('starts with law mode off and no company rules', async () => {
    const res = await r.admin.get('/company').expect(200);
    expect(res.body).toMatchObject({ lawMode: false, companyRulesText: null });
  });

  it('turns law mode on and saves the company rules, leaving the profile alone (CS-06)', async () => {
    const before = await r.admin.get('/company').expect(200);
    const rules =
      'Friday prayer break: 30 minutes.\nUniform required on shift.';
    const res = await r.admin
      .patch('/company')
      .send({ lawMode: true, companyRulesText: `  ${rules}  ` })
      .expect(200);
    expect(res.body).toMatchObject({
      lawMode: true,
      companyRulesText: rules, // trimmed, line breaks kept
      name: before.body.name,
      timeZone: before.body.timeZone,
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { companyId: r.companyId, entityType: 'company_settings' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.reason).toBe('Compliance mode');
    expect((audit.before as { lawMode: boolean }).lawMode).toBe(false);
    expect((audit.after as { lawMode: boolean }).lawMode).toBe(true);
  });

  it('clears the company rules when the box is emptied, and checks the switch', async () => {
    const cleared = await r.admin
      .patch('/company')
      .send({ companyRulesText: '' })
      .expect(200);
    expect(cleared.body.companyRulesText).toBeNull();

    const bad = await r.admin
      .patch('/company')
      .send({ lawMode: 'yes' })
      .expect(400);
    expect(bad.body.errors).toEqual({ lawMode: 'lawModeInvalid' });

    const empty = await r.admin.patch('/company').send({}).expect(400);
    expect(empty.body.errors).toEqual({ body: 'nothingToChange' });
  });

  it('is for Admins only', async () => {
    await r.anonymous().get('/company').expect(401);
    await r.employee.get('/company').expect(403);
    await r.interviewer
      .patch('/company')
      .send({ name: 'x', timeZone: 'Africa/Cairo' })
      .expect(403);
  });
});
