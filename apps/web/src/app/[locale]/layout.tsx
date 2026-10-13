import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import {
  AppStateProvider,
  themeInitScript,
} from '@/components/shell/app-state';
import { InlineScript } from '@/components/inline-script';
import { dmSans, plexArabic } from '../fonts';
import '../globals.css';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Shell' });
  return { title: t('appName') };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  // 1. Which language? /ar → 'ar'
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // 2. Arabic goes right-to-left
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    // data-theme belongs to the head script and the theme toggle, never to React: if React rendered
    // it, switching language (which re-renders <html> with the new lang and dir) would put it back
    // to light. With no data-theme the page is light (globals.css :root), so nothing flashes.
    // suppressHydrationWarning: the script adds data-theme before React loads
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${dmSans.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={themeInitScript} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          {/* Theme for every page; the (app) and (auth) layouts add the rest */}
          <AppStateProvider>{children}</AppStateProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
