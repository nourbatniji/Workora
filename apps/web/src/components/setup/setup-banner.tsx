import { ArrowRight, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SetupProgress } from './setup-progress';

/** On the dashboard until every setup step is done or skipped (CS-02) */
export default async function SetupBanner({
  progress,
}: {
  progress: SetupProgress;
}) {
  if (progress.complete) return null;
  const t = await getTranslations('Setup.banner');
  const done = progress.steps.filter((s) => s.status !== 'todo').length;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[14px] border border-accent/30 bg-nav-selected/50 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-accent-fg">
        <Sparkles className="size-[18px]" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('title')}</p>
        <p className="text-xs text-muted">
          {t('body', { done, total: progress.steps.length })}
        </p>
      </div>
      <Link
        href="/setup"
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
      >
        {t('action')}
        <ArrowRight
          className="size-4 rtl:-scale-x-100"
          strokeWidth={1.5}
          aria-hidden
        />
      </Link>
    </div>
  );
}
