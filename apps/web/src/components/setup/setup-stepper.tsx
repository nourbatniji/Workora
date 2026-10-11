import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { SetupStep } from '@mdarj/shared';
import { Link } from '@/i18n/navigation';
import { STEP_TITLE_KEY, type SetupProgress } from './setup-progress';

/**
 * The wizard's step tracker (CS-02): numbered circles joined by a line, like most setup flows.
 * Done = filled blue with a tick; skipped = dashed circle; the open step = blue ring.
 * Every step is a link. Labels show from tablet width up; on phones only the open step's
 * name is shown, above the tracker.
 */
export default async function SetupStepper({
  progress,
  step,
}: {
  progress: SetupProgress;
  step: SetupStep | undefined;
}) {
  const t = await getTranslations('Setup');
  const tSettings = await getTranslations('Settings');

  return (
    <nav aria-label={t('steps')}>
      <ol className="flex items-start">
        {progress.steps.map((s, i) => {
          const active = s.key === step;
          const last = i === progress.steps.length - 1;
          // The line after a step is blue once that step is done or skipped
          const lineDone = s.status !== 'todo';
          return (
            <li
              key={s.key}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* The line to the next step, from this circle's centre to the next one's */}
              {!last && (
                <span
                  aria-hidden
                  className={`absolute top-4 h-0.5 w-full translate-x-1/2 rtl:-translate-x-1/2 ${
                    lineDone ? 'bg-accent' : 'bg-line'
                  }`}
                />
              )}
              <Link
                href={`/setup?step=${s.key}`}
                aria-current={active ? 'step' : undefined}
                className="group relative flex flex-col items-center gap-2 px-1 text-center"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                    s.status === 'done'
                      ? 'bg-accent text-white'
                      : active
                        ? 'border-2 border-accent bg-surface text-accent-fg'
                        : s.status === 'skipped'
                          ? 'border border-dashed border-muted bg-surface text-muted'
                          : 'border border-line bg-surface text-muted group-hover:border-accent'
                  }`}
                >
                  {s.status === 'done' ? (
                    <Check className="size-4" strokeWidth={2} aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`hidden max-w-[7rem] text-xs leading-tight sm:block ${
                    active
                      ? 'font-medium text-text'
                      : 'text-muted group-hover:text-text'
                  }`}
                >
                  {tSettings(STEP_TITLE_KEY[s.key])}
                </span>
                <span className="sr-only">
                  {tSettings(STEP_TITLE_KEY[s.key])} · {t(`status.${s.status}`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
