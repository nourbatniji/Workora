import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { tenancyExtension } from '../src/common/tenancy/tenancy.extension.js';
import { runInCompany } from '../src/common/tenancy/tenant-context.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Prisma WITH the guard plugged in
const guarded = prisma.$extends(tenancyExtension);

const demo = await prisma.company.findFirstOrThrow({
  where: { name: 'MDARJ Demo Company' },
});
const second = await prisma.company.findFirstOrThrow({
  where: { name: 'Second Company' },
});

// A. Demo Company badge, NO filter written
const asDemo = await runInCompany(
  demo.id,
  async () => await guarded.jobTitle.findMany(),
);
console.log(
  'Demo badge:',
  asDemo.map((j) => j.nameEn),
);

// B. Second Company badge, NO filter written
const asSecond = await runInCompany(
  second.id,
  async () => await guarded.jobTitle.findMany(),
);
console.log(
  'Second badge:',
  asSecond.map((j) => j.nameEn),
);

// C. No badge at all
try {
  await guarded.jobTitle.findMany();
} catch (error) {
  console.log('No badge:', (error as Error).message);
}

await prisma.$disconnect();
