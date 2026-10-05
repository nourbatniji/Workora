import * as rootParams from 'next/root-params';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async () => {
  // 1. Read the language from the address: /ar/... → 'ar'
  const locale = await rootParams.locale();

  // 2. Unknown language, like /fr? Show "page not found"
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // 3. Load that language's translation file
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});