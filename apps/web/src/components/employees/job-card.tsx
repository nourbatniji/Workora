'use client';

import {
  EMPLOYMENT_TYPES,
  updateEmployeeJobSchema,
  type EmployeeProfile,
} from '@mdarj/shared';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { patchJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/card';
import styles from './profile.module.css';

/** Read and edit employment details (EM-03, SCRUM-50). */
export default function JobCard({
  employee,
  jobTitles,
  dates,
}: {
  employee: EmployeeProfile;
  jobTitles: JobTitle[];
  dates: {
    hireDate: string;
    probationEnd: string | null;
    trainingEnd: string | null;
    terminationDate: string | null;
  };
}) {
  const t = useTranslations('Employees');
  const locale = useLocale();
  const tErr = useTranslations('Errors');
  const router = useRouter();
  const formOf = () => ({
    jobTitleId: employee.jobTitle?.id ?? '',
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
    probationEnd: employee.probationEnd ?? '',
    trainingEnd: employee.trainingEnd ?? '',
  });
  const [form, setForm] = useState(formOf);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'employmentType' &&
        value !== 'trainee' && { trainingEnd: '' }),
    }));
  const error = (key: string) => (errors[key] ? tErr(errors[key]) : undefined);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget as HTMLFormElement);
    const submitted = {
      ...form,
      hireDate: String(fields.get('hireDate') ?? ''),
      probationEnd: String(fields.get('probationEnd') ?? ''),
      trainingEnd: String(fields.get('trainingEnd') ?? ''),
    };
    setForm(submitted);
    const check = updateEmployeeJobSchema.safeParse(submitted);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    const validation: Record<string, string> = {};
    if (submitted.probationEnd && submitted.probationEnd < submitted.hireDate)
      validation.probationEnd = 'dateBeforeHire';
    if (submitted.trainingEnd && submitted.trainingEnd < submitted.hireDate)
      validation.trainingEnd = 'dateBeforeHire';
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { status, data } = await patchJson<{
        message?: string;
        errors?: Record<string, string>;
      }>(`/employees/${employee.id}`, submitted);
      if (status === 200 || data?.message === 'nothingToChange') {
        setEditing(false);
        setSaved(status === 200);
        router.refresh();
      } else
        setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
    } finally {
      setSaving(false);
    }
  }

  if (editing)
    return (
      <Card>
        <CardHeader title={t('profile.job')} hint={t('profile.jobHint')} />
        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {tErr(errors.form)}
            </p>
          )}
          <Field
            label={t('profile.fields.jobTitle')}
            error={error('jobTitleId')}
          >
            <select
              value={form.jobTitleId}
              onChange={(event) => set('jobTitleId', event.target.value)}
              className={inputClass(!!errors.jobTitleId)}
            >
              <option value="">{t('profile.notGiven')}</option>
              {jobTitles.map((title) => (
                <option key={title.id} value={title.id}>
                  {locale === 'ar' ? title.nameAr : title.nameEn}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('profile.fields.employmentType')}
            error={error('employmentType')}
          >
            <select
              value={form.employmentType}
              onChange={(event) => set('employmentType', event.target.value)}
              className={inputClass(!!errors.employmentType)}
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`types.${type}`)}
                </option>
              ))}
            </select>
          </Field>
          {(
            [
              'hireDate',
              'probationEnd',
              ...(form.employmentType === 'trainee' ? ['trainingEnd'] : []),
            ] as const
          ).map((key) => (
            <Field
              key={key}
              label={t(`profile.fields.${key}`)}
              error={error(key)}
            >
              <input
                type="date"
                name={key}
                value={form[key as 'hireDate' | 'probationEnd' | 'trainingEnd']}
                min={key === 'hireDate' ? undefined : form.hireDate}
                onChange={(event) =>
                  set(key as keyof typeof form, event.target.value)
                }
                className={inputClass(!!errors[key])}
              />
            </Field>
          ))}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
            >
              {t('profile.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
        </form>
      </Card>
    );

  const rows: [string, string | null][] = [
    [
      'jobTitle',
      employee.jobTitle
        ? locale === 'ar'
          ? employee.jobTitle.nameAr
          : employee.jobTitle.nameEn
        : null,
    ],
    ['employmentType', t(`types.${employee.employmentType}`)],
    ['hireDate', dates.hireDate],
    ['probationEnd', dates.probationEnd],
    ...(employee.employmentType === 'trainee'
      ? ([['trainingEnd', dates.trainingEnd]] as [string, string | null][])
      : []),
    ...(employee.status === 'terminated'
      ? ([['terminationDate', dates.terminationDate]] as [
          string,
          string | null,
        ][])
      : []),
  ];

  return (
    <Card>
      <CardHeader
        title={t('profile.job')}
        hint={saved ? t('profile.saved') : t('profile.jobHint')}
        action={
          <button
            type="button"
            onClick={() => {
              setForm(formOf());
              setErrors({});
              setSaved(false);
              setEditing(true);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] hover:bg-canvas"
          >
            <Pencil className="size-3.5" aria-hidden />
            {t('profile.edit')}
          </button>
        }
      />
      <dl className="flex flex-col gap-3 text-sm">
        {rows.map(([key, value]) => (
          <div key={key} className={styles.field}>
            <dt className="text-muted">{t(`profile.fields.${key}`)}</dt>
            <dd className={`${styles.value} ${value ? '' : 'text-muted'}`}>
              {value ?? t('profile.notGiven')}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
