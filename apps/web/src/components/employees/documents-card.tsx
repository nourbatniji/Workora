'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FILE_MIME_TYPES,
  MAX_FILE_BYTES,
  uploadEmployeeDocumentSchema,
  type EmployeeDocumentList,
} from '@mdarj/shared';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { errorsByField } from '@/lib/form-errors';

export default function DocumentsCard({
  employeeId,
  documents,
  dates,
}: {
  employeeId: string;
  documents: EmployeeDocumentList;
  dates: Record<string, string | null>;
}) {
  const t = useTranslations('Employees.documents');
  const common = useTranslations('Employees.profile');
  const tErr = useTranslations('Errors');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const base = `/api/employees/${employeeId}/documents`;
  const message = (key: string) =>
    tErr.has(key) ? tErr(key) : tErr('somethingWrong');
  const button =
    'min-h-9 rounded-[10px] border border-line px-3 text-sm hover:bg-canvas disabled:opacity-60';

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const check = uploadEmployeeDocumentSchema.safeParse({
      docType: body.get('docType'),
      expiryDate: body.get('expiryDate'),
    });
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    const file = body.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setErrors({ file: 'fileRequired' });
      return;
    }
    if (
      !FILE_MIME_TYPES.includes(file.type as (typeof FILE_MIME_TYPES)[number])
    ) {
      setErrors({ file: 'fileTypeInvalid' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrors({ file: 'fileTooLarge' });
      return;
    }
    body.set('docType', check.data.docType);
    body.set('expiryDate', check.data.expiryDate ?? '');
    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      const response = await fetch(base, { method: 'POST', body });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErrors(data?.errors ?? { form: data?.message ?? 'somethingWrong' });
        return;
      }
      form.reset();
      setEditing(false);
      setSaved(true);
      router.refresh();
    } catch {
      setErrors({ form: 'somethingWrong' });
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    setBusy(true);
    setErrors({});
    try {
      const response = await fetch(`${base}/${id}/file`, { cache: 'no-store' });
      if (!response.ok) {
        setErrors({ form: 'somethingWrong' });
        return;
      }
      const link: { url: string } = await response.json();
      window.location.assign(link.url);
    } catch {
      setErrors({ form: 'somethingWrong' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setErrors({});
    setSaved(false);
    try {
      const response = await fetch(`${base}/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        setErrors({ form: 'somethingWrong' });
        return;
      }
      setDeleting(null);
      setSaved(true);
      router.refresh();
    } catch {
      setErrors({ form: 'somethingWrong' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('title')}
        hint={t('hint')}
        action={
          !editing && (
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                setEditing(true);
                setErrors({});
                setSaved(false);
                setDeleting(null);
              }}
            >
              {t('add')}
            </button>
          )
        }
      />
      {saved && (
        <p role="status" className="mb-3 text-sm text-muted">
          {common('saved')}
        </p>
      )}
      {errors.form && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {message(errors.form)}
        </p>
      )}
      {editing && (
        <form
          onSubmit={upload}
          noValidate
          className="mb-4 flex flex-col gap-4 border-b border-line pb-4"
        >
          <Field
            label={t('type')}
            error={errors.docType ? message(errors.docType) : undefined}
          >
            <input
              name="docType"
              maxLength={100}
              className={inputClass(!!errors.docType)}
              disabled={busy}
            />
          </Field>
          <Field
            label={t('expiry')}
            hint={t('optional')}
            error={errors.expiryDate ? message(errors.expiryDate) : undefined}
          >
            <input
              name="expiryDate"
              type="date"
              className={inputClass(!!errors.expiryDate)}
              disabled={busy}
            />
          </Field>
          <Field
            label={t('file')}
            hint={t('formats')}
            error={errors.file ? message(errors.file) : undefined}
          >
            <input
              name="file"
              type="file"
              accept={FILE_MIME_TYPES.join(',')}
              disabled={busy}
              className="block w-full min-w-0 text-sm file:me-3 file:rounded-lg file:border file:border-line file:bg-canvas file:px-3 file:py-2 file:text-text"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setErrors({});
              }}
            >
              {common('cancel')}
            </button>
            <button
              type="submit"
              className="min-h-9 rounded-[10px] bg-accent px-3 text-sm text-white disabled:opacity-60"
              disabled={busy}
            >
              {busy ? common('saving') : t('upload')}
            </button>
          </div>
        </form>
      )}
      {documents.items.length === 0 ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {documents.items.map((document) => (
            <li
              key={document.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">
                  {document.docType}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {dates[document.id]
                    ? t('expires', { date: dates[document.id]! })
                    : t('noExpiry')}
                </p>
              </div>
              {deleting === document.id ? (
                <div className="w-full rounded-lg border border-line bg-canvas p-3">
                  <p className="mb-3 text-sm">
                    {t('confirm', { type: document.docType })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => setDeleting(null)}
                    >
                      {common('cancel')}
                    </button>
                    <button
                      type="button"
                      className={`${button} text-danger`}
                      disabled={busy}
                      onClick={() => void remove(document.id)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void download(document.id)}
                  >
                    {t('view')}
                  </button>
                  <button
                    type="button"
                    className={`${button} text-danger`}
                    disabled={busy}
                    onClick={() => {
                      setDeleting(document.id);
                      setSaved(false);
                      setErrors({});
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
