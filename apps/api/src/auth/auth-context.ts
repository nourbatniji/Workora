// Who is making the request. The session guard fills it in; routes read it from req.auth.
import type { UserRole } from '../generated/prisma/client.js';

export interface AuthContext {
  sessionId: string;
  userId: string;
  companyId: string;
  role: UserRole;
}

// Teach TypeScript that Express requests can carry req.auth
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
