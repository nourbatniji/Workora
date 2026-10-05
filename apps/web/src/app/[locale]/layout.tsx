import MobileMenu from '@/components/mobile-menu';
import NavLinks from '@/components/nav-links';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import LanguageSwitcher from '@/components/language-switcher';
import '../globals.css';

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  // 1. Which language? /ar → 'ar'
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // 2. Arabic goes right-to-left
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  // 3. The shell's texts
  const t = await getTranslations('Shell');

  return (
    <html lang={locale} dir={dir} className="h-full antialiased">
      <body className="min-h-full">
        <NextIntlClientProvider>
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
            <div className="flex items-center gap-2">
              <MobileMenu />
              <span className="font-bold">{t('appName')}</span>
            </div>
            <LanguageSwitcher />
          </header>

          <div className="flex">
            <aside className="hidden w-56 shrink-0 border-e p-4 md:block">
              <NavLinks />
            </aside>
            <main className="min-w-0 flex-1 p-4">{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}