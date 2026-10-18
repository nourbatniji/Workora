'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  changeEmployeeStatusSchema,
  type EmployeeStatusHistory,
} from '@mdarj/shared';
import { Card } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { postJson, type ApiError } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

type Props = {
  employeeId: string;
  hireDate: string;
  history: EmployeeStatusHistory;
  dates: Record<string, string>;
};

export default function StatusCard({
  employeeId,
  hireDate,
  history,
  dates,
}: Props) {
  const today = history.date;
  const current = history.items.find((row) => row.effectiveDate <= today);
  const router = useRouter();
  const locale = useLocale();
  const tStatus = useTranslations('Employees.status');
  const tError = useTranslations('Errors');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const text =
    locale === 'ar'
      ? {
          history: 'سجل تغييرات الحالة',
          empty: 'لا توجد تغييرات مسجلة للحالة.',
          initial: 'الحالة الأولية',
          scheduled: 'مجدول',
          current: 'الحالة الحالية',
          previous: 'سابق',
          changedBy: 'تم التغيير بواسطة',
          notGiven: 'غير مسجل',
          title: 'تغيير حالة الموظف',
          status: 'الحالة الجديدة',
          choose: 'اختر الحالة',
          date: 'تاريخ السريان',
          reason: 'السبب',
          save: 'حفظ التغيير',
          saving: 'جارٍ الحفظ...',
          saved: 'تم حفظ تغيير الحالة.',
          hint: 'التغييرات المستقبلية تُطبّق في تاريخ السريان.',
          dateOrder: 'اختر تاريخًا بعد آخر تغيير مسجل للحالة.',
          unchanged: 'اختر حالة مختلفة عن آخر حالة مسجلة.',
        }
      : {
          history: 'Status history',
          empty: 'No status changes recorded.',
          initial: 'Initial status',
          scheduled: 'Scheduled',
          current: 'Current',
          previous: 'Previous',
          changedBy: 'Changed by',
          notGiven: 'Not recorded',
          title: 'Change employee status',
          status: 'New status',
          choose: 'Choose a status',
          date: 'Effective date',
          reason: 'Reason',
          save: 'Save change',
          saving: 'Saving...',
          saved: 'Status change saved.',
          hint: 'Future changes take effect on their effective date.',
          dateOrder: 'Choose a date after the latest recorded status change.',
          unchanged: 'Choose a different status from the latest recorded one.',
        };

  function errorText(key?: string) {
    if (!key) return undefined;
    if (key === 'statusDateOrder') return text.dateOrder;
    if (key === 'statusUnchanged') return text.unchanged;
    return tError(tError.has(key) ? key : 'somethingWrong');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    setSaved(false);
    setErrors({});

    const result = changeEmployeeStatusSchema.safeParse({
      toStatus: fields.get('toStatus'),
      effectiveDate: fields.get('effectiveDate'),
      reason: fields.get('reason'),
    });

    if (!result.success) {
      setErrors(errorsByField(result.error.issues));
      return;
    }

    if (result.data.effectiveDate < hireDate) {
      setErrors({ effectiveDate: 'dateBeforeHire' });
      return;
    }

    setSaving(true);

    try {
      const { status, data } = await postJson<ApiError>(
        `/employees/${employeeId}/status-changes`,
        result.data,
      );

      if (status !== 201) {
        setErrors(
          data?.errors ?? {
            form: data?.message ?? 'somethingWrong',
          },
        );
        return;
      }

      form.reset();
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-medium">{text.title}</h2>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errorText(errors.form)}
          </p>
        )}

        <fieldset disabled={saving} className="flex flex-col gap-4">
          <Field label={text.status} error={errorText(errors.toStatus)}>
            <select
              name="toStatus"
              defaultValue=""
              required
              className={inputClass(!!errors.toStatus)}
            >
              <option value="" disabled>
                {text.choose}
              </option>
              <option value="active">{tStatus('active')}</option>
              <option value="suspended">{tStatus('suspended')}</option>
              <option value="terminated">{tStatus('terminated')}</option>
            </select>
          </Field>

          <Field label={text.date} error={errorText(errors.effectiveDate)}>
            <input
              name="effectiveDate"
              type="date"
              min={hireDate}
              defaultValue={today < hireDate ? hireDate : today}
              required
              className={inputClass(!!errors.effectiveDate)}
            />
          </Field>

          <Field label={text.reason} error={errorText(errors.reason)}>
            <textarea
              name="reason"
              required
              maxLength={1000}
              rows={3}
              className={`${inputClass(!!errors.reason)} h-auto py-2`}
            />
          </Field>

          <p className="text-xs text-muted">{text.hint}</p>

          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-accent px-4 text-sm text-white disabled:opacity-60"
          >
            {saving ? text.saving : text.save}
          </button>
        </fieldset>

        {saved && (
          <p role="status" className="text-sm">
            {text.saved}
          </p>
        )}
      </form>

      <section className="mt-6 border-t border-line pt-4">
        <h3 className="mb-3 text-sm font-medium">{text.history}</h3>
        {history.items.length === 0 ? (
          <p className="text-sm text-muted">{text.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.items.map((row) => {
              const scheduled = row.effectiveDate > today;
              return (
                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      {row.fromStatus ? tStatus(row.fromStatus) : text.initial}
                      <span aria-hidden className="inline-block rtl:rotate-180">
                        →
                      </span>
                      {tStatus(row.toStatus)}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${scheduled ? 'bg-warning/15 text-text' : 'bg-canvas text-muted'}`}
                    >
                      {scheduled
                        ? text.scheduled
                        : row.id === current?.id
                          ? text.current
                          : text.previous}
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted">{text.date}</dt>
                      <dd>
                        <time dateTime={row.effectiveDate}>
                          {dates[row.id]}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">{text.changedBy}</dt>
                      <dd className="break-words">
                        {row.changedBy?.name || text.notGiven}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted">{text.reason}</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {row.reason || text.notGiven}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Card>
  );
}
