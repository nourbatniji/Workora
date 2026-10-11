// Users and invites (UA-01, FR-UA-1, FR-UA-2, FR-UA-7). The Admin creates a user; the person
// gets a 7-day link to set a password. Account status (invited/active/deactivated) is the
// login's status only, never the employee's (FR-UA-8).
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from '@mdarj/shared';
import { Prisma, type UserStatus } from '../../generated/prisma/client.js';
import type { AuthContext } from '../../auth/auth-context.js';
import {
  hashInviteToken,
  inviteExpiresAt,
  inviteLink,
  newInviteToken,
} from '../../auth/invite-token.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { MailService } from '../../common/mail/mail.service.js';
import type { MailLanguage } from '../../common/mail/templates.js';
import { requireCompanyId } from '../../common/tenancy/tenant-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service.js';

/** The client inside tenantPrisma.db.$transaction(async (tx) => …) */
type UsersTx = Parameters<
  Parameters<TenantPrismaService['db']['$transaction']>[0]
>[0];

/** The fields of a user the API may show. Never the password hash or the invite token. */
const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  language: true,
  inviteExpiresAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly webUrl: string;

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    // Plain client, only for the system-wide email/phone check: one email or phone belongs
    // to one user in the whole system (FR-UA-3), so the check must look past this company.
    // It reads only "is it used?", never another company's data (api-conventions.md §8).
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  /** GET /users: this company's logins, newest first */
  async list(query: ListUsersQuery) {
    const { page, pageSize } = query;
    const [items, total] = await Promise.all([
      this.tenantPrisma.db.user.findMany({
        select: PUBLIC_USER,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.tenantPrisma.db.user.count(),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * POST /users: creates an Invited user and a 7-day link.
   * The link is returned once, here, so the Admin can copy it (FR-UA-2); it is never shown again (D-65).
   */
  async create(auth: AuthContext, input: CreateUserInput) {
    const db = this.tenantPrisma.db;

    // 1. Email and phone are unique in the whole system (FR-UA-3)
    await this.assertFree(input.email, input.phone);

    // 2. The inviting Admin: their company's name goes in the email, their language is the default (D-66)
    const admin = await db.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { language: true, company: { select: { name: true } } },
    });
    const language = input.language ?? admin.language;

    // 3. The token: the link gets the token, the database gets its hash
    const token = newInviteToken();
    const expiresAt = inviteExpiresAt();

    // 4. The user and its audit row, together or not at all
    let user;
    try {
      user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            companyId: requireCompanyId(),
            name: input.name,
            email: input.email,
            phone: input.phone,
            role: input.role,
            status: 'invited',
            language,
            inviteToken: hashInviteToken(token),
            inviteExpiresAt: expiresAt,
          },
          select: PUBLIC_USER,
        });
        await this.audit.record(tx, auth.userId, {
          entityType: 'user',
          entityId: created.id,
          action: 'create',
          after: created,
        });
        return created;
      });
    } catch (error) {
      // Someone took the same email or phone a moment ago, after step 1
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({ message: 'conflict' });
      }
      throw error;
    }

    // 5. Email the link after the save, never inside the transaction (D-64).
    //    A failed email doesn't undo the invite: the Admin can still copy the link.
    const link = inviteLink(this.webUrl, language, token);
    const emailSent = user.email
      ? await this.mail.send(
          user.email,
          { kind: 'invite', link, companyName: admin.company.name },
          language as MailLanguage,
        )
      : false;

    return { user, inviteLink: link, emailSent };
  }

  /**
   * POST /users/:id/invite (UA-02, FR-UA-2, FR-UA-4): a fresh 7-day link for someone whose link
   * expired, who never got the email, or who forgot their password and has no email.
   * The old link stops working. Works for Invited and Active users, never Deactivated ones.
   */
  async newInvite(auth: AuthContext, userId: string) {
    const db = this.tenantPrisma.db;

    // Another company's user is not found at all (tenancy, D-57)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        language: true,
        inviteExpiresAt: true,
        company: { select: { name: true } },
      },
    });
    if (!user) {
      throw new NotFoundException({ message: 'notFound' });
    }
    if (user.status === 'deactivated') {
      throw new ConflictException({ message: 'accountDeactivated' });
    }

    // A new token replaces the old one, so the old link stops working
    const token = newInviteToken();
    const expiresAt = inviteExpiresAt();
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          inviteToken: hashInviteToken(token),
          inviteExpiresAt: expiresAt,
        },
      });
      await this.audit.record(tx, auth.userId, {
        entityType: 'user',
        entityId: user.id,
        action: 'update',
        before: { inviteExpiresAt: user.inviteExpiresAt },
        after: { inviteExpiresAt: expiresAt },
        reason: 'New invite link issued',
      });
    });

    // Email after the save (D-64); the link can always be copied (FR-UA-2)
    const link = inviteLink(this.webUrl, user.language, token);
    const emailSent = user.email
      ? await this.mail.send(
          user.email,
          { kind: 'invite', link, companyName: user.company.name },
          user.language as MailLanguage,
        )
      : false;

    return { inviteLink: link, inviteExpiresAt: expiresAt, emailSent };
  }

  /**
   * PATCH /users/:id (UA-07, FR-UA-7): change the role. Taking the Admin role from the last
   * Active Admin is refused (FR-UA-9).
   */
  async changeRole(auth: AuthContext, userId: string, input: UpdateUserInput) {
    return this.lastAdminSafe(async (tx) => {
      const user = await this.findOrThrow(tx, userId);
      if (user.role === input.role) return user;

      if (user.role === 'admin' && user.status === 'active') {
        await this.assertAnotherActiveAdmin(tx, user.id);
      }
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { role: input.role },
        select: PUBLIC_USER,
      });
      await this.audit.record(tx, auth.userId, {
        entityType: 'user',
        entityId: user.id,
        action: 'update',
        before: { role: user.role },
        after: { role: updated.role },
      });
      return updated;
    });
  }

  /**
   * POST /users/:id/deactivate (FR-UA-8, FR-UA-9): the login stops working at once and every
   * session ends. The employee record is never touched. Never the last Active Admin.
   */
  async deactivate(auth: AuthContext, userId: string) {
    return this.lastAdminSafe(async (tx) => {
      const user = await this.findOrThrow(tx, userId);
      if (user.status === 'deactivated') return user;

      if (user.role === 'admin' && user.status === 'active') {
        await this.assertAnotherActiveAdmin(tx, user.id);
      }
      const updated = await tx.user.update({
        where: { id: user.id },
        // An open link must not bring the account back
        data: {
          status: 'deactivated',
          inviteToken: null,
          inviteExpiresAt: null,
        },
        select: PUBLIC_USER,
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, auth.userId, {
        entityType: 'user',
        entityId: user.id,
        action: 'update',
        before: { status: user.status },
        after: { status: 'deactivated' },
      });
      return updated;
    });
  }

  /**
   * POST /users/:id/activate (FR-UA-8): switch a login back on. Someone who never set a
   * password goes back to Invited and needs a new link.
   */
  async activate(auth: AuthContext, userId: string) {
    return this.tenantPrisma.db.$transaction(async (tx) => {
      const user = await this.findOrThrow(tx, userId);
      if (user.status !== 'deactivated') return user;

      const row = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      const status: UserStatus = row.passwordHash ? 'active' : 'invited';
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { status },
        select: PUBLIC_USER,
      });
      await this.audit.record(tx, auth.userId, {
        entityType: 'user',
        entityId: user.id,
        action: 'update',
        before: { status: 'deactivated' },
        after: { status },
      });
      return updated;
    });
  }

  /** This company's user, or 404 (another company's user is "not found", D-57) */
  private async findOrThrow(tx: UsersTx, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER,
    });
    if (!user) throw new NotFoundException({ message: 'notFound' });
    return user;
  }

  /** FR-UA-9: 409 lastActiveAdmin unless another Active Admin stays */
  private async assertAnotherActiveAdmin(tx: UsersTx, leavingUserId: string) {
    const others = await tx.user.count({
      where: { role: 'admin', status: 'active', id: { not: leavingUserId } },
    });
    if (others === 0) {
      throw new ConflictException({ message: 'lastActiveAdmin' });
    }
  }

  /**
   * Runs a change that may remove an Active Admin. Serializable: if two Admins demote each
   * other at the same moment, the database lets only one win, so one Admin always stays.
   */
  private async lastAdminSafe<T>(
    work: (tx: UsersTx) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.tenantPrisma.db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      // P2034: the database stopped one of two clashing changes; the person can try again
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException({ message: 'conflict' });
      }
      throw error;
    }
  }

  /** 409 when the email or phone already belongs to any user, in any company */
  private async assertFree(email?: string, phone?: string) {
    const errors: Record<string, string> = {};
    if (email && (await this.prisma.user.count({ where: { email } }))) {
      errors.email = 'emailTaken';
    }
    if (phone && (await this.prisma.user.count({ where: { phone } }))) {
      errors.phone = 'phoneTaken';
    }
    if (errors.email || errors.phone) {
      throw new ConflictException({
        message: errors.email ?? errors.phone,
        errors,
      });
    }
  }
}
