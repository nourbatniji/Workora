// Is an invite link still good? Asked on the Next.js server before the set-password page shows (UA-01).
// Public API route: no cookie is forwarded, the token in the link is all it needs.

/** The answer of GET /auth/invites/:token */
export type Invite = {
  user: {
    name: string | null;
    email: string | null;
    phone: string | null;
    language: string;
  };
  company: { name: string };
};

export type InviteCheck =
  | { invite: Invite }
  | { invite: null; reason: 'inviteInvalid' | 'inviteExpired' };

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function getInvite(
  token: string | undefined,
): Promise<InviteCheck> {
  if (!token) return { invite: null, reason: 'inviteInvalid' };

  const res = await fetch(
    `${API_URL}/auth/invites/${encodeURIComponent(token)}`,
    { cache: 'no-store' }, // a link can be used up at any moment
  );

  if (res.ok) return { invite: (await res.json()) as Invite };
  if (res.status === 404) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      invite: null,
      reason:
        body?.message === 'inviteExpired' ? 'inviteExpired' : 'inviteInvalid',
    };
  }
  // The API is down or broken: show the error page
  throw new Error(`GET /auth/invites/:token answered ${res.status}`);
}
