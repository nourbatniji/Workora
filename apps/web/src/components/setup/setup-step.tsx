'use client';

import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { SetupStep, SetupStepStatus } from '@mdarj/shared';
import CheckInCard from '@/components/settings/check-in-card';
import CompanyProfileCard, {
  type CompanyProfile,
} from '@/components/settings/company-profile-card';
import ComplianceCard from '@/components/settings/compliance-card';
import JobTitlesCard, {
  type JobTitle,
} from '@/components/settings/job-titles-card';
import PayrollRulesCard from '@/components/settings/payroll-rules-card';
import WorkWeekCard, {
  type SettingsVersion,
} from '@/components/settings/work-week-card';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * One wizard step (CS-02): the same section as on the Settings page, whose own button becomes
 * "Save & continue": one click saves, marks the step done and opens the next one.
 * "Skip for now" marks it skipped. Job titles is a list, so it gets its own Continue button.
 */
export default function SetupStepView({
  step,
  previous,
  next,
  company,
  timeZones,
  today,
  versions,
  jobTitles,
}: {
  step: SetupStep;
  previous: SetupStep | null;
  /** null on the last step */
  next: SetupStep | null;
  company: CompanyProfile;
  timeZones: string[];
  today: string;
  versions: SettingsVersion[];
  jobTitles: JobTitle[];
}) {
  const t = useTranslations('Setup');
  const tErr = useTranslations('Errors');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /** Records the step, then opens the next one (or the summary after the last) */
  async function mark(status: SetupStepStatus) {
    setBusy(true);
    setFailed(false);
    let ok = false;
    try {
      const res = await fetch('/api/company/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, status }),
      });
      ok = res.ok;
    } catch {
      // no connection
    }
    setBusy(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push(next ? `/setup?step=${next}` : '/setup');
    router.refresh();
  }

  const saveAndContinue = next ? t('saveContinue') : t('saveFinish');
  const done = () => mark('done');
  const current = versions.find((v) => v.state === 'inForce');

  return (
    <div className="flex flex-col gap-4">
      {step === 'profile' && (
        <CompanyProfileCard
          company={company}
          timeZones={timeZones}
          onSaved={done}
          submitLabel={saveAndContinue}
        />
      )}
      {step === 'compliance' && (
        <ComplianceCard
          company={company}
          onSaved={done}
          submitLabel={saveAndContinue}
        />
      )}
      {step === 'workWeek' && (
        <WorkWeekCard
          today={today}
          versions={versions}
          onSaved={done}
          submitLabel={saveAndContinue}
        />
      )}
      {step === 'payroll' && current && (
        <PayrollRulesCard
          today={today}
          current={current}
          onSaved={done}
          submitLabel={saveAndContinue}
        />
      )}
      {step === 'checkIn' && current && (
        <CheckInCard
          today={today}
          current={current}
          onSaved={done}
          submitLabel={saveAndContinue}
        />
      )}
      {step === 'jobTitles' && <JobTitlesCard items={jobTitles} />}

      {failed && (
        <p
          role="alert"
          className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
        >
          {tErr('somethingWrong')}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {previous ? (
          <Link
            href={`/setup?step=${previous}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2 text-sm text-muted hover:text-text"
          >
            <ArrowLeft
              className="size-4 rtl:-scale-x-100"
              strokeWidth={1.5}
              aria-hidden
            />
            {t('back')}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => mark('skipped')}
            className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas disabled:opacity-60"
          >
            {t('skip')}
          </button>
          {/* Job titles is a list with its own Add buttons, so it needs a separate Continue */}
          {step === 'jobTitles' && (
            <button
              type="button"
              disabled={busy}
              onClick={done}
              className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {next ? t('continue') : t('finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
