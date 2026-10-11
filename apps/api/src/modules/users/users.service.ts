// Users and invites (UA-01, FR-UA-1, FR-UA-2, FR-UA-7). The Admin creates a user; the person
// gets a 7-day link to set a password. Account status (invited/active/deactivated) is the
// login's status only, never the employee's (FR-UA-8).
import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CreateUserInput, ListUsersQuery } from '@mdarj/shared';
import { Prisma } from '../../generated/prisma/client.js';
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
