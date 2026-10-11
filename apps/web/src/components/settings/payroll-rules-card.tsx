'use client';

import { Plus, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { DAILY_RATE_DIVISORS, settingsChangeSchema } from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';
import type { SettingsVersion } from './work-week-card';

type Band = { from: string; to: string; fraction: string };

const RATES = [
  'overtimeDayRate',
  'overtimeNightRate',
  'overtimeRestDayRate',
  'overtimeHolidayRate',
] as const;

const FRACTIONS = ['0.25', '0.5', '0.75', '1'];

// Error keys that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = [
  'required',
  'dateInvalid',
  'effectiveDateInPast',
  'divisorInvalid',
  'policyInvalid',
  'bandsRequired',
  'tooManyBands',
  'bandRangeInvalid',
  'openBandNotLast',
  'bandsOverlap',
  'minutesInvalid',
  'fractionInvalid',
  'rateInvalid',
  'rateOutOfRange',
  'forbidden',
];

/**
 * Payroll rules (CS-05, FR-CS-5, BR-6, BR-7, BR-9), saved from a date (CS-08): daily-rate
 * divisor, lateness policy (exact or bands), overtime multipliers and the overtime minimum.
 */
export default function PayrollRulesCard({
  today,
  current,
}: {
  today: string;
  current: SettingsVersion;
}) {
  const t = useTranslations('Settings.payroll');
  const tErr = useTranslations('Errors');
  const format = useFormatter();
  const router = useRouter();

  const [divisor, setDivisor] = useState(current.dailyRateDivisor);
  const [mode, setMode] = useState(current.latenessPolicy.mode);
  const [bands, setBands] = useState<Band[]>(
    current.latenessPolicy.mode === 'tiered'
      ? current.latenessPolicy.bands.map((b) => ({
          from: String(b.fromMinutes),
          to: b.toMinutes === null ? '' : String(b.toMinutes),
          fraction: String(b.dayFraction),
        }))
      : [
          { from: '16', to: '60', fraction: '0.25' },
          { from: '61', to: '120', fraction: '0.5' },
          { from: '121', to: '', fraction: '1' },
        ],
  );
  const [rates, setRates] = useState<Record<(typeof RATES)[number], string>>({
    overtimeDayRate: current.overtimeDayRate,
    overtimeNightRate: current.overtimeNightRate,
    overtimeRestDayRate: current.overtimeRestDayRate,
    overtimeHolidayRate: current.overtimeHolidayRate,
  });
  const [minMinutes, setMinMinutes] = useState(
    String(current.overtimeMinMinutes),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const message = (key?: string) =>
    key ? tErr(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong') : undefined;
  const bandError = (i: number) =>
    message(
      errors[`latenessPolicy.bands.${i}`] ??
        errors[`latenessPolicy.bands.${i}.fromMinutes`] ??
        errors[`latenessPolicy.bands.${i}.toMinutes`],
    );

  function updateBand(i: number, part: Partial<Band>) {
    setSaved(false);
    setBands((all) => all.map((b, j) => (j === i ? { ...b, ...part } : b)));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const body = {
      effectiveFrom,
      dailyRateDivisor: divisor,
      latenessPolicy:
        mode === 'exact'
          ? { mode: 'exact' as const }
          : {
              mode: 'tiered' as const,
              bands: bands.map((b) => ({
                fromMinutes: Number(b.from),
                toMinutes: b.to.trim() === '' ? null : Number(b.to),
                dayFraction: Number(b.fraction),
              })),
            },
      ...rates,
      overtimeMinMinutes: Number(minMinutes),
    };
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
      router.refresh();
      return;
    }
    setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
  }

  const radio = (checked: boolean) =>
    `flex cursor-pointer items-start gap-2 rounded-[10px] border p-3 text-sm ${
      checked
        ? 'border-accent bg-nav-selected/40'
        : 'border-line hover:bg-canvas'
    }`;

  return (
    <Card id="payroll" className="scroll-mt-32">
      <CardHeader title={t('title')} hint={t('hint')} />
      <form onSubmit={save} noValidate className="flex flex-col gap-5">
        {/* Daily rate (BR-6) */}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">
            {t('divisorTitle')}
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {DAILY_RATE_DIVISORS.map((option) => (
              <label key={option} className={radio(divisor === option)}>
                <input
                  type="radio"
                  name="divisor"
                  checked={divisor === option}
                  onChange={() => {
                    setSaved(false);
                    setDivisor(option);
                  }}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>{t(`divisor.${option}`)}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t('divisorHint')}</p>
        </fieldset>

        {/* Lateness and early leave (BR-7) */}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">
            {t('latenessTitle')}
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['exact', 'tiered'] as const).map((option) => (
              <label key={option} className={radio(mode === option)}>
                <input
                  type="radio"
                  name="lateness"
                  checked={mode === option}
                  onChange={() => {
                    setSaved(false);
                    setMode(option);
                  }}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block font-medium">
                    {t(`lateness.${option}`)}
                  </span>
                  <span className="text-xs text-muted">
                    {t(`lateness.${option}Hint`)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {mode === 'tiered' && (
            <div className="mt-3 flex flex-col gap-2">
              {bands.map((band, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      value={band.from}
                      onChange={(e) => updateBand(i, { from: e.target.value })}
                      inputMode="numeric"
                      aria-label={t('bandFrom')}
                      className={`${inputClass(false)} w-20`}
                    />
                    <span className="text-muted">–</span>
                    <input
                      value={band.to}
                      onChange={(e) => updateBand(i, { to: e.target.value })}
                      inputMode="numeric"
                      placeholder={t('bandOpen')}
                      aria-label={t('bandTo')}
                      className={`${inputClass(false)} w-24`}
                    />
                    <span className="text-muted">{t('minutesLate')}</span>
                    <span className="text-muted">→</span>
                    <select
                      value={band.fraction}
                      onChange={(e) =>
                        updateBand(i, { fraction: e.target.value })
                      }
                      aria-label={t('bandFraction')}
                      className={`${inputClass(false)} w-32`}
                    >
                      {FRACTIONS.map((f) => (
                        <option key={f} value={f}>
                          {t(`fraction.${f.replace('.', '_')}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setBands((all) => all.filter((_, j) => j !== i))
                      }
                      aria-label={t('removeBand')}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-text"
                    >
                      <X className="size-4" strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                  {bandError(i) && (
                    <p role="alert" className="mt-1 text-xs text-danger">
                      {bandError(i)}
                    </p>
                  )}
                </div>
              ))}
              {errors['latenessPolicy.bands'] && (
                <p role="alert" className="text-xs text-danger">
                  {message(errors['latenessPolicy.bands'])}
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  setBands((all) => [
                    ...all,
                    { from: '', to: '', fraction: '0.25' },
                  ])
                }
                className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] hover:bg-canvas"
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                {t('addBand')}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">{t('capHint')}</p>
        </fieldset>

        {/* Overtime (BR-5, BR-9) */}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">
            {t('overtimeTitle')}
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {RATES.map((rate) => (
              <Field key={rate} label={t(rate)} error={message(errors[rate])}>
                <input
                  value={rates[rate]}
                  onChange={(e) => {
                    setSaved(false);
                    setRates((all) => ({ ...all, [rate]: e.target.value }));
                  }}
                  inputMode="decimal"
                  dir="ltr"
                  className={`${inputClass(!!errors[rate])} rtl:text-end`}
                />
              </Field>
            ))}
            <Field
              label={t('overtimeMinMinutes')}
              error={message(errors.overtimeMinMinutes)}
            >
              <input
                value={minMinutes}
                onChange={(e) => {
                  setSaved(false);
                  setMinMinutes(e.target.value);
                }}
                inputMode="numeric"
                dir="ltr"
                className={`${inputClass(!!errors.overtimeMinMinutes)} rtl:text-end`}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">{t('overtimeHint')}</p>
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
              {t('saved', {
                date: format.dateTime(new Date(`${effectiveFrom}T12:00:00Z`), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'UTC',
                }),
              })}
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
    </Card>
  );
}
