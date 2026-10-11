// UA-07 (SCRUM-35) and UA-10 (SCRUM-144): several Admins; change a role, switch a login off and
// on; a company always keeps at least one Active Admin (FR-UA-9). Switching a login off never
// touches the employee record (FR-UA-8). Needs the local database and Mailpit: pnpm db:up
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { setupRoleBrowsers, type RoleBrowsers } from '../auth/role-browsers.js';

describe(
  'Manage users (UA-07 SCRUM-35, UA-10 SCRUM-144)',
  { timeout: 15_000 },
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let r: RoleBrowsers;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      setupApp(app);
      await app.init();
      prisma = app.get(PrismaService);
    }, 30_000);

    // A fresh company per test: these tests remove Admins and switch logins off
    beforeEach(async () => {
      r = await setupRoleBrowsers(app);
    }, 30_000);

    afterEach(async () => {
      await r.cleanup();
    });

    afterAll(async () => {
      await app.close();
    });

    const server = () => request(app.getHttpServer());

    /** Invites someone and accepts the link: an Active user, logged in, in r's company */
    async function activeUser(role: 'admin' | 'employee' | 'interviewer') {
      const email = `${role}-${randomUUID()}@manage.test`;
      const created = await r.admin
        .post('/users')
        .send({ name: `New ${role}`, email, role })
        .expect(201);
      const token = new URL(created.body.inviteLink).searchParams.get('token')!;
      const browser = request.agent(app.getHttpServer());
      await browser
        .post(`/auth/invites/${token}/accept`)
        .send({ password: 'manage-pass-1' })
        .expect(200);
      return { id: created.body.user.id as string, email, browser };
    }

    /** The user id of r's Admin and r's Employee */
    async function userIdOf(role: 'admin' | 'employee') {
      const user = await prisma.user.findFirstOrThrow({
        where: {
          companyId: r.companyId,
          role,
          email: { endsWith: '@roles.test' },
        },
      });
      return user.id;
    }

    it('lets an Admin invite a second Admin with full access (UA-07)', async () => {
      const second = await activeUser('admin');
      await second.browser.get('/users').expect(200);
      await second.browser
        .post('/users')
        .send({
          name: 'By second',
          email: `x-${randomUUID()}@manage.test`,
          role: 'employee',
        })
        .expect(201);
    });

    it('changes a role and records it', async () => {
      const employeeId = await userIdOf('employee');
      const res = await r.admin
        .patch(`/users/${employeeId}`)
        .send({ role: 'interviewer' })
        .expect(200);
      expect(res.body.role).toBe('interviewer');

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityType: 'user', entityId: employeeId, action: 'update' },
      });
      expect(audit.before).toEqual({ role: 'employee' });
      expect(audit.after).toEqual({ role: 'interviewer' });
    });

    it('never removes the last Active Admin (FR-UA-9)', async () => {
      const adminId = await userIdOf('admin');

      const demote = await r.admin
        .patch(`/users/${adminId}`)
        .send({ role: 'employee' })
        .expect(409);
      expect(demote.body).toEqual({ message: 'lastActiveAdmin' });

      const off = await r.admin
        .post(`/users/${adminId}/deactivate`)
        .expect(409);
      expect(off.body).toEqual({ message: 'lastActiveAdmin' });

      // Still an Active Admin
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: adminId },
      });
      expect(row.role).toBe('admin');
      expect(row.status).toBe('active');
    });

    it('does not count an Admin who has not accepted the invite yet', async () => {
      await r.admin
        .post('/users')
        .send({
          name: 'Pending admin',
          email: `p-${randomUUID()}@manage.test`,
          role: 'admin',
        })
        .expect(201);
      const adminId = await userIdOf('admin');
      await r.admin
        .patch(`/users/${adminId}`)
        .send({ role: 'employee' })
        .expect(409);
    });

    it('allows removing an Admin when another Active Admin stays', async () => {
      const second = await activeUser('admin');
      const firstId = await userIdOf('admin');

      // The second Admin takes the Admin role from the first
      await second.browser
        .patch(`/users/${firstId}`)
        .send({ role: 'employee' })
        .expect(200);
      // Now the second is the last one
      await second.browser.post(`/users/${second.id}/deactivate`).expect(409);
    });

    it('switches a login off at once, and never touches the employee record (FR-UA-8)', async () => {
      const employeeUserId = await userIdOf('employee');
      const before = await prisma.employee.findUniqueOrThrow({
        where: { id: r.ownEmployeeId },
      });

      const res = await r.admin
        .post(`/users/${employeeUserId}/deactivate`)
        .expect(200);
      expect(res.body.status).toBe('deactivated');

      // Logged out everywhere, and can't log in again
      await r.employee.get('/auth/me').expect(401);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: employeeUserId },
      });
      const login = await server()
        .post('/auth/login')
        .send({ identifier: user.email, password: 'role-pass1' })
        .expect(403);
      expect(login.body).toEqual({ message: 'accountDeactivated' });

      // The employee record is exactly as it was
      const after = await prisma.employee.findUniqueOrThrow({
        where: { id: r.ownEmployeeId },
      });
      expect(after).toEqual(before);
    });

    it('kills an open invite link when the login is switched off', async () => {
      const created = await r.admin
        .post('/users')
        .send({
          name: 'Never came',
          email: `n-${randomUUID()}@manage.test`,
          role: 'employee',
        })
        .expect(201);
      const token = new URL(created.body.inviteLink).searchParams.get('token')!;
      await r.admin
        .post(`/users/${created.body.user.id}/deactivate`)
        .expect(200);
      await server().get(`/auth/invites/${token}`).expect(404);
    });

    it('switches a login back on: Active with a password, Invited without', async () => {
      const withPassword = await userIdOf('employee');
      await r.admin.post(`/users/${withPassword}/deactivate`).expect(200);
      const on = await r.admin
        .post(`/users/${withPassword}/activate`)
        .expect(200);
      expect(on.body.status).toBe('active');

      const created = await r.admin
        .post('/users')
        .send({
          name: 'No password',
          email: `np-${randomUUID()}@manage.test`,
          role: 'employee',
        })
        .expect(201);
      await r.admin
        .post(`/users/${created.body.user.id}/deactivate`)
        .expect(200);
      const back = await r.admin
        .post(`/users/${created.body.user.id}/activate`)
        .expect(200);
      expect(back.body.status).toBe('invited');
    });

    it('checks the role', async () => {
      const employeeId = await userIdOf('employee');
      const res = await r.admin
        .patch(`/users/${employeeId}`)
        .send({ role: 'owner' })
        .expect(400);
      expect(res.body.errors).toEqual({ role: 'roleInvalid' });
    });

    it("is for Admins only, and another company's users are not found", async () => {
      const employeeId = await userIdOf('employee');
      for (const [method, path, body] of [
        ['patch', `/users/${employeeId}`, { role: 'interviewer' }],
        ['post', `/users/${employeeId}/deactivate`, undefined],
        ['post', `/users/${employeeId}/activate`, undefined],
      ] as const) {
        await r.anonymous()[method](path).send(body).expect(401);
        await r.employee[method](path).send(body).expect(403);
        await r.interviewer[method](path).send(body).expect(403);
      }

      const other = await setupRoleBrowsers(app);
      try {
        await other.admin.post(`/users/${employeeId}/deactivate`).expect(404);
        await other.admin
          .patch(`/users/${employeeId}`)
          .send({ role: 'admin' })
          .expect(404);
      } finally {
        await other.cleanup();
      }
    });
  },
);
