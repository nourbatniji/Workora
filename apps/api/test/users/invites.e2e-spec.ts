// UA-01 (SCRUM-29): the Admin creates a user and gets a 7-day link; the link is emailed when the
// person has an email; opening it and setting a password makes the account Active and logs in.
// UA-02 (SCRUM-30): the Admin can issue a new link; the old one stops working.
// Needs the local database and Mailpit: pnpm db:up
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { hashInviteToken } from '../../src/auth/invite-token.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const DAY_MS = 24 * 60 * 60 * 1000;

/** The token at the end of an invite link */
function tokenOf(link: string): string {
  return new URL(link).searchParams.get('token')!;
}

/** The subject and text of the email sent to address (Mailpit stores it a moment after it arrives) */
async function inboxOf(address: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
    ).then((r) => r.json())) as { messages: { ID: string }[] };
    if (search.messages?.length) {
      return (await fetch(
        `${MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`,
      ).then((r) => r.json())) as { Subject: string; Text: string };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No email for ${address} in Mailpit`);
}

describe('Invite users (UA-01, SCRUM-29)', { timeout: 15_000 }, () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;
  let other: RoleBrowsers; // a second company
  const run = randomUUID();

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

  describe('POST /users', () => {
    it('creates an Invited user with a 7-day link and emails it', async () => {
      const email = `mona-${run}@invite.test`;
      const res = await r.admin
        .post('/users')
        .send({
          name: 'Mona',
          email: ` ${email.toUpperCase()} `,
          role: 'employee',
        })
        .expect(201);

      expect(res.body.user).toMatchObject({
        name: 'Mona',
        email, // trimmed and lowercased
        role: 'employee',
        status: 'invited',
      });
      expect(res.body.emailSent).toBe(true);
      // Never in a response: the hash of the token or the password hash
      expect(res.body.user.inviteToken).toBeUndefined();
      expect(res.body.user.passwordHash).toBeUndefined();

      // The database keeps the token's hash, not the token
      const token = tokenOf(res.body.inviteLink);
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: res.body.user.id },
      });
      expect(row.inviteToken).toBe(hashInviteToken(token));
      expect(row.inviteToken).not.toBe(token);
      expect(row.passwordHash).toBeNull();

      // Valid for 7 days
      const days = (row.inviteExpiresAt!.getTime() - Date.now()) / DAY_MS;
      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThanOrEqual(7);

      // The email carries the same link
      const message = await inboxOf(email);
      expect(message.Text).toContain(res.body.inviteLink);

      // And the audit log knows who created it
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: 'user',
          entityId: res.body.user.id,
          action: 'create',
        },
      });
      expect(audit.companyId).toBe(r.companyId);
      expect(JSON.stringify(audit.after)).not.toContain(token);
    });

    it('invites by phone only: no email, the link is still returned to copy (FR-UA-2)', async () => {
      const res = await r.admin
        .post('/users')
        .send({
          name: 'Said',
          phone: '010 9876 5432',
          role: 'employee',
          language: 'ar',
        })
        .expect(201);

      expect(res.body.user.phone).toBe('+201098765432');
      expect(res.body.user.language).toBe('ar');
      expect(res.body.emailSent).toBe(false);
      expect(res.body.inviteLink).toMatch(/\/ar\/set-password\?token=/);
    });

    it("uses the Admin's language when none is given (D-66)", async () => {
      const res = await r.admin
        .post('/users')
        .send({
          name: 'Interviewer',
          email: `int-${run}@invite.test`,
          role: 'interviewer',
        })
        .expect(201);
      // The test Admin signed up without a language, so English
      expect(res.body.user.language).toBe('en');
      expect(res.body.inviteLink).toMatch(/\/en\/set-password\?token=/);
    });

    it('needs an email or a phone', async () => {
      const res = await r.admin
        .post('/users')
        .send({ name: 'Nobody', email: '', role: 'employee' })
        .expect(400);
      expect(res.body).toEqual({
        message: 'validationFailed',
        errors: { email: 'emailOrPhoneRequired' },
      });
    });

    it('refuses an email used in another company (unique in the whole system)', async () => {
      const email = `taken-${run}@invite.test`;
      await other.admin
        .post('/users')
        .send({ name: 'First', email, role: 'employee' })
        .expect(201);

      const res = await r.admin
        .post('/users')
        .send({ name: 'Second', email, role: 'employee' })
        .expect(409);
      expect(res.body).toEqual({
        message: 'emailTaken',
        errors: { email: 'emailTaken' },
      });
    });

    it('is for Admins only', async () => {
      const body = {
        name: 'X',
        email: `x-${run}@invite.test`,
        role: 'employee',
      };
      await r.anonymous().post('/users').send(body).expect(401);
      await r.employee.post('/users').send(body).expect(403);
      await r.interviewer.post('/users').send(body).expect(403);
    });
  });

  describe('GET /users', () => {
    it("lists this company's users only, never their secrets", async () => {
      const res = await r.admin.get('/users').expect(200);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
      const emails = res.body.items.map((u: { email: string }) => u.email);
      expect(emails).toContain(`mona-${run}@invite.test`);
      // The user invited by the other company is not here
      expect(emails).not.toContain(`taken-${run}@invite.test`);
      for (const user of res.body.items) {
        expect(user.inviteToken).toBeUndefined();
        expect(user.passwordHash).toBeUndefined();
      }
    });

    it('is for Admins only', async () => {
      await r.anonymous().get('/users').expect(401);
      await r.employee.get('/users').expect(403);
      await r.interviewer.get('/users').expect(403);
    });
  });

  describe('the invite link', () => {
    /** A fresh invite; returns its token and the new user's email */
    async function invite() {
      const email = `link-${randomUUID()}@invite.test`;
      const res = await r.admin
        .post('/users')
        .send({ name: 'Link Person', email, role: 'employee' })
        .expect(201);
      return {
        token: tokenOf(res.body.inviteLink),
        email,
        id: res.body.user.id as string,
      };
    }

    it('shows who the link is for and which company', async () => {
      const { token, email } = await invite();
      const res = await request(app.getHttpServer())
        .get(`/auth/invites/${token}`)
        .expect(200);
      expect(res.body.user).toMatchObject({ name: 'Link Person', email });
      expect(res.body.company.name).toContain('Roles Test');
    });

    it('answers 404 inviteInvalid for a made-up token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/invites/not-a-real-token')
        .expect(404);
      expect(res.body).toEqual({ message: 'inviteInvalid' });
    });

    it('stops working after 7 days', async () => {
      const { token, id } = await invite();
      await prisma.user.update({
        where: { id },
        data: { inviteExpiresAt: new Date(Date.now() - 1000) },
      });

      const check = await request(app.getHttpServer())
        .get(`/auth/invites/${token}`)
        .expect(404);
      expect(check.body).toEqual({ message: 'inviteExpired' });
      await request(app.getHttpServer())
        .post(`/auth/invites/${token}/accept`)
        .send({ password: 'new-pass-123' })
        .expect(404);
    });

    it('checks the password rules', async () => {
      const { token } = await invite();
      const res = await request(app.getHttpServer())
        .post(`/auth/invites/${token}/accept`)
        .send({ password: 'short' })
        .expect(400);
      expect(res.body.errors).toEqual({ password: 'passwordTooShort' });
    });

    it('sets the password, activates the account, logs in, and works only once', async () => {
      const { token, email, id } = await invite();
      const browser = request.agent(app.getHttpServer());

      const res = await browser
        .post(`/auth/invites/${token}/accept`)
        .send({ password: 'new-pass-123' })
        .expect(200);
      expect(res.body.user).toMatchObject({ id, email, role: 'employee' });

      // Logged in straight away
      const me = await browser.get('/auth/me').expect(200);
      expect(me.body.user.id).toBe(id);

      // Active, link used up
      const row = await prisma.user.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('active');
      expect(row.inviteToken).toBeNull();
      expect(row.inviteExpiresAt).toBeNull();

      // The same link again: gone
      await request(app.getHttpServer())
        .get(`/auth/invites/${token}`)
        .expect(404);

      // The new password works on the login page
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: email, password: 'new-pass-123' })
        .expect(200);

      // Audit: invited → active, by the person themselves
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'user', entityId: id, action: 'update' },
      });
      expect(audit.userId).toBe(id);
      expect(audit.after).toEqual({ status: 'active' });
    });

    it('cannot be used to log in before the password is set', async () => {
      const { email } = await invite();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: email, password: 'anything-123' })
        .expect(401);
    });
  });

  describe('POST /users/:id/invite: a new link (UA-02, SCRUM-30)', () => {
    async function invite(body: Record<string, string>) {
      const res = await r.admin
        .post('/users')
        .send({ name: 'Again', role: 'employee', ...body })
        .expect(201);
      return {
        id: res.body.user.id as string,
        token: tokenOf(res.body.inviteLink),
      };
    }

    it('replaces the old link and emails the new one', async () => {
      const email = `again-${randomUUID()}@invite.test`;
      const first = await invite({ email });

      const res = await r.admin.post(`/users/${first.id}/invite`).expect(200);
      expect(res.body.emailSent).toBe(true);
      const newToken = tokenOf(res.body.inviteLink);
      expect(newToken).not.toBe(first.token);

      // Old link: dead. New link: works
      await request(app.getHttpServer())
        .get(`/auth/invites/${first.token}`)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/auth/invites/${newToken}`)
        .expect(200);

      // The audit log records who issued it
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: 'user',
          entityId: first.id,
          action: 'update',
          reason: 'New invite link issued',
        },
      });
      expect(audit.userId).not.toBeNull();
    });

    it('works for someone with a phone only: no email, link to copy', async () => {
      const phone = `+2010${String(Date.now()).slice(-8)}`;
      const { id } = await invite({ phone });
      const res = await r.admin.post(`/users/${id}/invite`).expect(200);
      expect(res.body.emailSent).toBe(false);
      expect(res.body.inviteLink).toContain('/set-password?token=');
    });

    it('resets an Active user without email: new password, old sessions end (FR-UA-4)', async () => {
      const email = `reset-${randomUUID()}@invite.test`;
      const { id, token } = await invite({ email });

      // The person activates the account and is logged in on a "phone"
      const phoneBrowser = request.agent(app.getHttpServer());
      await phoneBrowser
        .post(`/auth/invites/${token}/accept`)
        .send({ password: 'first-pass-123' })
        .expect(200);
      await phoneBrowser.get('/auth/me').expect(200);

      // They forget the password; the Admin issues a new link
      const res = await r.admin.post(`/users/${id}/invite`).expect(200);
      const laptop = request.agent(app.getHttpServer());
      await laptop
        .post(`/auth/invites/${tokenOf(res.body.inviteLink)}/accept`)
        .send({ password: 'second-pass-123' })
        .expect(200);

      // The old phone session is over; the old password no longer works; the new one does
      await phoneBrowser.get('/auth/me').expect(401);
      await laptop.get('/auth/me').expect(200);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: email, password: 'first-pass-123' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: email, password: 'second-pass-123' })
        .expect(200);
    });

    it('refuses a switched-off account', async () => {
      const { id } = await invite({ email: `off-${randomUUID()}@invite.test` });
      await prisma.user.update({
        where: { id },
        data: { status: 'deactivated' },
      });
      const res = await r.admin.post(`/users/${id}/invite`).expect(409);
      expect(res.body).toEqual({ message: 'accountDeactivated' });
    });

    it("answers 404 for another company's user, 400 for a bad id", async () => {
      const theirs = await other.admin
        .post('/users')
        .send({
          name: 'Theirs',
          email: `theirs-${randomUUID()}@invite.test`,
          role: 'employee',
        })
        .expect(201);
      await r.admin.post(`/users/${theirs.body.user.id}/invite`).expect(404);
      await r.admin.post('/users/not-a-uuid/invite').expect(400);
    });

    it('is for Admins only', async () => {
      const { id } = await invite({ email: `who-${randomUUID()}@invite.test` });
      await r.anonymous().post(`/users/${id}/invite`).expect(401);
      await r.employee.post(`/users/${id}/invite`).expect(403);
      await r.interviewer.post(`/users/${id}/invite`).expect(403);
    });
  });
});
