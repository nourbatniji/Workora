// @Roles(...): which roles may call a route (permissions.md, SCRUM-33).
// A route with no @Roles and no @Public is refused for everyone: deny by default (D-61).
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../generated/prisma/client.js';

export const ROLES = 'roles';

/** Every role: for routes any logged-in person may use, such as /auth/me */
export const ALL_ROLES: UserRole[] = ['admin', 'employee', 'interviewer'];

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);
