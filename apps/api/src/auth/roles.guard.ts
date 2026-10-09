// Step 2 of every request: is this role allowed on this route? (permissions.md, SCRUM-33)
// Runs after SessionGuard, so req.auth is always set here, except on @Public routes.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/client.js';
import { IS_PUBLIC } from './public.decorator.js';
import { ROLES } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read the decorators from the method first, then from its controller class
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES,
      targets,
    );
    const role = context.switchToHttp().getRequest<Request>().auth?.role;

    // No @Roles on the route → nobody gets in (D-61). A forgotten line blocks, it never opens.
    if (!allowed || !role || !allowed.includes(role)) {
      throw new ForbiddenException({ message: 'forbidden' });
    }
    return true;
  }
}
