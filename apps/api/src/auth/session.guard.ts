// Protects a route: only requests with a live session get through (D-24).
// The session itself is checked earlier, in sessionMiddleware, which sets req.auth.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE } from './session-token.js';

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.auth) {
      return true;
    }
    // A cookie that didn't lead to a live session means it expired or was logged out
    const hadCookie = typeof req.cookies?.[SESSION_COOKIE] === 'string';
    throw new UnauthorizedException({
      message: hadCookie ? 'sessionExpired' : 'notLoggedIn',
    });
  }
}
