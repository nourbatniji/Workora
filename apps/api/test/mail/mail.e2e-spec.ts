// FND-05 (SCRUM-24): emails reach the mail server in the reader's language, and a broken
// mail server is logged without crashing. Needs Mailpit: pnpm db:up starts it (http://localhost:8025).
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/common/mail/mail.service.js';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** A ConfigService stand-in: the real settings, with some values replaced */
function config(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string | undefined> = {
    ...process.env,
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

interface MailpitMessage {
  Subject: string;
  Text: string;
  HTML: string;
  To: { Address: string }[];
}

/** Mailpit stores mail a moment after it arrives, so ask a few times */
async function inboxOf(address: string): Promise<MailpitMessage> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
    ).then((r) => r.json())) as { messages: { ID: string }[] };
    if (search.messages?.length) {
      return (await fetch(
        `${MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`,
      ).then((r) => r.json())) as MailpitMessage;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No email for ${address} in Mailpit`);
}

/** Waits until Mailpit answers: right after `pnpm db:up` (or in CI) it may still be starting */
async function waitForMailpit(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const res = await fetch(`${MAILPIT_URL}/api/v1/info`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `Mailpit is not running at ${MAILPIT_URL}: start it with pnpm db:up`,
  );
}

// Network tests: allow more than the 5-second default per test
describe('Sending email (FND-05)', { timeout: 15_000 }, () => {
  const mail = new MailService(config());

  beforeAll(async () => {
    await waitForMailpit();
  }, 15_000);

  it('sends an invite in English, with the link inside', async () => {
    const to = `invite-${randomUUID()}@mail.test`;
    const link = `http://localhost:3000/en/set-password?token=${randomUUID()}`;

    const sent = await mail.send(
      to,
      { kind: 'invite', link, companyName: 'Test Bakery' },
      'en',
    );

    expect(sent).toBe(true);
    const message = await inboxOf(to);
    expect(message.To[0].Address).toBe(to);
    expect(message.Subject).toBe("You're invited to Test Bakery on MDARJ");
    expect(message.Text).toContain(link);
    expect(message.HTML).toContain('dir="ltr"');
  });

  it('sends a password reset in Arabic, right-to-left', async () => {
    const to = `reset-${randomUUID()}@mail.test`;
    const link = `http://localhost:3000/ar/reset-password?token=${randomUUID()}`;

    const sent = await mail.send(
      to,
      { kind: 'passwordReset', link, validHours: 1 },
      'ar',
    );

    expect(sent).toBe(true);
    const message = await inboxOf(to);
    expect(message.Subject).toBe('إعادة تعيين كلمة المرور في مدارج');
    expect(message.Text).toContain(link);
    expect(message.HTML).toContain('dir="rtl"');
  });

  it('keeps a company name as text, never as HTML', async () => {
    const to = `escape-${randomUUID()}@mail.test`;
    await mail.send(
      to,
      {
        kind: 'invite',
        link: 'http://localhost:3000',
        companyName: '<b>X</b>',
      },
      'en',
    );
    const message = await inboxOf(to);
    expect(message.HTML).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(message.HTML).not.toContain('<b>X</b>');
  });

  it('logs a broken mail server and answers false instead of crashing', async () => {
    const errors: string[] = [];
    const spy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((message: unknown) => {
        errors.push(String(message));
      });
    // Port 1 has no mail server, so the connection fails
    const broken = new MailService(config({ SMTP_PORT: '1' }));

    const sent = await broken.send(
      'mona@example.com',
      { kind: 'passwordReset', link: 'http://localhost:3000', validHours: 1 },
      'en',
    );

    spy.mockRestore();
    expect(sent).toBe(false);
    expect(errors[0]).toContain('passwordReset');
    // The log never holds the full address
    expect(errors[0]).toContain('m***@example.com');
    expect(errors[0]).not.toContain('mona@example.com');
  });
});
