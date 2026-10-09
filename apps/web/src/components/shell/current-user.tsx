'use client';

// The logged-in user, handed down from the (app) layout, which asked the API on the server (SCRUM-169)
import { createContext, useContext } from 'react';
import type { CurrentUser, Role } from '@/lib/session';
import { useAppState } from './app-state';

const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext);
  if (!user)
    throw new Error('useCurrentUser must be used inside the (app) layout');
  return user;
}

/**
 * The role the screens follow: the real one, unless the development-only switch
 * previews another. Production builds never set a preview, so this is always the real role there.
 * Hiding things here is only for a tidy screen: the API checks every request itself (SCRUM-33).
 */
export function useRole(): Role {
  const user = useCurrentUser();
  const { previewRole } = useAppState();
  return previewRole ?? user.role;
}
