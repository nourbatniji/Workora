// UA-04 (SCRUM-32): "Forgot password" emails a 1-hour link; the same set-password page saves the
// new password. The answer never tells whether an email has an account.
// Needs the local database and Mailpit: pnpm db:up
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from './role-browsers.js';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

const RESET_SUBJECT = 'Reset your MDARJ password';

/** Reset emails sent to address, newest first (the invite email to the same address is left out) */
async function resetEmailsTo(address: string) {
  const query = `to:"${address}" subject:"${RESET_SUBJECT}"`;
  const search = (await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`,
  ).then((r) => r.json())) as { messages: { ID: string }[] };
  return search.messages ?? [];
}

/** The newest reset email to address (Mailpit stores it a moment after it arrives) */
async function resetEmail(address: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const [newest] = await resetEmailsTo(address);
    if (newest) {
      return (await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`).then(
        (r) => r.json(),
      )) as { Subject: string; Text: string };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No reset email for ${address} in Mailpit`);
}

function tokenIn(text: string): string {
  const match = /set-password\?token=([\w-]+)/.exec(text);
  if (!match) throw new Error('No link in the email');
  return match[1];
}

describe('Forgot password (UA-04, SCRUM-32)', { timeout: 15_000 }, () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let r: RoleBrowsers;

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

  const server = () => request(app.getHttpServer());

  /** An Active user with a known password, created through a real invite */
  async function activeUser() {
    const email = `forgot-${randomUUID()}@reset.test`;
    const res = await r.admin
      .post('/users')
      .send({ name: 'Forgetful', email, role: 'employee' })
      .expect(201);
    const token = new URL(res.body.inviteLink).searchParams.get('token')!;
    await server()
      .post(`/auth/invites/${token}/accept`)
      .send({ password: 'old-pass-123' })
      .expect(200);
    return { email, id: res.body.user.id as string };
  }

  it('emails a 1-hour link; the new password works and the old one stops', async () => {
    const { email, id } = await activeUser();

    await server().post('/auth/password-reset').send({ email }).expect(204);

    const message = await resetEmail(email);
    expect(message.Subject).toBe(RESET_SUBJECT);
    const token = tokenIn(message.Text);

    // About one hour
    const row = await prisma.user.findUniqueOrThrow({ where: { id } });
    const minutes = (row.inviteExpiresAt!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);

    // The page knows it's a reset, not an invite
    const check = await server().get(`/auth/invites/${token}`).expect(200);
    expect(check.body.purpose).toBe('reset');

    await server()
      .post(`/auth/invites/${token}/accept`)
      .send({ password: 'new-pass-456' })
      .expect(200);
    await server()
      .post('/auth/login')
      .send({ identifier: email, password: 'old-pass-123' })
      .expect(401);
    await server()
      .post('/auth/login')
      .send({ identifier: email, password: 'new-pass-456' })
      .expect(200);
  });

  it('writes the email and the link in the language of the page that asked', async () => {
    const { email, id } = await activeUser();
    // The account itself is saved in Arabic
    await prisma.user.update({ where: { id }, data: { language: 'ar' } });

    await server()
      .post('/auth/password-reset')
      .send({ email, language: 'en' })
      .expect(204);

    const message = await resetEmail(email);
    expect(message.Subject).toBe(RESET_SUBJECT); // the English subject
    expect(message.Text).toMatch(/\/en\/set-password\?token=/);
  });

  it('answers the same for an email with no account, and sends nothing', async () => {
    const email = `nobody-${randomUUID()}@reset.test`;
    const res = await server()
      .post('/auth/password-reset')
      .send({ email })
      .expect(204);
    expect(res.body).toEqual({});
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await resetEmailsTo(email)).toHaveLength(0);
  });

  it("never replaces an Invited user's pending invite", async () => {
    const email = `pending-${randomUUID()}@reset.test`;
    const created = await r.admin
      .post('/users')
      .send({ name: 'Pending', email, role: 'employee' })
      .expect(201);
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: created.body.user.id },
    });

    await server().post('/auth/password-reset').send({ email }).expect(204);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: created.body.user.id },
    });
    expect(after.inviteToken).toBe(before.inviteToken);
    expect(after.inviteExpiresAt).toEqual(before.inviteExpiresAt);
  });

  it('sends nothing to a switched-off account', async () => {
    const { email, id } = await activeUser();
    await prisma.user.update({
      where: { id },
      data: { status: 'deactivated' },
    });
    await server().post('/auth/password-reset').send({ email }).expect(204);
    const row = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(row.inviteToken).toBeNull();
  });

  it('sends at most one email a minute', async () => {
    const { email, id } = await activeUser();
    await server().post('/auth/password-reset').send({ email }).expect(204);
    const first = await prisma.user.findUniqueOrThrow({ where: { id } });
    await server().post('/auth/password-reset').send({ email }).expect(204);
    const second = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(second.inviteToken).toBe(first.inviteToken);
  });

  it('stops working after an hour', async () => {
    const { email, id } = await activeUser();
    await server().post('/auth/password-reset').send({ email }).expect(204);
    const token = tokenIn((await resetEmail(email)).Text);
    await prisma.user.update({
      where: { id },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    });
    const res = await server().get(`/auth/invites/${token}`).expect(404);
    expect(res.body).toEqual({ message: 'inviteExpired' });
  });

  it('checks the email like every form', async () => {
    const res = await server()
      .post('/auth/password-reset')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.errors).toEqual({ email: 'emailInvalid' });
  });
});
