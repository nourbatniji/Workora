'use client';

import {
  GENDERS,
  updateEmployeePersonalSchema,
  type EmployeeProfile,
} from '@mdarj/shared';
import { Pencil } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { patchJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

/** The form's boxes: text everywhere, so an empty box can mean "clear it" */
type Form = {
  nameAr: string;
  nameEn: string;
  nationalId: string;
  birthDate: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  hasDisability: boolean;
};

function formOf(employee: EmployeeProfile): Form {
  return {
    nameAr: employee.nameAr,
    nameEn: employee.nameEn,
    nationalId: employee.nationalId ?? '',
    birthDate: employee.birthDate ?? '',
    gender: employee.gender ?? '',
    phone: employee.phone ?? '',
    email: employee.email ?? '',
    address: employee.address ?? '',
    emergencyName: employee.emergencyName ?? '',
    emergencyPhone: employee.emergencyPhone ?? '',
    hasDisability: employee.hasDisability,
  };
}

/**
 * Personal data (EM-02): read it, then Edit turns the card into a form in place. Saving sends the
 * whole form; the API changes only what differs and audits only that (D-78). The disability field
 * appears only when the company follows the Labor Law (D-04).
 */
export default function PersonalCard({
  employee,
}: {
  employee: EmployeeProfile;
}) {
  const t = useTranslations('Employees');
  const tErr = useTranslations('Errors');
  const format = useFormatter();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => formOf(employee));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set =
    (field: Exclude<keyof Form, 'hasDisability'>) =>
    (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  function startEditing() {
    setForm(formOf(employee));
    setErrors({});
    setSaved(false);
    setEditing(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body = {
      ...form,
      // The disability field is sent only where it exists (law mode), never otherwise
      hasDisability: employee.lawMode ? form.hasDisability : undefined,
    };
    const check = updateEmployeePersonalSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    setErrors({});
    setSaving(true);
    const { status, data } = await patchJson<{
      message?: string;
      errors?: Record<string, string>;
    }>(`/employees/${employee.id}`, body);
    setSaving(false);

    // Saved, or nothing was different: either way the card goes back to reading
    if (status === 200 || data?.message === 'nothingToChange') {
      setEditing(false);
      setSaved(status === 200);
      router.refresh(); // the header and this card show the new values
      return;
    }
    setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
  }

  const error = (field: string) =>
    errors[field] ? tErr(errors[field]) : undefined;
  const ltr = 'rtl:text-end';

  const day = (value: string | null) =>
    value
      ? format.dateTime(new Date(`${value}T00:00:00Z`), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null;

  if (!editing) {
    const emergency = [employee.emergencyName, employee.emergencyPhone]
      .filter(Boolean)
      .join(' · ');
    const rows: [string, string | null, boolean?][] = [
      ['nameAr', employee.nameAr],
      ['nameEn', employee.nameEn],
      ['nationalId', employee.nationalId, true],
      ['birthDate', day(employee.birthDate)],
      ['gender', employee.gender ? t(`genders.${employee.gender}`) : null],
      ['phone', employee.phone, true],
      ['email', employee.email, true],
      ['address', employee.address],
      ['emergency', emergency || null],
      ...(employee.lawMode
        ? ([
            [
              'hasDisability',
              employee.hasDisability ? t('profile.yes') : t('profile.no'),
            ],
          ] as [string, string | null][])
        : []),
    ];
    return (
      <Card>
        <CardHeader
          title={t('profile.personal')}
          hint={saved ? t('profile.saved') : t('profile.personalHint')}
          action={
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] hover:bg-canvas"
            >
              <Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />
              {t('profile.edit')}
            </button>
          }
        />
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          {rows.map(([key, value, isLtr]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-muted">
                {t(`profile.fields.${key}`)}
              </dt>
              <dd
                className={`mt-0.5 break-words ${value ? '' : 'text-muted'}`}
                dir={isLtr && value ? 'ltr' : undefined}
              >
                <span className={isLtr ? ltr : undefined}>
                  {value ?? t('profile.notGiven')}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('profile.personal')}
        hint={t('profile.personalHint')}
      />
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p
            role="alert"
            className="rounded-[10px] bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {tErr(errors.form)}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('profile.fields.nameAr')} error={error('nameAr')}>
            <input
              value={form.nameAr}
              onChange={set('nameAr')}
              dir="rtl"
              className={inputClass(!!errors.nameAr)}
            />
          </Field>
          <Field label={t('profile.fields.nameEn')} error={error('nameEn')}>
            <input
              value={form.nameEn}
              onChange={set('nameEn')}
              dir="ltr"
              className={`${inputClass(!!errors.nameEn)} ${ltr}`}
            />
          </Field>
          <Field
            label={t('profile.fields.nationalId')}
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
            label={t('profile.fields.birthDate')}
            error={error('birthDate')}
          >
            <input
              type="date"
              value={form.birthDate}
              onChange={set('birthDate')}
              className={inputClass(!!errors.birthDate)}
            />
          </Field>
          <Field label={t('profile.fields.gender')} error={error('gender')}>
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
          <Field label={t('profile.fields.phone')} error={error('phone')}>
            <input
              value={form.phone}
              onChange={set('phone')}
              inputMode="tel"
              dir="ltr"
              className={`${inputClass(!!errors.phone)} ${ltr}`}
            />
          </Field>
          <Field label={t('profile.fields.email')} error={error('email')}>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              dir="ltr"
              className={`${inputClass(!!errors.email)} ${ltr}`}
            />
          </Field>
          <Field label={t('profile.fields.address')} error={error('address')}>
            <input
              value={form.address}
              onChange={set('address')}
              className={inputClass(!!errors.address)}
            />
          </Field>
          <Field
            label={t('profile.fields.emergencyName')}
            error={error('emergencyName')}
          >
            <input
              value={form.emergencyName}
              onChange={set('emergencyName')}
              className={inputClass(!!errors.emergencyName)}
            />
          </Field>
          <Field
            label={t('profile.fields.emergencyPhone')}
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
        </div>

        {employee.lawMode && (
          <label className="flex items-start gap-3 rounded-[10px] border border-line p-3">
            <input
              type="checkbox"
              checked={form.hasDisability}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  hasDisability: e.target.checked,
                }))
              }
              className="mt-0.5 size-4 accent-accent"
            />
            <span>
              <span className="block text-sm font-medium">
                {t('profile.fields.hasDisability')}
              </span>
              <span className="block text-xs text-muted">
                {t('profile.fields.disabilityHint')}
              </span>
              {errors.hasDisability && (
                <span role="alert" className="mt-1 block text-xs text-danger">
                  {tErr(errors.hasDisability)}
                </span>
              )}
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
          >
            {t('profile.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </form>
    </Card>
  );
}
