import { getTranslations } from 'next-intl/server';
import AuthLanguageLink from '@/components/auth/auth-language-link';
import LogoMark from '@/components/shell/logo-mark';
import { Card } from '@/components/ui/card';

/** Sign-up, login and password pages: no sidebar, one centered card (route group, no effect on URLs) */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('Shell');

  return (
    <div className="flex min-h-dvh flex-col px-4 py-4 md:py-6">
      {/* Switch language before logging in */}
      <div className="flex justify-end">
        <AuthLanguageLink />
      </div>

      <main
        id="main"
        className="flex flex-1 flex-col items-center justify-center py-8"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-medium text-text">{t('appName')}</span>
        </div>
        <Card as="div" className="h-auto w-full max-w-md">
          {children}
        </Card>
      </main>
    </div>
  );
}
