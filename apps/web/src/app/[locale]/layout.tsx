import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import AppShell from '@/components/shell/app-shell';
import {
  AppStateProvider,
  themeInitScript,
} from '@/components/shell/app-state';
import { ExceptionsProvider } from '@/components/exceptions/exceptions-store';
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
    // data-theme is set by the head script before paint, so React must not complain that it differs
    <html
      lang={locale}
      dir={dir}
      data-theme="light"
      suppressHydrationWarning
      className={`${dmSans.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={themeInitScript} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <AppStateProvider>
            <ExceptionsProvider>
              <AppShell>{children}</AppShell>
            </ExceptionsProvider>
          </AppStateProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
