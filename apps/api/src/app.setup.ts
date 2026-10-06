// Settings every running app needs. main.ts and the e2e tests both call this, so tests run the real setup.
// Call it before app.init() / app.listen(), so these run before Nest's routes.
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { sessionMiddleware } from './auth/session.middleware.js';
import { PrismaService } from './prisma/prisma.service.js';

export function setupApp(app: INestApplication) {
  // 1. Read the Cookie header into req.cookies
  app.use(cookieParser());
  // 2. Find the session and put the company badge on (D-24, D-25)
  app.use(sessionMiddleware(app.get(PrismaService)));
}
