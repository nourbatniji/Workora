'use client';
import {
  shiftAssignmentSchema,
  shiftTemplateSchema,
  type ShiftAssignments,
  type ShiftTemplate,
} from '@mdarj/shared';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { postJson, type ApiError } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

const initialTemplate = {
  name: '',
  startTime: '09:00',
  endTime: '17:00',
  crossesMidnight: false,
  breakMinutes: 0,
  lateGraceMinutes: 0,
  earlyLeaveGraceMinutes: 0,
  workingDays: [0, 1, 2, 3, 4],
};
export default function ShiftCard({
  employeeId,
  hireDate,
  templates,
  assignments,
  dates,
}: {
  employeeId: string;
  hireDate: string;
  templates: ShiftTemplate[];
  assignments: ShiftAssignments;
  dates: Record<string, string>;
}) {
  const t = useTranslations('Employees.shifts'),
    common = useTranslations('Employees.profile'),
    tErr = useTranslations('Errors');
  const router = useRouter();
  const [editing, setEditing] = useState(false),
    [creating, setCreating] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    shiftTemplateId: '',
    startDate: assignments.date < hireDate ? hireDate : assignments.date,
  });
  const [template, setTemplate] = useState(initialTemplate);
  const [newTemplates, setNewTemplates] = useState<ShiftTemplate[]>([]);
  const options = [
    ...templates,
    ...newTemplates.filter(
      (row) => !templates.some((existing) => existing.id === row.id),
    ),
  ];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget as HTMLFormElement);
    const submitted = creating
      ? {
          ...template,
          startTime: String(fields.get('startTime') ?? ''),
          endTime: String(fields.get('endTime') ?? ''),
        }
      : { ...form, startDate: String(fields.get('startDate') ?? '') };
    const check = creating
      ? shiftTemplateSchema.safeParse(submitted)
      : shiftAssignmentSchema.safeParse(submitted);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      if (creating) {
        const { status, data } = await postJson<ShiftTemplate & ApiError>(
          '/shift-templates',
          check.data,
        );
        if (status === 201 && data) {
          setNewTemplates((rows) => [...rows, data]);
          setForm({ ...form, shiftTemplateId: data.id });
          setCreating(false);
          router.refresh();
        } else
          setErrors(
            data?.errors ?? { form: data?.message ?? 'somethingWrong' },
          );
      } else {
        const { status, data } = await postJson<ApiError>(
          `/employees/${employeeId}/shift-assignments`,
          check.data,
        );
        if (status === 201) {
          setEditing(false);
          setSaved(true);
          router.refresh();
        } else
          setErrors(
            data?.errors ?? { form: data?.message ?? 'somethingWrong' },
          );
      }
    } finally {
      setSaving(false);
    }
  }
  const error = (key: string) => (errors[key] ? tErr(errors[key]) : undefined);
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
                setEditing(true);
                setSaved(false);
                setErrors({});
                setForm({
                  shiftTemplateId: '',
                  startDate:
                    assignments.date < hireDate ? hireDate : assignments.date,
                });
              }}
            >
              {t('assign')}
            </button>
          )
        }
      />
      {editing ? (
        <form noValidate onSubmit={save} className="flex flex-col gap-4">
          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {tErr(errors.form)}
            </p>
          )}
          {creating ? (
            <>
              <Field label={t('name')} error={error('name')}>
                <input
                  value={template.name}
                  onChange={(e) =>
                    setTemplate({ ...template, name: e.target.value })
                  }
                  className={inputClass(!!errors.name)}
                />
              </Field>
              {(['startTime', 'endTime'] as const).map((key) => (
                <Field key={key} label={t(key)} error={error(key)}>
                  <input
                    type="time"
                    name={key}
                    value={template[key]}
                    onChange={(e) =>
                      setTemplate({ ...template, [key]: e.target.value })
                    }
                    className={inputClass(!!errors[key])}
                  />
                </Field>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={template.crossesMidnight}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      crossesMidnight: e.target.checked,
                    })
                  }
                />
                {t('crossesMidnight')}
              </label>
              {(
                [
                  'breakMinutes',
                  'lateGraceMinutes',
                  'earlyLeaveGraceMinutes',
                ] as const
              ).map((key) => (
                <Field key={key} label={t(key)} error={error(key)}>
                  <input
                    type="number"
                    min="0"
                    max="1439"
                    value={Number.isFinite(template[key]) ? template[key] : ''}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        [key]:
                          e.target.value === '' ? NaN : Number(e.target.value),
                      })
                    }
                    className={inputClass(!!errors[key])}
                  />
                </Field>
              ))}
              <fieldset>
                <legend className="mb-2 text-sm">{t('workingDays')}</legend>
                <div className="flex flex-wrap gap-3">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={template.workingDays.includes(day)}
                        onChange={(e) =>
                          setTemplate({
                            ...template,
                            workingDays: e.target.checked
                              ? [...template.workingDays, day]
                              : template.workingDays.filter(
                                  (value) => value !== day,
                                ),
                          })
                        }
                      />
                      {t(`days.${day}`)}
                    </label>
                  ))}
                </div>
                {errors.workingDays && (
                  <p role="alert" className="mt-1 text-xs text-danger">
                    {tErr(errors.workingDays)}
                  </p>
                )}
              </fieldset>
            </>
          ) : (
            <>
              <Field label={t('template')} error={error('shiftTemplateId')}>
                <select
                  value={form.shiftTemplateId}
                  onChange={(e) =>
                    setForm({ ...form, shiftTemplateId: e.target.value })
                  }
                  className={inputClass(!!errors.shiftTemplateId)}
                >
                  <option value="">{t('choose')}</option>
                  {options.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.startTime}–{row.endTime}
                    </option>
                  ))}
                </select>
              </Field>
              {options.length === 0 && (
                <p className="text-xs text-muted">{t('empty')}</p>
              )}
              <button
                type="button"
                className="w-fit text-sm text-accent underline"
                onClick={() => {
                  setCreating(true);
                  setTemplate(initialTemplate);
                  setErrors({});
                }}
              >
                {t('create')}
              </button>
              <Field label={t('startDate')} error={error('startDate')}>
                <input
                  type="date"
                  name="startDate"
                  min={hireDate}
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  className={inputClass(!!errors.startDate)}
                />
              </Field>
            </>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (creating) setCreating(false);
                else setEditing(false);
                setErrors({});
              }}
              className="h-9 rounded-[10px] border border-line px-3.5 text-sm"
            >
              {common('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-[10px] bg-accent px-3.5 text-sm text-white disabled:opacity-60"
            >
              {saving
                ? common('saving')
                : creating
                  ? t('create')
                  : common('save')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="font-medium">
            {assignments.current?.shiftTemplate.name ?? common('notGiven')}
          </p>
          {assignments.current && (
            <>
              <p className="mt-1 text-sm text-muted">
                <bdi>
                  {assignments.current.shiftTemplate.startTime}–
                  {assignments.current.shiftTemplate.endTime}
                </bdi>
                {assignments.current.shiftTemplate.crossesMidnight
                  ? ' · ' + t('crossesMidnight')
                  : ''}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t('from', { date: dates[assignments.current.id] })}
              </p>
            </>
          )}
          {assignments.items.length > 0 && (
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm">
                {t('history')}
              </summary>
              <ul className="mt-3 space-y-3">
                {assignments.items.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <span>
                      {row.shiftTemplate.name}
                      {row.startDate > assignments.date
                        ? ' · ' + t('scheduled')
                        : ''}
                    </span>
                    <span className="text-muted">{dates[row.id]}</span>
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
