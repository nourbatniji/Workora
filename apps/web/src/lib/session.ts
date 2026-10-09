// Who is logged in, asked on the Next.js server (SCRUM-169, D-56).
// Server code only: it reads the browser's cookie and forwards it to the API.
// The API decides; the web app never reads or checks the session token itself.
import { cookies } from 'next/headers';
import { cache } from 'react';

export type Role = 'admin' | 'employee' | 'interviewer';

/** The answer of GET /auth/me */
export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  language: string;
  company: { id: string; name: string };
};

export type Session =
  | { user: CurrentUser }
  | { user: null; reason: 'notLoggedIn' | 'sessionExpired' };

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Asks the API who owns the cookie. cache(): one API call per page request,
 * however many server components ask.
 */
export const getSession = cache(async (): Promise<Session> => {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader.includes('mdarj_session=')) {
    return { user: null, reason: 'notLoggedIn' };
  }

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store', // never reuse another visitor's answer
  });

  if (res.ok) {
    const body = (await res.json()) as { user: CurrentUser };
    return { user: body.user };
  }
  if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      user: null,
      reason:
        body?.message === 'sessionExpired' ? 'sessionExpired' : 'notLoggedIn',
    };
  }
  // The API is down or broken: show the error page, never a page without a user
  throw new Error(`GET /auth/me answered ${res.status}`);
});

/** Only paths inside our own site, so a link can't send a user to another website after login */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string') return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return '/';
  return next;
}
