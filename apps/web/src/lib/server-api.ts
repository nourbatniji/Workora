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
