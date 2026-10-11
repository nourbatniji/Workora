'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { settingsChangeSchema } from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';

/** One settings version, as GET /company/settings/versions gives it */
export type SettingsVersion = {
  id: string;
  effectiveFrom: string;
  restDays: number[];
  dailyRateDivisor: 'days_30' | 'days_26' | 'working_days';
  latenessPolicy:
    | { mode: 'exact' }
    | {
        mode: 'tiered';
        bands: {
          fromMinutes: number;
          toMinutes: number | null;
          dayFraction: number;
        }[];
      };
  overtimeDayRate: string;
  overtimeNightRate: string;
  overtimeRestDayRate: string;
  overtimeHolidayRate: string;
  overtimeMinMinutes: number;
  checkInWindowMinutes: number;
  checkOutWindowMinutes: number;
  ipAllowList: string[];
  createdBy: string | null;
  state: 'inForce' | 'scheduled' | 'past';
};

/** The week as people in Egypt write it: Saturday first (0 = Sunday … 6 = Saturday) */
const WEEK = [6, 0, 1, 2, 3, 4, 5];

// Error keys that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = [
  'required',
  'dateInvalid',
  'effectiveDateInPast',
  'needWorkingDay',
  'dayRepeated',
  'conflict',
  'forbidden',
];

const STATE_STYLE: Record<SettingsVersion['state'], string> = {
  inForce: 'bg-success/10 text-text',
  scheduled: 'bg-nav-selected text-accent-fg',
  past: 'bg-canvas text-muted',
};

/**
 * Work week (CS-04, FR-CS-4) saved from a date (CS-08, FR-CS-8): the Admin picks the weekly rest
 * days and the day they start. The history shows which version is in force and which are coming.
 */
export default function WorkWeekCard({
  today,
  versions,
}: {
  today: string;
  versions: SettingsVersion[];
}) {
  const t = useTranslations('Settings.workWeek');
  const tErr = useTranslations('Errors');
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();

  const current = versions.find((v) => v.state === 'inForce');
  const [restDays, setRestDays] = useState<number[]>(current?.restDays ?? []);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Day names in the page's language: 2026-10-11 is a Sunday, so day n is Oct 11 + n
  const dayName = (day: number, width: 'long' | 'short' = 'long') =>
    new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 9, 11 + day)),
    );
  const dayNames = (days: number[]) =>
    days.length === 0
      ? t('noRestDays')
      : WEEK.filter((d) => days.includes(d))
          .map((d) => dayName(d))
          .join(locale === 'ar' ? '، ' : ', ');
  const dateText = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  function toggle(day: number) {
    setSaved(false);
    setRestDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  }

  const message = (key?: string) =>
    key ? tErr(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong') : undefined;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const body = { effectiveFrom, restDays };
    const check = settingsChangeSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    let status = 0;
    let data: { message?: string; errors?: Record<string, string> } | null =
      null;
    try {
      const res = await fetch('/api/company/settings/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = res.status;
      data = await res.json().catch(() => null);
    } catch {
      // no connection: status stays 0
    }
    setBusy(false);
    if (status === 201) {
      setSaved(true);
      router.refresh(); // the history shows the new version
      return;
    }
    setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
  }

  return (
    <Card id="work-week" className="scroll-mt-32">
      <CardHeader title={t('title')} hint={t('hint')} />

      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">
            {t('restDays')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {WEEK.map((day) => {
              const rest = restDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={rest}
                  onClick={() => toggle(day)}
                  className={`h-9 min-w-[4.5rem] rounded-[10px] border px-3 text-sm transition-colors ${
                    rest
                      ? 'border-accent bg-nav-selected text-accent-fg'
                      : 'border-line hover:bg-canvas'
                  }`}
                >
                  {dayName(day, 'short')}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            {t('summary', {
              rest: dayNames(restDays),
              working: 7 - restDays.length,
            })}
          </p>
          {errors.restDays && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {message(errors.restDays)}
            </p>
          )}
        </fieldset>

        <div className="max-w-xs">
          <Field
            label={t('effectiveFrom')}
            hint={t('effectiveHint')}
            error={message(errors.effectiveFrom)}
          >
            <input
              type="date"
              value={effectiveFrom}
              min={today}
              onChange={(e) => {
                setSaved(false);
                setEffectiveFrom(e.target.value);
              }}
              className={inputClass(!!errors.effectiveFrom)}
            />
          </Field>
        </div>

        {errors.form && (
          <p
            role="alert"
            className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            {message(errors.form)}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-[13px] text-muted">
              {t('saved', { date: dateText(effectiveFrom) })}
            </span>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {t('save')}
          </button>
        </div>
      </form>

      {/* History: which rules apply from when (FR-CS-8) */}
      <h3 className="mt-6 mb-2 text-[13px] font-medium">{t('history')}</h3>
      <ul className="divide-y divide-line rounded-[10px] border border-line">
        {versions.map((version) => (
          <li
            key={version.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
          >
            <span className="w-28 shrink-0 font-medium">
              {dateText(version.effectiveFrom)}
            </span>
            <span className="min-w-0 flex-1 text-muted">
              {t('restLabel', { days: dayNames(version.restDays) })}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATE_STYLE[version.state]}`}
            >
              {t(`state.${version.state}`)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
