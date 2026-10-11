import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from '@node-rs/argon2';
import type {
  AcceptInviteInput,
  LoginInput,
  PasswordResetRequest,
  SignUpInput,
} from '@mdarj/shared';
import { Prisma, type User } from '../generated/prisma/client.js';
import { AuditService } from '../common/audit/audit.service.js';
import { MailService } from '../common/mail/mail.service.js';
import type { MailLanguage } from '../common/mail/templates.js';
import { runInCompany } from '../common/tenancy/tenant-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';
import {
  RESET_VALID_HOURS,
  RESET_VALID_MS,
  hashInviteToken,
  inviteLink,
  newInviteToken,
} from './invite-token.js';
import { hashSessionToken, newSessionToken } from './session-token.js';

/** Who opens a session: the browser's address and name, kept on the session row */
type Client = { ip?: string; userAgent?: string };

/** Today's date in Cairo as a plain date, for the first settings version */
function todayInCairo(): Date {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
  }).format(new Date());
  return new Date(day); // "2026-10-06" → midnight UTC on that day
}

@Injectable()
export class AuthService {
  // The plain client: at sign-up nobody is logged in and the company doesn't exist yet (D-25)
  constructor(
    private readonly prisma: PrismaService,
    // The guarded client: only this request's company (D-25)
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  /** The web app's address, for the links in emails */
  private readonly webUrl: string;

  async signUp(input: SignUpInput) {
    // Hash first: it's slow, so keep it outside the transaction (D-24, Argon2id)
    const passwordHash = await hash(input.password);

    try {
      // All three rows or none
      return await this.prisma.$transaction(async (tx) => {
        // 1. The company (time zone and currency use their defaults)
        const company = await tx.company.create({
          data: { name: input.companyName },
        });

        // 2. Its first settings version, effective today (FR-CS-8, D-27)
        await tx.companySettingsVersion.create({
          data: {
            companyId: company.id,
            effectiveFrom: todayInCairo(),
            restDays: [5, 6], // Friday and Saturday; the setup wizard can change them
            latenessPolicy: { mode: 'exact' },
            ipAllowList: [],
          },
        });

        // 3. The owner as the first Admin (D-41: their name lives on the user)
        const user = await tx.user.create({
          data: {
            companyId: company.id,
            name: input.name,
            email: input.email,
            passwordHash,
            role: 'admin',
            status: 'active',
            language: input.language,
          },
          // Never send the password hash back
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            language: true,
          },
        });

        return { company: { id: company.id, name: company.name }, user };
      });
    } catch (error) {
      // P2002 = a unique rule broke: here, the email is already used
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'emailTaken',
          errors: { email: 'emailTaken' },
        });
      }
      throw error;
    }
  }

  /** Log in with email or phone (UA-03). Returns the new session token for the cookie. */
  async login(input: LoginInput, client: Client) {
    // 1. Find the user: email and phone are unique in the whole system, so no company is needed
    const user = await this.prisma.user.findUnique({
      where:
        input.identifier.kind === 'email'
          ? { email: input.identifier.value }
          : { phone: input.identifier.value },
    });
    // Same answer for "no such user" and "wrong password", so nobody can test which emails exist
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({ message: 'invalidCredentials' });
    }

    // 2. Check the password. No limit on attempts (D-46)
    const passwordOk = await verify(user.passwordHash, input.password);
    if (!passwordOk) {
      throw new UnauthorizedException({ message: 'invalidCredentials' });
    }

    // 3. Right password but the account was switched off
    if (user.status === 'deactivated') {
      throw new ForbiddenException({ message: 'accountDeactivated' });
    }

    // 4. Success: open a session. The employee record is never touched (UA-08)
    return this.openSession(user, client);
  }

  /**
   * GET /auth/invites/:token (UA-01): is this link still good? The set-password page asks
   * before showing the form. Public: the person has no password yet.
   */
  async checkInvite(token: string) {
    const user = await this.findInvite(token);
    return {
      // An Active user's link is a password reset; the page words itself for it (UA-04)
      purpose: user.status === 'active' ? 'reset' : 'invite',
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        language: user.language,
      },
      company: { name: user.company.name },
    };
  }

  /**
   * POST /auth/invites/:token/accept (UA-01): saves the password, makes the account Active,
   * uses up the link, and logs the person in. Returns the session token for the cookie.
   */
  async acceptInvite(token: string, input: AcceptInviteInput, client: Client) {
    const user = await this.findInvite(token);
    // Hash first: it's slow, so keep it outside the transaction (D-24, Argon2id)
    const passwordHash = await hash(input.password);

    // The person has no session yet, so put on their company's badge for the guarded client
    await runInCompany(user.companyId, () =>
      this.tenantPrisma.db.$transaction(async (tx) => {
        // "and the token is still this one": if two tabs submit at once, only one wins
        const { count } = await tx.user.updateMany({
          where: { id: user.id, inviteToken: hashInviteToken(token) },
          data: {
            passwordHash,
            status: 'active',
            inviteToken: null, // a link works once
            inviteExpiresAt: null,
          },
        });
        if (count !== 1) {
          throw new NotFoundException({ message: 'inviteInvalid' });
        }
        // A new password ends every older session, on every device (a reset, FR-UA-4)
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record(tx, user.id, {
          entityType: 'user',
          entityId: user.id,
          action: 'update',
          before: { status: user.status },
          after: { status: 'active' },
          reason: 'Password set from the invite link',
        });
      }),
    );

    return this.openSession({ ...user, status: 'active' }, client);
  }

  /**
   * POST /auth/password-reset (UA-04, FR-UA-4, D-68): emails a 1-hour link to set a new password.
   * Always answers the same, so nobody can test which emails have an account. Only Active users
   * get a link: an Invited user's pending invite is never replaced from outside.
   */
  async requestPasswordReset(input: PasswordResetRequest): Promise<void> {
    // Plain client: nobody is logged in; email is unique in the whole system
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !user.email || user.status !== 'active') return;

    // One email a minute at most: a link made less than a minute ago is still fresh
    const now = Date.now();
    if (
      user.inviteExpiresAt &&
      user.inviteExpiresAt.getTime() > now + RESET_VALID_MS - 60_000
    ) {
      return;
    }

    const token = newInviteToken();
    const expiresAt = new Date(now + RESET_VALID_MS);
    await runInCompany(user.companyId, () =>
      this.tenantPrisma.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            inviteToken: hashInviteToken(token),
            inviteExpiresAt: expiresAt,
          },
        });
        // Nobody is logged in: no "who" (D-58), the reason says where it came from
        await this.audit.record(tx, null, {
          entityType: 'user',
          entityId: user.id,
          action: 'update',
          before: { inviteExpiresAt: user.inviteExpiresAt },
          after: { inviteExpiresAt: expiresAt },
          reason: 'Password reset requested from the login page',
        });
      }),
    );

    // Email after the save (D-64). A failure is logged; the answer stays the same.
    // The page's language wins: the person just asked in it (D-68)
    const language = input.language ?? (user.language as MailLanguage);
    await this.mail.send(
      user.email,
      {
        kind: 'passwordReset',
        link: inviteLink(this.webUrl, language, token),
        validHours: RESET_VALID_HOURS,
      },
      language,
    );
  }

  /** The user behind an invite link: 404 inviteInvalid (unknown, used, switched off) or inviteExpired */
  private async findInvite(token: string) {
    // Plain client: nobody is logged in. The token's hash is unique in the whole system.
    const user = await this.prisma.user.findUnique({
      where: { inviteToken: hashInviteToken(token) },
      include: { company: { select: { name: true } } },
    });
    if (!user || !user.inviteExpiresAt || user.status === 'deactivated') {
      throw new NotFoundException({ message: 'inviteInvalid' });
    }
    if (user.inviteExpiresAt.getTime() <= Date.now()) {
      throw new NotFoundException({ message: 'inviteExpired' });
    }
    return user;
  }

  /** A new session for this user (login, accepted invite) */
  private async openSession(user: User, client: Client) {
    const token = newSessionToken();
    await this.prisma.session.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        tokenHash: hashSessionToken(token),
        ipAddress: client.ip,
        userAgent: client.userAgent,
      },
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
      },
    };
  }

  /** Who is logged in (GET /auth/me). Runs inside the company badge, so it uses the guarded client. */
  async me(userId: string) {
    const user = await this.tenantPrisma.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        language: true,
        company: { select: { id: true, name: true } },
      },
    });
    return { user };
  }

  /** Ends one session (POST /auth/logout). The row stays, marked revoked, as a record. */
  async logout(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
}
