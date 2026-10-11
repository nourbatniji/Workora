import { X } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import AuthLanguageLink from '@/components/auth/auth-language-link';
import LogoMark from '@/components/shell/logo-mark';
import { Link } from '@/i18n/navigation';
import { PATHNAME_HEADER } from '@/lib/request-path';
import { getSession } from '@/lib/session';

/**
 * The setup wizard's own screen (CS-02): no side menus, so the step gets the whole width.
 * The same login gate as the app (SCRUM-169): no session → log in, then come back here.
 */
export default async function OnboardingLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const session = await getSession();

  if (!session.user) {
    const asked = (await headers()).get(PATHNAME_HEADER) ?? '/setup';
    const next = asked.replace(new RegExp(`^/${locale}(?=/|\\?|$)`), '') || '/';
    const query = new URLSearchParams({ next });
    if (session.reason === 'sessionExpired') query.set('reason', 'expired');
    redirect(`/${locale}/login?${query.toString()}`);
  }

  const t = await getTranslations('Setup');
  const tShell = await getTranslations('Shell');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
          <LogoMark className="size-8" />
          <span className="text-base font-medium">{tShell('appName')}</span>
          <span className="hidden text-sm text-muted sm:inline">
            · {session.user.company.name}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <AuthLanguageLink />
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-muted hover:bg-surface hover:text-text"
            >
              <X className="size-4" strokeWidth={1.5} aria-hidden />
              <span className="hidden sm:inline">{t('exit')}</span>
              <span className="sr-only sm:hidden">{t('exit')}</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1 px-4 py-6 md:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}
