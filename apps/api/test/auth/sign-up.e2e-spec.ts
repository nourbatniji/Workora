// CS-01 / FR-CS-1: sign-up creates the company and its first Admin; a used email is refused.
// Needs the local database: pnpm db:up
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('Company sign-up (CS-01, FR-CS-1)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique names for every run, so tests never clash with your own data
  const companyName = `Test Bakery ${randomUUID()}`;
  const email = `owner-${randomUUID()}@test.mdarj`;

  // Start the real app once
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  // Remove everything the tests created
  afterAll(async () => {
    const companies = await prisma.company.findMany({
      where: { name: { startsWith: companyName } },
      select: { id: true },
    });
    const ids = { in: companies.map((c) => c.id) };
    await prisma.user.deleteMany({ where: { companyId: ids } });
    await prisma.companySettingsVersion.deleteMany({
      where: { companyId: ids },
    });
    await prisma.company.deleteMany({ where: { id: ids } });
    await app.close();
  });

  const signUp = (body: object) =>
    request(app.getHttpServer()).post('/auth/sign-up').send(body);

  it('creates the company, its first settings and its first Admin', async () => {
    const res = await signUp({
      companyName,
      name: 'Mona',
      email: email.toUpperCase(), // must be saved lowercased
      password: 'secret123',
    }).expect(201);

    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Mona',
      email,
      role: 'admin',
      language: 'en',
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.companyId).toBe(res.body.company.id);
    expect(user.status).toBe('active');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(
      await prisma.companySettingsVersion.count({
        where: { companyId: user.companyId },
      }),
    ).toBe(1);
  });

  it('refuses an email that is already used, and creates nothing', async () => {
    const res = await signUp({
      companyName: `${companyName} 2`,
      name: 'Someone',
      email,
      password: 'another123',
    }).expect(409);

    expect(res.body.errors).toEqual({ email: 'emailTaken' });
    // The transaction rolled back: "… 2" was never saved
    expect(
      await prisma.company.count({
        where: { name: { startsWith: companyName } },
      }),
    ).toBe(1);
  });

  it('refuses bad data with one error key per field', async () => {
    const res = await signUp({
      companyName: '  ',
      email: 'mona@',
      password: '123',
    }).expect(400);

    expect(res.body.errors).toEqual({
      companyName: 'required',
      name: 'required',
      email: 'emailInvalid',
      password: 'passwordTooShort',
    });
  });
});
