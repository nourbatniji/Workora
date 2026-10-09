// The "own" cells of permissions.md: an Employee may reach only their own employee record.
// Route guards only know the role; the employee id is known in the service, so services call this.
import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from './auth-context.js';

/**
 * Allows Admins (any employee of their company) and an Employee asking for their own record.
 * Everyone else gets 403 forbidden (D-57, D-62). Records of another company never get this far:
 * the tenancy guard already answers 404 for them.
 */
export function assertOwnEmployee(auth: AuthContext, employeeId: string): void {
  if (auth.role === 'admin') return;
  if (auth.role === 'employee' && auth.employeeId === employeeId) return;
  throw new ForbiddenException({ message: 'forbidden' });
}
