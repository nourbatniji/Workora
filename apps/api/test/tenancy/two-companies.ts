// Test helper for company isolation (FND-03, D-25).
// Creates two companies, gives the tests a guarded client, and removes everything afterwards.
// Every later module reuses it to prove company B cannot reach company A's rows.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { runInCompany } from '../../src/common/tenancy/tenant-context.js';
import {
  withTenancy,
  type TenantPrismaClient,
} from '../../src/prisma/tenant-prisma.service.js';

export interface TwoCompanies {
  /** Plain client with no guard: only for preparing and checking test data. */
  prisma: PrismaClient;
  /** Guarded client: the same one modules use. */
  db: TenantPrismaClient;
  companyA: string;
  companyB: string;
  /** Runs fn with Company A's badge on. */
  asA<T>(fn: () => Promise<T>): Promise<T>;
  /** Runs fn with Company B's badge on. */
  asB<T>(fn: () => Promise<T>): Promise<T>;
  cleanup(): Promise<void>;
}

export async function setupTwoCompanies(): Promise<TwoCompanies> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const companyA = randomUUID();
  const companyB = randomUUID();

  await prisma.company.createMany({
    data: [
      { id: companyA, name: 'Test Company A' },
      { id: companyB, name: 'Test Company B' },
    ],
  });

  return {
    prisma,
    db: withTenancy(prisma),
    companyA,
    companyB,
    asA: (fn) => runInCompany(companyA, fn),
    asB: (fn) => runInCompany(companyB, fn),
    async cleanup() {
      const both = { in: [companyA, companyB] };
      // Children first: the database refuses to delete a row others still point at
      await prisma.document.deleteMany({ where: { companyId: both } });
      await prisma.contract.updateMany({
        where: { companyId: both },
        data: { previousContractId: null },
      });
      await prisma.contract.deleteMany({ where: { companyId: both } });
      await prisma.employeeStatusHistory.deleteMany({
        where: { companyId: both },
      });
      await prisma.salaryHistory.deleteMany({ where: { companyId: both } });
      await prisma.companySettingsVersion.deleteMany({
        where: { companyId: both },
      });
      await prisma.session.deleteMany({ where: { companyId: both } });
      await prisma.user.deleteMany({ where: { companyId: both } });
      await prisma.employee.deleteMany({ where: { companyId: both } });
      await prisma.jobTitle.deleteMany({ where: { companyId: both } });
      await prisma.company.deleteMany({ where: { id: both } });
      await prisma.$disconnect();
    },
  };
}
