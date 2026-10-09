import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/app-shell';
import { CurrentUserProvider } from '@/components/shell/current-user';
import { ExceptionsProvider } from '@/components/exceptions/exceptions-store';
import { getSession } from '@/lib/session';
import { PATHNAME_HEADER } from '@/lib/request-path';

/**
 * Pages inside the app (route group, no effect on URLs).
 * The gate (SCRUM-169): runs on the Next.js server before anything is rendered, so a visitor
 * without a live session never receives a private page; they go to login and come back after.
 */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const session = await getSession();

  if (!session.user) {
    // "/en/exceptions?x=1" → "/exceptions?x=1": the login form adds the language again
    const asked = (await headers()).get(PATHNAME_HEADER) ?? '/';
    const next = asked.replace(new RegExp(`^/${locale}(?=/|\\?|$)`), '') || '/';
    const query = new URLSearchParams({ next });
    if (session.reason === 'sessionExpired') query.set('reason', 'expired');
    redirect(`/${locale}/login?${query.toString()}`);
  }

  return (
    <CurrentUserProvider user={session.user}>
      <ExceptionsProvider>
        <AppShell>{children}</AppShell>
      </ExceptionsProvider>
    </CurrentUserProvider>
  );
}
