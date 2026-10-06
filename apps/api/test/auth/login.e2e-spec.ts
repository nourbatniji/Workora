// UA-03, UA-08, UA-09: log in with email or phone, sessions, account status.
// Needs the local database: pnpm db:up
import { randomInt, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { hashSessionToken } from '../../src/auth/session-token.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('Log in and sessions (UA-03, UA-08, UA-09)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let companyId: string;
  let userId: string;

  // Unique data for every run, so tests never clash with your own data
  const run = randomUUID();
  const companyName = `Login Test ${run}`;
  const email = `login-${run}@test.mdarj`;
  const password = 'right-pass1';
  // A random Egyptian mobile; stored the way normalizePhone saves it (D-45)
  const localPhone = `010${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
  const phone = `+2${localPhone}`;

  // A browser of its own: keeps the cookies it receives
  const newBrowser = () => request.agent(app.getHttpServer());

  /** The session token inside a login response's Set-Cookie header */
  const tokenFrom = (res: request.Response) =>
    /mdarj_session=([^;]+)/.exec(String(res.headers['set-cookie']))![1];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app); // cookies and sessions, exactly like main.ts
    await app.init();
    prisma = app.get(PrismaService);

    // One company with its Admin, who also gets a phone number
    const res = await request(app.getHttpServer())
      .post('/auth/sign-up')
      .send({ companyName, name: 'Login Tester', email, password })
      .expect(201);
    companyId = res.body.company.id;
    userId = res.body.user.id;
    await prisma.user.update({ where: { id: userId }, data: { phone } });
  });

  // Remove everything the tests created
  afterAll(async () => {
    await prisma.session.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });
    await prisma.companySettingsVersion.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await app.close();
  });

  describe('UA-03 log in with email or phone', () => {
    it('logs in with email (any capitals) and opens a session', async () => {
      const browser = newBrowser();
      const res = await browser
        .post('/auth/login')
        .send({ identifier: email.toUpperCase(), password })
        .expect(200);
      expect(res.body.user.id).toBe(userId);

      // The session works, and /me runs inside the right company
      const me = await browser.get('/auth/me').expect(200);
      expect(me.body.user.company).toEqual({
        id: companyId,
        name: companyName,
      });
    });

    it('logs in with the phone number typed in local format', async () => {
      const typed = `${localPhone.slice(0, 3)} ${localPhone.slice(3, 7)} ${localPhone.slice(7)}`;
      const res = await newBrowser()
        .post('/auth/login')
        .send({ identifier: typed, password })
        .expect(200);
      expect(res.body.user.id).toBe(userId);
    });

    it('answers wrong credentials with one clear error', async () => {
      const wrongPassword = await newBrowser()
        .post('/auth/login')
        .send({ identifier: email, password: 'wrong-pass' })
        .expect(401);
      const unknownEmail = await newBrowser()
        .post('/auth/login')
        .send({ identifier: `nobody-${run}@test.mdarj`, password })
        .expect(401);
      // The same answer, so nobody can test which emails exist
      expect(wrongPassword.body).toEqual({ message: 'invalidCredentials' });
      expect(unknownEmail.body).toEqual({ message: 'invalidCredentials' });
    });

    it('has no limit on wrong passwords (D-46)', async () => {
      for (let i = 0; i < 7; i++) {
        await newBrowser()
          .post('/auth/login')
          .send({ identifier: email, password: 'wrong-pass' })
          .expect(401);
      }
      await newBrowser()
        .post('/auth/login')
        .send({ identifier: email, password })
        .expect(200);
    });

    it('refuses a second user with an email or phone already used', async () => {
      await expect(
        prisma.user.create({ data: { companyId, role: 'employee', email } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.user.create({ data: { companyId, role: 'employee', phone } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('UA-09 security baseline', () => {
    it('stores the password hashed with Argon2id', async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(password);
    });

    it('sets an httpOnly SameSite cookie and stores only a hash of its token', async () => {
      const res = await newBrowser()
        .post('/auth/login')
        .send({ identifier: email, password })
        .expect(200);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');

      const token = tokenFrom(res);
      expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(
        0,
      );
      expect(
        await prisma.session.count({
          where: { tokenHash: hashSessionToken(token) },
        }),
      ).toBe(1);
    });

    it('ends a session after 12 hours with no requests', async () => {
      const browser = newBrowser();
      const res = await browser
        .post('/auth/login')
        .send({ identifier: email, password })
        .expect(200);

      // Pretend the last request was 13 hours ago
      await prisma.session.update({
        where: { tokenHash: hashSessionToken(tokenFrom(res)) },
        data: { lastSeenAt: new Date(Date.now() - 13 * 60 * 60 * 1000) },
      });

      const me = await browser.get('/auth/me').expect(401);
      expect(me.body).toEqual({ message: 'sessionExpired' });
    });

    it('logs out: the session is revoked and kept as a record', async () => {
      const browser = newBrowser();
      const res = await browser
        .post('/auth/login')
        .send({ identifier: email, password })
        .expect(200);

      await browser.post('/auth/logout').expect(204);
      await browser.get('/auth/me').expect(401);

      const session = await prisma.session.findUniqueOrThrow({
        where: { tokenHash: hashSessionToken(tokenFrom(res)) },
      });
      expect(session.revokedAt).not.toBeNull();
    });
  });

  // Runs last: it deactivates the test account
  describe('UA-08 account status is separate from employment', () => {
    it('deactivating the account blocks login and leaves the employee Active', async () => {
      // Link the user to an employee record
      const employee = await prisma.employee.create({
        data: {
          companyId,
          code: 'E-001',
          nameAr: 'موظف تجريبي',
          nameEn: 'Login Tester',
          employmentType: 'full_time',
          hireDate: new Date('2026-01-01T00:00:00Z'),
        },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { employeeId: employee.id },
      });

      // A browser that is already logged in
      const browser = newBrowser();
      await browser
        .post('/auth/login')
        .send({ identifier: email, password })
        .expect(200);

      await prisma.user.update({
        where: { id: userId },
        data: { status: 'deactivated' },
      });

      // The open session stops working, and a new login is refused
      await browser.get('/auth/me').expect(401);
      const res = await newBrowser()
        .post('/auth/login')
        .send({ identifier: email, password })
        .expect(403);
      expect(res.body).toEqual({ message: 'accountDeactivated' });

      // The employee record did not change
      const after = await prisma.employee.findUniqueOrThrow({
        where: { id: employee.id },
      });
      expect(after.status).toBe('active');
    });
  });
});
