import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import type { SignUpInput } from '@mdarj/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
}
