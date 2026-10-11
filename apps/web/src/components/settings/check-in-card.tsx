'use client';

import { Plus, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { settingsChangeSchema } from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';
import type { SettingsVersion } from './work-week-card';

// Error keys that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = [
  'required',
  'dateInvalid',
  'effectiveDateInPast',
  'minutesInvalid',
  'ipInvalid',
  'tooManyIps',
  'forbidden',
];

/**
 * Check-in settings (CS-07, FR-CS-7, FR-AT-2, D-38), saved from a date (CS-08): how early before
 * a shift people may check in, how long after it a check-out is still accepted, and the
 * optional office IP list (D-18).
 */
export default function CheckInCard({
  today,
  current,
}: {
  today: string;
  current: SettingsVersion;
}) {
  const t = useTranslations('Settings.checkIn');
  const tErr = useTranslations('Errors');
  const format = useFormatter();
  const router = useRouter();

  const [before, setBefore] = useState(String(current.checkInWindowMinutes));
  // Shown in hours, saved in minutes
  const [afterHours, setAfterHours] = useState(
    String(current.checkOutWindowMinutes / 60),
  );
  const [ips, setIps] = useState<string[]>(current.ipAllowList);
  const [newIp, setNewIp] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const message = (key?: string) =>
    key ? tErr(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong') : undefined;

  function addIp() {
    const value = newIp.trim();
    if (!value) return;
    setSaved(false);
    setIps((list) => (list.includes(value) ? list : [...list, value]));
    setNewIp('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const body = {
      effectiveFrom,
      checkInWindowMinutes: Number(before),
      checkOutWindowMinutes: Math.round(Number(afterHours) * 60),
      ipAllowList: ips,
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

  const ipError = Object.entries(errors).find(([key]) =>
    key.startsWith('ipAllowList'),
  );

  return (
    <Card>
      <CardHeader title={t('title')} hint={t('hint')} />
      <form onSubmit={save} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('before')}
            hint={t('beforeHint')}
            error={message(errors.checkInWindowMinutes)}
          >
            <input
              value={before}
              onChange={(e) => {
                setSaved(false);
                setBefore(e.target.value);
              }}
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass(!!errors.checkInWindowMinutes)} rtl:text-end`}
            />
          </Field>
          <Field
            label={t('after')}
            hint={t('afterHint')}
            error={message(errors.checkOutWindowMinutes)}
          >
            <input
              value={afterHours}
              onChange={(e) => {
                setSaved(false);
                setAfterHours(e.target.value);
              }}
              inputMode="decimal"
              dir="ltr"
              className={`${inputClass(!!errors.checkOutWindowMinutes)} rtl:text-end`}
            />
          </Field>
        </div>

        {/* Office IPs (D-18): empty = from anywhere */}
        <div>
          <p className="mb-1 text-[13px] font-medium">{t('ips')}</p>
          <p className="mb-2 text-xs text-muted">
            {ips.length === 0 ? t('ipsEmpty') : t('ipsSet')}
          </p>
          {ips.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {ips.map((ip, i) => (
                <li
                  key={ip}
                  className={`inline-flex items-center gap-1 rounded-full border py-0.5 ps-2.5 pe-1 text-[13px] ${
                    errors[`ipAllowList.${i}`]
                      ? 'border-danger text-danger'
                      : 'border-line'
                  }`}
                  dir="ltr"
                >
                  {ip}
                  <button
                    type="button"
                    onClick={() => {
                      setSaved(false);
                      setIps((list) => list.filter((x) => x !== ip));
                    }}
                    aria-label={t('removeIp', { ip })}
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-text"
                  >
                    <X className="size-3.5" strokeWidth={1.5} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex max-w-md gap-2">
            <input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addIp();
                }
              }}
              placeholder="41.33.10.0/24"
              dir="ltr"
              aria-label={t('addIp')}
              className={`${inputClass(false)} rtl:text-end`}
            />
            <button
              type="button"
              onClick={addIp}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border border-line px-3 text-sm hover:bg-canvas"
            >
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('addIp')}
            </button>
          </div>
          {ipError && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {message(ipError[1])}
            </p>
          )}
        </div>

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
