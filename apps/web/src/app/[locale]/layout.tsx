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
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <header className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-bold">{t('appName')}</span>
            <LanguageSwitcher />
          </header>
          <main className="flex-1 p-4">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}