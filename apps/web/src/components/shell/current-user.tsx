'use client';

// The logged-in user, handed down from the (app) layout, which asked the API on the server (SCRUM-169)
import { createContext, useContext } from 'react';
import type { CurrentUser, Role } from '@/lib/session';

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

/** The signed-in user's role. API permission checks remain authoritative. */
export function useRole(): Role {
  return useCurrentUser().role;
}
