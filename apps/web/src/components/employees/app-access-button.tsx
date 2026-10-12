'use client';

import { employeeAccessSchema, type EmployeeListItem } from '@mdarj/shared';
import { Smartphone } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field, inputClass } from '@/components/ui/field';
import Modal from '@/components/ui/modal';
import InviteLinkBox from '@/components/users/invite-link-box';
import { useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

type Answer = {
  inviteLink?: string;
  emailSent?: boolean;
  user?: { email: string | null };
  message?: string;
  errors?: Record<string, string>;
};

const FORM_ERRORS = [
  'employeeHasLogin',
  'employeeTerminated',
  'notFound',
  'forbidden',
];

const BADGE: Record<'invited' | 'active' | 'deactivated', string> = {
  invited: 'bg-nav-selected text-accent-fg',
  active: 'bg-success/10 text-text',
  deactivated: 'bg-canvas text-muted',
};

/**
 * The "App access" cell (D-77): a badge when the employee already has a login, otherwise a button
 * that opens the invite dialog. The login it creates is connected to this employee.
 */
export default function AppAccessButton({
  employee,
}: {
  employee: EmployeeListItem;
}) {
  const t = useTranslations('Employees.access');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const name = locale === 'ar' ? employee.nameAr : employee.nameEn;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(employee.email ?? '');
  const [phone, setPhone] = useState(employee.phone ?? '');
  const [language, setLanguage] = useState(locale === 'ar' ? 'ar' : 'en');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{
    link: string;
    emailedTo: string | null;
  } | null>(null);

  if (employee.login) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${BADGE[employee.login.status]}`}
      >
        {t(
          employee.login.status === 'deactivated'
            ? 'off'
            : employee.login.status,
        )}
      </span>
    );
  }
  if (employee.status === 'terminated') {
    return <span className="text-xs text-muted">{t('none')}</span>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = { email, phone, language };
    const check = employeeAccessSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setErrors({ form: 'emailOrPhoneRequired' });
      return;
    }
    setErrors({});
    setSending(true);
    const { status, data } = await postJson<Answer>(
      `/employees/${employee.id}/access`,
      body,
    );
    setSending(false);
    if (status === 201 && data?.inviteLink) {
      setCreated({
        link: data.inviteLink,
        emailedTo: data.emailSent ? (data.user?.email ?? null) : null,
      });
      return;
    }
    if (data?.errors) {
      setErrors(data.errors);
      return;
    }
    const key = data?.message ?? '';
    setErrors({ form: FORM_ERRORS.includes(key) ? key : 'somethingWrong' });
  }

  function close() {
    setOpen(false);
    if (created) router.refresh(); // the row now says "Invited"
    setCreated(null);
  }

  const error = (field: string) =>
    errors[field] ? tErr(errors[field]) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] whitespace-nowrap hover:bg-canvas"
      >
        <Smartphone className="size-3.5" strokeWidth={1.5} aria-hidden />
        {t('give')}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={t('title', { name })}
        description={created ? undefined : t('description')}
        closeLabel={t('cancel')}
      >
        {created ? (
          <div>
            <InviteLinkBox link={created.link} emailedTo={created.emailedTo} />
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
              >
                {t('done')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            {errors.form && (
              <p role="alert" className="text-sm text-danger">
                {tErr(errors.form)}
              </p>
            )}
            <Field
              label={t('email')}
              hint={t('optional')}
              error={error('email')}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                className={`${inputClass(!!errors.email)} rtl:text-end`}
              />
            </Field>
            <Field
              label={t('phone')}
              hint={t('optional')}
              error={error('phone')}
            >
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                dir="ltr"
                className={`${inputClass(!!errors.phone)} rtl:text-end`}
              />
            </Field>
            <p className="-mt-2 text-xs text-muted">{t('needOne')}</p>
            <Field label={t('language')} error={error('language')}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={inputClass(false)}
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={sending}
                className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {sending ? t('sending') : t('submit')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
