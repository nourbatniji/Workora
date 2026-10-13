'use client';

import {
  createEmployeeSchema,
  EMPLOYMENT_TYPES,
  GENDERS,
  type CreateEmployeeRequest,
} from '@mdarj/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { Field, inputClass } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

type Form = Record<keyof CreateEmployeeRequest, string>;

const EMPTY: Form = {
  nameAr: '',
  nameEn: '',
  employmentType: 'full_time',
  hireDate: '',
  jobTitleId: '',
  probationEnd: '',
  trainingEnd: '',
  nationalId: '',
  birthDate: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
};

type CreateAnswer = {
  code?: string;
  message?: string;
  errors?: Record<string, string>;
};

/** Answers that are about the whole form, not one field */
const FORM_ERRORS = [
  'employeeLimitReached',
  'invalidReference',
  'forbidden',
  'notLoggedIn',
  'sessionExpired',
];

/**
 * Add employee (EM-01). Checks with the same rules as the API first (shared schema, D-30), then
 * POST /employees. On success it goes back to the list, which says which code was given.
 */
export default function EmployeeForm({ jobTitles }: { jobTitles: JobTitle[] }) {
  const t = useTranslations('Employees');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (field: keyof Form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Training end is only for trainees: drop a value left over from a type change
    const body = {
      ...form,
      trainingEnd: form.employmentType === 'trainee' ? form.trainingEnd : '',
    };

    // 1. Same rules as the server, so mistakes show without a round trip
    const check = createEmployeeSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }

    // 2. The API saves the employee, the code, the first status line and the audit row
    setErrors({});
    setSaving(true);
    const { status, data } = await postJson<CreateAnswer>('/employees', body);

    if (status === 201 && data?.code) {
      router.push(`/employees?created=${encodeURIComponent(data.code)}`);
      router.refresh();
      return;
    }
    setSaving(false);
    if (data?.errors && data.message !== 'employeeLimitReached') {
      setErrors(data.errors); // e.g. { nationalId: 'nationalIdTaken' }
      return;
    }
    const key = data?.message ?? '';
    setErrors({ form: FORM_ERRORS.includes(key) ? key : 'somethingWrong' });
  }

  const error = (field: string) =>
    errors[field] ? tErr(errors[field]) : undefined;
  const required = (label: string) => `${label} *`;
  const ltr = 'rtl:text-end';

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {errors.form && (
        <p
          role="alert"
          className="rounded-[10px] bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {tErr(errors.form)}
        </p>
      )}

      {/* Job (FR-EM-3) */}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted">
          {t('form.job')}
        </legend>
        <Field label={required(t('form.nameAr'))} error={error('nameAr')}>
          <input
            value={form.nameAr}
            onChange={set('nameAr')}
            dir="rtl"
            className={inputClass(!!errors.nameAr)}
            autoFocus={locale === 'ar'}
          />
        </Field>
        <Field label={required(t('form.nameEn'))} error={error('nameEn')}>
          <input
            value={form.nameEn}
            onChange={set('nameEn')}
            dir="ltr"
            className={`${inputClass(!!errors.nameEn)} ${ltr}`}
            autoFocus={locale !== 'ar'}
          />
        </Field>
        <Field
          label={required(t('form.employmentType'))}
          error={error('employmentType')}
        >
          <select
            value={form.employmentType}
            onChange={set('employmentType')}
            className={inputClass(!!errors.employmentType)}
          >
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={required(t('form.hireDate'))} error={error('hireDate')}>
          <input
            type="date"
            value={form.hireDate}
            onChange={set('hireDate')}
            className={inputClass(!!errors.hireDate)}
          />
        </Field>
        <Field
          label={t('form.jobTitle')}
          hint={t('form.optional')}
          error={error('jobTitleId')}
        >
          <select
            value={form.jobTitleId}
            onChange={set('jobTitleId')}
            className={inputClass(!!errors.jobTitleId)}
          >
            <option value="">{t('form.noJobTitle')}</option>
            {jobTitles.map((title) => (
              <option key={title.id} value={title.id}>
                {locale === 'ar' ? title.nameAr : title.nameEn}
              </option>
            ))}
          </select>
          {jobTitles.length === 0 && (
            <span className="mt-1 block text-xs text-muted">
              {t('form.noJobTitlesHint')}{' '}
              <Link href="/settings" className="text-accent hover:underline">
                {t('form.settingsLink')}
              </Link>
            </span>
          )}
        </Field>
        <Field
          label={t('form.probationEnd')}
          hint={t('form.optional')}
          error={error('probationEnd')}
        >
          <input
            type="date"
            value={form.probationEnd}
            min={form.hireDate || undefined}
            onChange={set('probationEnd')}
            className={inputClass(!!errors.probationEnd)}
          />
        </Field>
        {form.employmentType === 'trainee' && (
          <Field
            label={t('form.trainingEnd')}
            hint={t('form.optional')}
            error={error('trainingEnd')}
          >
            <input
              type="date"
              value={form.trainingEnd}
              min={form.hireDate || undefined}
              onChange={set('trainingEnd')}
              className={inputClass(!!errors.trainingEnd)}
            />
          </Field>
        )}
      </fieldset>

      {/* Personal (FR-EM-2) */}
      <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <legend className="mb-3 pt-5 text-sm font-medium text-muted">
          {t('form.personal')}
        </legend>
        <Field
          label={t('form.nationalId')}
          hint={t('form.nationalIdHint')}
          error={error('nationalId')}
        >
          <input
            value={form.nationalId}
            onChange={set('nationalId')}
            inputMode="numeric"
            dir="ltr"
            className={`${inputClass(!!errors.nationalId)} ${ltr}`}
          />
        </Field>
        <Field
          label={t('form.birthDate')}
          hint={t('form.optional')}
          error={error('birthDate')}
        >
          <input
            type="date"
            value={form.birthDate}
            onChange={set('birthDate')}
            className={inputClass(!!errors.birthDate)}
          />
        </Field>
        <Field
          label={t('form.gender')}
          hint={t('form.optional')}
          error={error('gender')}
        >
          <select
            value={form.gender}
            onChange={set('gender')}
            className={inputClass(!!errors.gender)}
          >
            <option value="">{t('form.chooseGender')}</option>
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {t(`genders.${gender}`)}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      {/* Contact (FR-EM-2) */}
      <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <legend className="mb-3 pt-5 text-sm font-medium text-muted">
          {t('form.contact')}
        </legend>
        <Field
          label={t('form.phone')}
          hint={t('form.optional')}
          error={error('phone')}
        >
          <input
            value={form.phone}
            onChange={set('phone')}
            inputMode="tel"
            dir="ltr"
            className={`${inputClass(!!errors.phone)} ${ltr}`}
          />
        </Field>
        <Field
          label={t('form.email')}
          hint={t('form.optional')}
          error={error('email')}
        >
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            dir="ltr"
            className={`${inputClass(!!errors.email)} ${ltr}`}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label={t('form.address')}
            hint={t('form.optional')}
            error={error('address')}
          >
            <input
              value={form.address}
              onChange={set('address')}
              className={inputClass(!!errors.address)}
            />
          </Field>
        </div>
        <Field
          label={t('form.emergencyName')}
          hint={t('form.optional')}
          error={error('emergencyName')}
        >
          <input
            value={form.emergencyName}
            onChange={set('emergencyName')}
            className={inputClass(!!errors.emergencyName)}
          />
        </Field>
        <Field
          label={t('form.emergencyPhone')}
          hint={t('form.optional')}
          error={error('emergencyPhone')}
        >
          <input
            value={form.emergencyPhone}
            onChange={set('emergencyPhone')}
            inputMode="tel"
            dir="ltr"
            className={`${inputClass(!!errors.emergencyPhone)} ${ltr}`}
          />
        </Field>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Link
          href="/employees"
          className="h-10 rounded-[10px] border border-line px-4 text-sm leading-10 hover:bg-canvas"
        >
          {t('form.cancel')}
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t('form.saving') : t('form.save')}
        </button>
      </div>
    </form>
  );
}
