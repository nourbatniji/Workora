import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'en',
  // Always open English at "/"; don't follow the browser language or a saved cookie
  localeDetection: false,
});
