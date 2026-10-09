// Step 1 of every request: is someone logged in? (D-24)
// Registered for every route (SCRUM-33): only @Public() routes skip it.
// The session itself is checked earlier, in sessionMiddleware, which sets req.auth.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from './public.decorator.js';
import { SESSION_COOKIE } from './session-token.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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
