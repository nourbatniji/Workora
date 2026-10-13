'use client';

import { salaryChangeSchema, type SalaryHistory } from '@mdarj/shared';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { postJson, type ApiError } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

export default function SalaryCard({
  employeeId,
  hireDate,
  history,
  labels,
}: {
  employeeId: string;
  hireDate: string;
  history: SalaryHistory;
  labels: Record<string, { amount: string; date: string }>;
}) {
  const t = useTranslations('Employees.salary');
  const common = useTranslations('Employees.profile');
  const tErr = useTranslations('Errors');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    baseSalary: '',
    effectiveFrom: history.date < hireDate ? hireDate : history.date,
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget as HTMLFormElement);
    const submitted = {
      baseSalary: String(fields.get('baseSalary') ?? ''),
      effectiveFrom: String(fields.get('effectiveFrom') ?? ''),
    };
    setForm(submitted);
    const check = salaryChangeSchema.safeParse(submitted);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    if (submitted.effectiveFrom < hireDate) {
      setErrors({ effectiveFrom: 'dateBeforeHire' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const { status, data } = await postJson<ApiError>(
        `/employees/${employeeId}/salary-history`,
        check.data,
      );
      if (status === 201) {
        setEditing(false);
        setSaved(true);
        router.refresh();
      } else
        setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader
        title={t('title')}
        hint={saved ? common('saved') : t('hint')}
        action={
          !editing && (
            <button
              type="button"
              className="h-8 rounded-lg border border-line px-2.5 text-[13px] hover:bg-canvas"
              onClick={() => {
                setForm({
                  baseSalary: '',
                  effectiveFrom:
                    history.date < hireDate ? hireDate : history.date,
                });
                setErrors({});
                setSaved(false);
                setEditing(true);
              }}
            >
              {t('add')}
            </button>
          )
        }
      />
      {editing ? (
        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {tErr(errors.form)}
            </p>
          )}
          <Field
            label={t('amount')}
            hint={history.currency}
            error={errors.baseSalary ? tErr(errors.baseSalary) : undefined}
          >
            <input
              type="text"
              name="baseSalary"
              inputMode="decimal"
              dir="ltr"
              value={form.baseSalary}
              onChange={(event) =>
                setForm({ ...form, baseSalary: event.target.value })
              }
              className={inputClass(!!errors.baseSalary)}
            />
          </Field>
          <Field
            label={t('effectiveFrom')}
            error={
              errors.effectiveFrom ? tErr(errors.effectiveFrom) : undefined
            }
          >
            <input
              type="date"
              name="effectiveFrom"
              min={hireDate}
              value={form.effectiveFrom}
              onChange={(event) =>
                setForm({ ...form, effectiveFrom: event.target.value })
              }
              className={inputClass(!!errors.effectiveFrom)}
            />
          </Field>
          <p className="text-xs text-muted">{t('kept')}</p>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="h-9 rounded-[10px] border border-line px-3.5 text-sm"
            >
              {common('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-[10px] bg-accent px-3.5 text-sm text-white disabled:opacity-60"
            >
              {saving ? common('saving') : common('save')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-xs text-muted">{t('current')}</p>
          <p className="mt-1 text-lg font-semibold">
            <bdi>
              {history.current
                ? labels[history.current.id].amount
                : common('notGiven')}
            </bdi>
          </p>
          {history.current && (
            <p className="mt-1 text-xs text-muted">
              {t('from', { date: labels[history.current.id].date })}
            </p>
          )}
          {history.items.length > 0 && (
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm">
                {t('history')}
              </summary>
              <ul className="mt-3 space-y-3">
                {history.items.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      <bdi>{labels[row.id].amount}</bdi>
                      <span className="ms-2 text-xs text-muted">
                        {row.effectiveFrom > history.date
                          ? t('scheduled')
                          : history.current?.id === row.id
                            ? t('current')
                            : t('previous')}
                      </span>
                    </span>
                    <span className="text-muted">{labels[row.id].date}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}
