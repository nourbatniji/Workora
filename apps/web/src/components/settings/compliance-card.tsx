'use client';

import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { companyComplianceSchema } from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';
import type { CompanyProfile } from './company-profile-card';

const RULES_MAX = 10_000;

// Error keys that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = ['tooLong', 'lawModeInvalid', 'forbidden'];

/**
 * Compliance mode (CS-06, FR-CS-6): "Follow the Egyptian Labor Law" yes/no, and the company's
 * own rules as free text. Leave types, overtime multipliers, the disability field and the AI
 * check read these later (FR-LV-2, BR-9, D-04, FR-AI-3).
 */
export default function ComplianceCard({
  company,
}: {
  company: CompanyProfile;
}) {
  const t = useTranslations('Settings.compliance');
  const tErr = useTranslations('Errors');
  const router = useRouter();

  const [lawMode, setLawMode] = useState(company.lawMode);
  const [rules, setRules] = useState(company.companyRulesText ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const message = (key?: string) =>
    key ? tErr(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong') : undefined;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const body = { lawMode, companyRulesText: rules };
    const check = companyComplianceSchema.safeParse(body);
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
      router.refresh();
      return;
    }
    setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
  }

  return (
    <Card>
      <CardHeader title={t('title')} hint={t('hint')} />
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {/* The switch */}
        <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-nav-selected text-accent-fg">
            <Scale className="size-[18px]" strokeWidth={1.5} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t('lawMode')}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {lawMode ? t('lawModeOn') : t('lawModeOff')}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={lawMode}
            onChange={(e) => {
              setSaved(false);
              setLawMode(e.target.checked);
            }}
            className="peer sr-only"
          />
          {/* A switch drawn with CSS; the real control is the hidden checkbox above */}
          <span
            aria-hidden
            className="relative mt-1 h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:start-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4"
          />
        </label>
        {errors.lawMode && (
          <p role="alert" className="-mt-2 text-xs text-danger">
            {message(errors.lawMode)}
          </p>
        )}

        {/* The company's own rules */}
        <div>
          <label
            htmlFor="company-rules"
            className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium"
          >
            {t('rules')}
            <span className="text-xs font-normal text-muted">
              ({t('optional')})
            </span>
          </label>
          <textarea
            id="company-rules"
            value={rules}
            onChange={(e) => {
              setSaved(false);
              setRules(e.target.value);
            }}
            rows={6}
            maxLength={RULES_MAX}
            placeholder={t('rulesPlaceholder')}
            className={`w-full rounded-[10px] border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent ${
              errors.companyRulesText ? 'border-danger' : 'border-line'
            }`}
          />
          <div className="mt-1 flex justify-between gap-3 text-xs text-muted">
            <span>{t('rulesHint')}</span>
            <span className="tabular-nums">
              {rules.length.toLocaleString()} / {RULES_MAX.toLocaleString()}
            </span>
          </div>
          {errors.companyRulesText && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {message(errors.companyRulesText)}
            </p>
          )}
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
