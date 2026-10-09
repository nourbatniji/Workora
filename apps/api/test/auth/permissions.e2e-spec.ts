// UA-05 (SCRUM-33): every route is private by default, each role reaches only what
// permissions.md allows, and an Employee reaches only their own record.
// Needs the local database: pnpm db:up
import { Controller, Get, INestApplication, Param, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { assertOwnEmployee } from '../../src/auth/own-data.js';
import { Public } from '../../src/auth/public.decorator.js';
import { ALL_ROLES, Roles } from '../../src/auth/roles.decorator.js';
import { setupRoleBrowsers, type RoleBrowsers } from './role-browsers.js';

// Routes added only in this test, one per kind of rule
@Controller('test-permissions')
class PermissionsTestController {
  @Get('public')
  @Public()
  open() {
    return { ok: true };
  }

  // No @Roles and no @Public: a forgotten line
  @Get('forgot-roles')
  forgotRoles() {
    return { ok: true };
  }

  @Get('admin-only')
  @Roles('admin')
  adminOnly() {
    return { ok: true };
  }

  @Get('any-role')
  @Roles(...ALL_ROLES)
  anyRole() {
    return { ok: true };
  }

  // Like "view an employee profile": Admin all, Employee own, Interviewer no
  @Get('employees/:id')
  @Roles('admin', 'employee')
  profile(@Req() req: Request, @Param('id') id: string) {
    assertOwnEmployee(req.auth!, id);
    return { ok: true };
  }
}

describe('Roles and permissions (UA-05, SCRUM-33)', () => {
  let app: INestApplication<App>;
  let r: RoleBrowsers;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PermissionsTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    r = await setupRoleBrowsers(app);
  });

  afterAll(async () => {
    await r.cleanup();
    await app.close();
  });

  describe('private by default (401 with no session)', () => {
    it('lets anyone reach a @Public route', async () => {
      await r.anonymous().get('/test-permissions/public').expect(200);
    });

    it.each(['forgot-roles', 'admin-only', 'any-role'])(
      'refuses /%s with no session',
      async (path) => {
        const res = await r
          .anonymous()
          .get(`/test-permissions/${path}`)
          .expect(401);
        expect(res.body).toEqual({ message: 'notLoggedIn' });
      },
    );

    it('refuses /auth/me with no session', async () => {
      await r.anonymous().get('/auth/me').expect(401);
    });
  });

  describe('deny by default (D-61)', () => {
    it('refuses a route with no @Roles for every role, even Admin', async () => {
      for (const browser of [r.admin, r.employee, r.interviewer]) {
        const res = await browser
          .get('/test-permissions/forgot-roles')
          .expect(403);
        expect(res.body).toEqual({ message: 'forbidden' });
      }
    });
  });

  describe('role rules (403 for the wrong role)', () => {
    it('lets an Admin reach an Admin-only route', async () => {
      await r.admin.get('/test-permissions/admin-only').expect(200);
    });

    it('refuses an Employee and an Interviewer on an Admin-only route', async () => {
      for (const browser of [r.employee, r.interviewer]) {
        const res = await browser
          .get('/test-permissions/admin-only')
          .expect(403);
        expect(res.body).toEqual({ message: 'forbidden' });
      }
    });

    it('lets every role reach an all-roles route and /auth/me', async () => {
      for (const browser of [r.admin, r.employee, r.interviewer]) {
        await browser.get('/test-permissions/any-role').expect(200);
        await browser.get('/auth/me').expect(200);
      }
    });
  });

  describe('own data (403 for someone else’s record)', () => {
    it('lets an Employee open their own record', async () => {
      await r.employee
        .get(`/test-permissions/employees/${r.ownEmployeeId}`)
        .expect(200);
    });

    it("refuses an Employee another employee's record", async () => {
      const res = await r.employee
        .get(`/test-permissions/employees/${r.otherEmployeeId}`)
        .expect(403);
      expect(res.body).toEqual({ message: 'forbidden' });
    });

    it('lets an Admin open any employee of the company', async () => {
      await r.admin
        .get(`/test-permissions/employees/${r.otherEmployeeId}`)
        .expect(200);
    });

    it('refuses an Interviewer before the record is even looked at', async () => {
      await r.interviewer
        .get(`/test-permissions/employees/${r.ownEmployeeId}`)
        .expect(403);
    });
  });
});
