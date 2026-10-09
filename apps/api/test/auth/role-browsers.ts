// Permission test helper (SCRUM-33): one company with a logged-in browser per role.
// Every feature's permission tests reuse it to prove: no session → 401, wrong role → 403,
// right role → allowed, someone else's record → 403. Needs the local database: pnpm db:up
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { UserRole } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export interface RoleBrowsers {
  companyId: string;
  /** No cookie at all */
  anonymous: () => request.Agent;
  admin: request.Agent;
  /** An Employee whose login is linked to ownEmployeeId */
  employee: request.Agent;
  interviewer: request.Agent;
  /** The employee record of the logged-in Employee */
  ownEmployeeId: string;
  /** Another employee of the same company */
  otherEmployeeId: string;
  cleanup(): Promise<void>;
}

const password = 'role-pass1';

export async function setupRoleBrowsers(
  app: INestApplication<App>,
): Promise<RoleBrowsers> {
  const prisma = app.get(PrismaService);
  const server = app.getHttpServer();
  const run = randomUUID();

  // 1. A company and its Admin, through the real sign-up
  const signUp = await request(server)
    .post('/auth/sign-up')
    .send({
      companyName: `Roles Test ${run}`,
      name: 'Role Admin',
      email: `admin-${run}@roles.test`,
      password,
    })
    .expect(201);
  const companyId: string = signUp.body.company.id;

  // 2. Two employee records
  const newEmployee = (code: string) =>
    prisma.employee.create({
      data: {
        companyId,
        code,
        nameAr: 'موظف تجريبي',
        nameEn: `Employee ${code}`,
        employmentType: 'full_time',
        hireDate: new Date('2026-01-01T00:00:00Z'),
      },
    });
  const ownEmployeeId = (await newEmployee('R-001')).id;
  const otherEmployeeId = (await newEmployee('R-002')).id;

  // 3. An Employee login (linked to R-001) and an Interviewer login
  const passwordHash = await hash(password);
  const newUser = (role: UserRole, employeeId?: string) =>
    prisma.user.create({
      data: {
        companyId,
        email: `${role}-${run}@roles.test`,
        passwordHash,
        role,
        status: 'active',
        employeeId,
      },
    });
  await newUser('employee', ownEmployeeId);
  await newUser('interviewer');

  // 4. One browser per role, each keeping its own session cookie
  const loggedIn = async (role: UserRole) => {
    const browser = request.agent(server);
    await browser
      .post('/auth/login')
      .send({ identifier: `${role}-${run}@roles.test`, password })
      .expect(200);
    return browser;
  };

  return {
    companyId,
    anonymous: () => request.agent(server),
    admin: await loggedIn('admin'),
    employee: await loggedIn('employee'),
    interviewer: await loggedIn('interviewer'),
    ownEmployeeId,
    otherEmployeeId,
    async cleanup() {
      await prisma.session.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.companySettingsVersion.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    },
  };
}
