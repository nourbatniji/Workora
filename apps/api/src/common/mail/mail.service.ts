// The email sender (FND-05, D-14): the one place features send email from.
// SMTP is the standard way programs hand an email to a mail server. Locally the server is
// Mailpit (a fake inbox at http://localhost:8025, D-36); in production it is the email
// provider (A-12) — only the SMTP_* settings change, not this code.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import {
  renderMail,
  type MailLanguage,
  type MailTemplate,
} from './templates.js';

/** "mona@example.com" → "m***@example.com": logs must not hold personal data */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return domain ? `${name.charAt(0)}***@${domain}` : '***';
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    this.transport = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get<string>('SMTP_PORT', '1025')),
      secure: config.get<string>('SMTP_SECURE') === 'true',
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
      // Give up quickly: a slow mail server must not hold the request for long
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
    this.from = config.get<string>('MAIL_FROM', 'MDARJ <no-reply@mdarj.local>');
  }

  /**
   * Sends one email. Never throws: a failure is logged and the answer is false,
   * so the caller carries on (the invite link can still be copied, FR-UA-2).
   * Call it after the database change is saved, never inside the transaction.
   */
  async send(
    to: string,
    template: MailTemplate,
    language: MailLanguage,
  ): Promise<boolean> {
    const mail = renderMail(template, language);
    try {
      await this.transport.sendMail({ from: this.from, to, ...mail });
      return true;
    } catch (error) {
      this.logger.error(
        `Could not send the ${template.kind} email to ${maskEmail(to)}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
