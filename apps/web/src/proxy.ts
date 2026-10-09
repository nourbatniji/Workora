import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { PATHNAME_HEADER } from './lib/request-path';

const handleI18nRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Server components can't read the URL, so pass it on as a request header.
  // This only picks the language and passes the path: it does NOT check login.
  // The login check runs in app/[locale]/(app)/layout.tsx, on the server (SCRUM-169).
  const headers = new Headers(request.headers);
  headers.set(
    PATHNAME_HEADER,
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return handleI18nRouting(new NextRequest(request, { headers }));
}

export const config = {
  // Run on every page, but not on files like images or Next.js internals
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
