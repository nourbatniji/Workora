import { PartyPopper } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SETUP_STEPS, type SetupStep } from '@mdarj/shared';
import type { CompanyProfile } from '@/components/settings/company-profile-card';
import type { JobTitle } from '@/components/settings/job-titles-card';
import type { SettingsVersion } from '@/components/settings/work-week-card';
import {
  STEP_TITLE_KEY,
  type SetupProgress,
} from '@/components/setup/setup-progress';
import SetupStepView from '@/components/setup/setup-step';
import SetupStepper from '@/components/setup/setup-stepper';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { serverGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/**
 * Setup wizard (CS-02, FR-CS-2, SCRUM-39). Admin only, on its own focused screen: a step
 * tracker on top, the current step's section below at a comfortable reading width.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('Setup');
  const tSettings = await getTranslations('Settings');
  const [progress, company, settings, jobTitles] = await Promise.all([
    serverGet<SetupProgress>('/company/setup'),
    serverGet<CompanyProfile>('/company'),
    serverGet<{
      today: string;
      earliestEffectiveFrom: string;
      items: SettingsVersion[];
    }>('/company/settings/versions'),
    serverGet<{ items: JobTitle[] }>('/job-titles'),
  ]);

  // Which step: the one in the address, else the first one still to do
  const { step: asked } = await searchParams;
  const fromUrl = SETUP_STEPS.find((s) => s === asked);
  const firstTodo = progress.steps.find((s) => s.status === 'todo')?.key;
  const step: SetupStep | undefined = fromUrl ?? firstTodo;
  const index = step ? SETUP_STEPS.indexOf(step) : -1;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-medium">
          {t('title', { company: company.name })}
        </h1>
        <p className="mt-2 text-sm text-muted">{t('intro')}</p>
      </div>

      <SetupStepper progress={progress} step={step} />

      {step === undefined ? (
        // Every step is done or skipped
        <Card className="py-10 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-nav-selected text-accent-fg">
            <PartyPopper className="size-7" strokeWidth={1.5} aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-medium">{t('allDoneTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {t('allDoneBody')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/settings"
              className="inline-flex h-10 items-center rounded-[10px] border border-line px-4 text-sm hover:bg-canvas"
            >
              {t('openSettings')}
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-white"
            >
              {t('toDashboard')}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-accent-fg uppercase">
            {t('stepOf', { n: index + 1, total: SETUP_STEPS.length })}
            <span className="text-muted normal-case">
              {' · '}
              {tSettings(STEP_TITLE_KEY[step])}
            </span>
          </p>
          <SetupStepView
            step={step}
            previous={SETUP_STEPS[index - 1] ?? null}
            next={SETUP_STEPS[index + 1] ?? null}
            company={company}
            timeZones={Intl.supportedValuesOf('timeZone')}
            earliestDate={settings.earliestEffectiveFrom}
            versions={settings.items}
            jobTitles={jobTitles.items}
          />
        </div>
      )}
    </div>
  );
}
