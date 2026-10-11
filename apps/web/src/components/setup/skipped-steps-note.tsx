import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SetupProgress } from './setup-progress';

/**
 * On the Settings page once setup is complete but some steps were skipped (D-74): the dashboard
 * banner is gone by then, so this is the way back. Opens the first skipped step in /setup;
 * saving it there marks it done (a save on this page never changes setup progress).
 */
export default async function SkippedStepsNote({
  progress,
}: {
  progress: SetupProgress;
}) {
  const skipped = progress.steps.filter((s) => s.status === 'skipped');
  if (!progress.complete || skipped.length === 0) return null;
  const t = await getTranslations('Setup.skipped');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2 text-sm">
      <p className="min-w-0 flex-1">{t('body', { count: skipped.length })}</p>
      <Link
        href={`/setup?step=${skipped[0].key}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-accent-fg hover:bg-canvas"
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
