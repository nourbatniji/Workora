'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { companyProfileSchema } from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';

/** The answer of GET /company */
export type CompanyProfile = {
  id: string;
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  timeZone: string;
  currency: string;
  lawMode: boolean;
  companyRulesText: string | null;
};

// Error keys that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = [
  'required',
  'tooLong',
  'phoneInvalid',
  'timeZoneInvalid',
  'forbidden',
];

/** Company profile (CS-03, FR-CS-3): name, address, phone, time zone; currency EGP */
export default function CompanyProfileCard({
  company,
}: {
  company: CompanyProfile;
}) {
  const t = useTranslations('Settings.profile');
  const tErr = useTranslations('Errors');
  const router = useRouter();

  const [name, setName] = useState(company.name);
  const [address, setAddress] = useState(company.address ?? '');
  const [phone, setPhone] = useState(company.phone ?? '');
  const [timeZone, setTimeZone] = useState(company.timeZone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Every time zone the browser knows; the saved one stays in the list even if it doesn't
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf('timeZone');
    return all.includes(company.timeZone) ? all : [company.timeZone, ...all];
  }, [company.timeZone]);

  const message = (key?: string) =>
    key ? tErr(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong') : undefined;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const body = { name, address, phone, timeZone };
    const check = companyProfileSchema.safeParse(body);
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
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = res.status;
      data = await res.json().catch(() => null);
    } catch {
      // no connection: status stays 0
    }
    setBusy(false);
    if (status === 200) {
      setSaved(true);
      router.refresh(); // the top bar shows the new company name
      return;
    }
    setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
  }

  return (
    <Card>
      <CardHeader title={t('title')} hint={t('hint')} />
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <Field label={t('name')} error={message(errors.name)}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass(!!errors.name)}
          />
        </Field>
        <Field
          label={t('address')}
          hint={t('optional')}
          error={message(errors.address)}
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass(!!errors.address)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('phone')}
            hint={t('optional')}
            error={message(errors.phone)}
          >
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
              placeholder="01xxxxxxxxx"
              className={`${inputClass(!!errors.phone)} rtl:text-end`}
            />
          </Field>
          <Field label={t('timeZone')} error={message(errors.timeZone)}>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              dir="ltr"
              className={inputClass(!!errors.timeZone)}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[13px] font-medium">{t('currency')}</p>
            <p className="flex h-10 items-center rounded-[10px] border border-line bg-canvas px-3 text-sm text-muted">
              {company.currency}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">{t('logo')}</p>
            <p className="flex min-h-10 items-center rounded-[10px] border border-dashed border-line px-3 py-2 text-xs text-muted">
              {t('logoLater')}
            </p>
          </div>
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
              {t('saved')}
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
