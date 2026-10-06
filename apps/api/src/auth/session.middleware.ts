// Runs on every request, before Nest's guards and routes (D-24, D-25).
// A live session cookie → req.auth is set and the rest of the request runs inside the company badge.
// No cookie or a dead session → the request continues without req.auth; SessionGuard refuses protected routes.
import type { NextFunction, Request, Response } from 'express';
import { runInCompany } from '../common/tenancy/tenant-context.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  SESSION_COOKIE,
  SESSION_IDLE_MS,
  hashSessionToken,
} from './session-token.js';

export function sessionMiddleware(prisma: PrismaService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token: unknown = req.cookies?.[SESSION_COOKIE];
      if (typeof token !== 'string' || token === '') {
        return next();
      }

      // Find the session by the token's hash (the database never holds the token itself)
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        include: { user: { select: { status: true, role: true } } },
      });

      // Unknown, logged out, idle more than 12 hours, or the account was switched off
      const now = Date.now();
      if (
        !session ||
        session.revokedAt !== null ||
        now - session.lastSeenAt.getTime() > SESSION_IDLE_MS ||
        session.user.status !== 'active'
      ) {
        return next();
      }

      // This request counts as activity, so the 12 hours start again
      await prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now) },
      });

      req.auth = {
        sessionId: session.id,
        userId: session.userId,
        companyId: session.companyId,
        role: session.user.role,
      };

      // Everything after this line (guards, pipes, the route) runs with the company badge on
      void runInCompany(session.companyId, async () => next());
    } catch (error) {
      next(error);
    }
  };
}
