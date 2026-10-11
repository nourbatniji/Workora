// Invite links (UA-01, FR-UA-1, D-65): like session tokens, the link carries a random token and the
// database stores only its SHA-256 hash in users.invite_token. A copy of the database can't be used to log in.
import { createHash, randomBytes } from 'node:crypto';

/** An invite link works for 7 days (FR-UA-1) */
export const INVITE_VALID_DAYS = 7;
const INVITE_VALID_MS = INVITE_VALID_DAYS * 24 * 60 * 60 * 1000;

/** 32 random bytes: impossible to guess */
export function newInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What users.invite_token stores instead of the token itself */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** When a link made now stops working */
export function inviteExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + INVITE_VALID_MS);
}

/** A password reset link from the email works for 1 hour (D-68) */
export const RESET_VALID_HOURS = 1;
export const RESET_VALID_MS = RESET_VALID_HOURS * 60 * 60 * 1000;

/** The page the person opens: http://localhost:3000/ar/set-password?token=… */
export function inviteLink(
  webUrl: string,
  language: string,
  token: string,
): string {
  return `${webUrl.replace(/\/+$/, '')}/${language}/set-password?token=${token}`;
}
