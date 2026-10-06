import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { LoginInput, SignUpInput } from '@mdarj/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashSessionToken, newSessionToken } from './session-token.js';

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
  constructor(private readonly prisma: PrismaService) {}

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
  async login(input: LoginInput, client: { ip?: string; userAgent?: string }) {
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
}
