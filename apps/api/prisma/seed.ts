// Seed: one demo company with its first Admin (FND-02, SCRUM-21).
// Safe to run more than once: every row is upserted, never duplicated.
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DEMO_COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const SETTINGS_EFFECTIVE_FROM = new Date('2026-01-01T00:00:00Z');

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.mdarj.test';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const company = await prisma.company.upsert({
    where: { id: DEMO_COMPANY_ID },
    update: {},
    create: {
      id: DEMO_COMPANY_ID,
      name: 'MDARJ Demo Company',
      timeZone: 'Africa/Cairo',
      currency: 'EGP',
    },
  });

  // First settings version (FR-CS-8, D-27). Rest days use JavaScript day numbers: 5 = Friday, 6 = Saturday.
  await prisma.companySettingsVersion.upsert({
    where: {
      companyId_effectiveFrom: {
        companyId: company.id,
        effectiveFrom: SETTINGS_EFFECTIVE_FROM,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      effectiveFrom: SETTINGS_EFFECTIVE_FROM,
      restDays: [5, 6],
      latenessPolicy: { mode: 'exact' },
      ipAllowList: [],
    },
  });

  // Argon2id password hash (D-24). Re-running the seed resets the Admin's password to SEED_ADMIN_PASSWORD.
  const passwordHash = await hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Demo Admin',
      passwordHash,
      status: 'active',
    },
    create: {
      companyId: company.id,
      name: 'Demo Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      status: 'active',
      language: 'ar',
    },
  });

  console.log(`Seeded company "${company.name}" (${company.id})`);
  console.log(`Seeded Admin ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
