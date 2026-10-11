'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { jobTitleSchema } from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';

/** One row of GET /job-titles */
export type JobTitle = {
  id: string;
  nameAr: string;
  nameEn: string;
  employeeCount: number;
};

/** JSON to the API through the /api proxy; never throws (no connection → status 0) */
async function send(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
) {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data =
      res.status === 204
        ? null
        : ((await res.json().catch(() => null)) as {
            message?: string;
            errors?: Record<string, string>;
          } | null);
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

// Answers that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = [
  'jobTitleExists',
  'jobTitleInUse',
  'notFound',
  'forbidden',
];

/** Job titles (CS-09, FR-CS-9): add, rename, and remove those no employee uses (D-48) */
export default function JobTitlesCard({ items }: { items: JobTitle[] }) {
  const t = useTranslations('Settings.jobTitles');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();

  // null = adding a new one; an id = renaming that one
  const [editing, setEditing] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function startEdit(title: JobTitle) {
    setEditing(title.id);
    setNameAr(title.nameAr);
    setNameEn(title.nameEn);
    setErrors({});
  }

  function resetForm() {
    setEditing(null);
    setNameAr('');
    setNameEn('');
    setErrors({});
  }

  const message = (key?: string) =>
    key ? tErr(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong') : undefined;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const body = { nameAr, nameEn };
    const check = jobTitleSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    setBusy(true);
    const { status, data } = editing
      ? await send('PATCH', `/job-titles/${editing}`, body)
      : await send('POST', '/job-titles', body);
    setBusy(false);
    if (status === 200 || status === 201) {
      resetForm();
      router.refresh();
      return;
    }
    setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
  }

  async function remove(title: JobTitle) {
    setBusy(true);
    const { status, data } = await send('DELETE', `/job-titles/${title.id}`);
    setBusy(false);
    if (status === 204) {
      if (editing === title.id) resetForm();
      router.refresh();
      return;
    }
    setErrors({ form: data?.message ?? 'somethingWrong' });
  }

  const sorted = [...items].sort((a, b) =>
    locale === 'ar'
      ? a.nameAr.localeCompare(b.nameAr, 'ar')
      : a.nameEn.localeCompare(b.nameEn, 'en'),
  );

  return (
    <Card>
      <CardHeader title={t('title')} hint={t('hint')} />

      {sorted.length === 0 ? (
        <p className="mb-4 text-sm text-muted">{t('empty')}</p>
      ) : (
        <ul className="mb-5 divide-y divide-line rounded-[10px] border border-line">
          {sorted.map((title) => (
            <li key={title.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {locale === 'ar' ? title.nameAr : title.nameEn}
                </p>
                <p className="truncate text-xs text-muted">
                  {locale === 'ar' ? title.nameEn : title.nameAr}
                  {' · '}
                  {t('employees', { count: title.employeeCount })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(title)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-text"
                aria-label={t('rename', { name: title.nameEn })}
              >
                <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
              <button
                type="button"
                disabled={busy || title.employeeCount > 0}
                onClick={() => remove(title)}
                title={
                  title.employeeCount > 0 ? tErr('jobTitleInUse') : undefined
                }
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
                aria-label={t('remove', { name: title.nameEn })}
              >
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={save} noValidate className="flex flex-col gap-3">
        <p className="text-[13px] font-medium">
          {editing ? t('renameTitle') : t('addTitle')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('nameEn')} error={message(errors.nameEn)}>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              dir="ltr"
              placeholder="Cashier"
              className={inputClass(!!errors.nameEn)}
            />
          </Field>
          <Field label={t('nameAr')} error={message(errors.nameAr)}>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
              placeholder="كاشير"
              className={inputClass(!!errors.nameAr)}
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
        <div className="flex justify-end gap-2">
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
            >
              {t('cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {editing ? t('save') : t('add')}
          </button>
        </div>
      </form>
    </Card>
  );
}
