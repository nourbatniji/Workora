import { getTranslations } from 'next-intl/server';
import NotFoundCard from '@/components/not-found-card';
import LogoMark from '@/components/shell/logo-mark';

/** Outside the app shell (no menu): logo on top and the same card, like the login page */
export default async function LocaleNotFound() {
  const t = await getTranslations('Shell');
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-8"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark />
        <span className="text-lg font-medium text-text">{t('appName')}</span>
      </div>
      <NotFoundCard />
    </main>
  );
}
