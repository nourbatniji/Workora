import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

/**
 * The "page not found" card: a wrong link, a page that moved, or a page this role can't open
 * (the server answers "not found" instead of revealing it exists, D-57).
 */
export default async function NotFoundCard() {
  const t = await getTranslations('NotFound');

  return (
    <Card as="div" className="mx-auto h-auto w-full max-w-xl text-center">
      <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs text-muted tabular-nums">
        404
      </span>
      <span className="mx-auto mt-5 flex size-12 items-center justify-center rounded-[14px] bg-nav-selected text-accent-fg">
        <Compass className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-medium text-text">{t('title')}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t('body')}</p>
      <div className="mt-6 flex justify-center">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('home')}
        </Link>
      </div>
    </Card>
  );
}
