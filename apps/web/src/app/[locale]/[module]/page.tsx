import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Bookmark, Construction } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { NAV_ITEMS, SAVED_VIEWS, SOON_MODULES, type NavKey } from '@/lib/nav';
import { Card } from '@/components/ui/card';

/** Every module that isn't built yet lands here, clearly marked as next phase */
export default async function ComingSoonPage({
  params,
  searchParams,
}: PageProps<'/[locale]/[module]'>) {
  const { module } = await params;
  const { view } = await searchParams;
  if (!SOON_MODULES.includes(module as NavKey)) notFound();

  const t = await getTranslations('Soon');
  const tNav = await getTranslations('Nav');
  const tViews = await getTranslations('SavedViews');
  const item = NAV_ITEMS.find((n) => n.key === module)!;
  const Icon = item.icon;
  const savedView = SAVED_VIEWS.find((v) => v.href.endsWith(`view=${view}`));

  return (
    <Card className="mx-auto mt-6 max-w-xl text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">
        <Construction className="size-3.5" strokeWidth={1.5} aria-hidden />
        {t('badge')}
      </span>
      <span className="mx-auto mt-5 flex size-12 items-center justify-center rounded-[14px] bg-nav-selected text-accent-fg">
        <Icon className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-medium">
        {t('title', { module: tNav(item.key) })}
      </h2>
      {savedView && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-accent-fg">
          <Bookmark className="size-4" strokeWidth={1.5} aria-hidden />
          {t('savedView', { name: tViews(savedView.key) })}
        </p>
      )}
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t('body')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
        >
          <ArrowLeft
            className="size-4 rtl:-scale-x-100"
            strokeWidth={1.5}
            aria-hidden
          />
          {t('back')}
        </Link>
        <Link
          href="/exceptions"
          className="inline-flex h-9 items-center rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
        >
          {t('exceptions')}
        </Link>
      </div>
    </Card>
  );
}
