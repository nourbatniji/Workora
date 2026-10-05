import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Run on every page, but not on files like images or Next.js internals
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};