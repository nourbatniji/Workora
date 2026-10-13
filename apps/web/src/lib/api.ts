/** The shape of every API error (D-44): a message key, sometimes one key per field */
export type ApiError = { message: string; errors?: Record<string, string> };

/** POSTs JSON to the API through the /api proxy. Never throws: no connection comes back as status 0. */
export async function postJson<T = ApiError>(path: string, body?: unknown) {
  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data =
      res.status === 204
        ? null
        : ((await res.json().catch(() => null)) as T | null);
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

/** PATCHes JSON to the API through the /api proxy. Same answer shape as postJson; never throws */
export async function patchJson<T = ApiError>(path: string, body: unknown) {
  try {
    const res = await fetch(`/api${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}
