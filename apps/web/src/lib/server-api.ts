// Reads from the API on the Next.js server, as the logged-in user (D-56).
// Server code only: it forwards the browser's cookie; the API checks login and role itself.
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** GET a path from the API. Anything but 200 is an error page: the (app) layout already checked login. */
export async function serverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store', // always this user's current data
  });
  if (!res.ok) {
    throw new Error(`GET ${path} answered ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * GET a path and hand back the status instead of throwing, for pages that show their own error
 * state (a filter the API refuses → 400 → "these filters don't work", not a crash page).
 */
export async function serverGetResult<T>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}
