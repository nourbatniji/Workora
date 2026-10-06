// Session tokens (D-24): the browser cookie holds a random token; the database stores only its SHA-256 hash.
import { createHash, randomBytes } from 'node:crypto';

/** Name of the httpOnly cookie that carries the session token */
export const SESSION_COOKIE = 'mdarj_session';

/** A session ends after 12 hours with no requests (NFR-2) */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;

/** 32 random bytes: impossible to guess */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the sessions table stores instead of the token itself */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
