// SCRUM-167 / api-conventions.md §6, D-44: every error leaves the API as { message, errors? },
// where message is a key the web app translates — including Nest's own errors and crashes.
// Needs the local database: pnpm db:up
import { randomUUID } from 'node:crypto';
import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { Public } from '../../src/auth/public.decorator.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

// Routes that fail on purpose, added only in this test (public: this file tests errors, not login)
@Public()
@Controller('test-errors')
class FailingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('crash')
  crash() {
    throw new Error('something broke inside the server');
  }

  @Get('missing-row')
  async missingRow() {
    // Updating a row that does not exist → Prisma P2025
    await this.prisma.jobTitle.update({
      where: { id: randomUUID() },
      data: { nameEn: 'x' },
    });
  }
}

describe('One error shape for every response (SCRUM-167, D-44)', () => {
  let app: INestApplication<App>;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [FailingController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app);
    await app.init();
    Logger.overrideLogger(false); // keep the expected crash log out of the test output
  });

  afterAll(async () => {
    await app.close();
  });

  it('an unknown route → 404 { message: "notFound" }', async () => {
    const res = await request(server()).get('/no-such-route').expect(404);
    expect(res.body).toEqual({ message: 'notFound' });
  });

  it('broken JSON → 400 { message: "badRequest" }', async () => {
    const res = await request(server())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier": ')
      .expect(400);
    expect(res.body).toEqual({ message: 'badRequest' });
  });

  it('a validation failure keeps its key and per-field errors', async () => {
    const res = await request(server())
      .post('/auth/sign-up')
      .send({
        companyName: '',
        name: 'X',
        email: 'not-an-email',
        password: '1',
      })
      .expect(400);
    expect(res.body.message).toBe('validationFailed');
    expect(res.body.errors).toMatchObject({
      companyName: 'required',
      email: 'emailInvalid',
      password: 'passwordTooShort',
    });
    expect(res.body).not.toHaveProperty('statusCode');
  });

  it('an error we throw on purpose keeps its own key', async () => {
    const res = await request(server())
      .post('/auth/login')
      .send({
        identifier: `nobody-${randomUUID()}@x.test`,
        password: 'whatever1',
      })
      .expect(401);
    expect(res.body).toEqual({ message: 'invalidCredentials' });
  });

  it('not logged in → 401 { message: "notLoggedIn" }', async () => {
    const res = await request(server()).get('/auth/me').expect(401);
    expect(res.body).toEqual({ message: 'notLoggedIn' });
  });

  it('a row that does not exist (Prisma P2025) → 404 { message: "notFound" }', async () => {
    const res = await request(server())
      .get('/test-errors/missing-row')
      .expect(404);
    expect(res.body).toEqual({ message: 'notFound' });
  });

  it('a server crash → 500 { message: "internalError" }, with no inside details', async () => {
    const res = await request(server()).get('/test-errors/crash').expect(500);
    expect(res.body).toEqual({ message: 'internalError' });
    expect(JSON.stringify(res.body)).not.toContain('something broke');
  });
});
