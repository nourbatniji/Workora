'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { createUserSchema, USER_ROLES } from '@mdarj/shared';
import InviteLinkBox from '@/components/users/invite-link-box';
import { Field, inputClass } from '@/components/ui/field';
import Modal from '@/components/ui/modal';
import { useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';
import { useAppState } from './app-state';

/** Invite a person (UA-01, UA-02): the Admin creates the user, MDARJ makes a 7-day link to copy, and emails it when there is an email */
export default function InviteDialog() {
  const t = useTranslations('Invite');
  const tShell = useTranslations('Shell');
  const { overlay, close } = useAppState();

  return (
    <Modal
      open={overlay === 'invite'}
      onClose={close}
      title={t('title')}
      description={t('description')}
      closeLabel={tShell('close')}
    >
      <InviteForm onDone={close} />
    </Modal>
  );
}

type Role = (typeof USER_ROLES)[number];

/**
 * Roles this dialog invites (D-77): Admins and Interviewers. Employees get app access from the
 * Employees list, so their login is connected to their employee record.
 */
const INVITE_ROLES = USER_ROLES.filter((r) => r !== 'employee');

/** The answer of POST /users, or an error ({ message, errors? }) */
type CreateAnswer = {
  user?: { name: string | null; email: string | null };
  inviteLink?: string;
  emailSent?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

// Answers from the API that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = ['forbidden', 'notLoggedIn', 'sessionExpired', 'conflict'];

function InviteForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Invite');
  const tErr = useTranslations('Errors');
  const tRoles = useTranslations('Users.roles');
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('interviewer');
  // The invite opens in this language; it starts as the page's language (D-66)
  const [language, setLanguage] = useState(locale === 'ar' ? 'ar' : 'en');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{
    name: string;
    link: string;
    emailedTo: string | null;
  } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = { name, phone, email, role, language };

    // 1. Same rules as the server (shared schema), so mistakes show without a round trip
    const check = createUserSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }

    // 2. Ask the API: it creates the user, the link, and sends the email
    setErrors({});
    setSending(true);
    const { status, data } = await postJson<CreateAnswer>('/users', body);
    setSending(false);

    if (status === 201 && data?.inviteLink) {
      setCreated({
        name: data.user?.name ?? name.trim(),
        link: data.inviteLink,
        emailedTo: data.emailSent ? (data.user?.email ?? null) : null,
      });
      router.refresh(); // the Users page shows the new person
      return;
    }
    if (data?.errors) {
      setErrors(data.errors); // e.g. { email: 'emailTaken' }
      return;
    }
    const key = data?.message ?? '';
    setErrors({ form: KNOWN_ERRORS.includes(key) ? key : 'somethingWrong' });
  }

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setRole('interviewer');
    setErrors({});
    setCreated(null);
  }

  const message = (key?: string) => (key ? tErr(key) : undefined);

  if (created) {
    return (
      <div>
        <p className="mb-3 text-sm font-medium">
          {t('readyTitle', { name: created.name })}
        </p>
        <InviteLinkBox link={created.link} emailedTo={created.emailedTo} />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
          >
            {t('another')}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
          >
            {t('done')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={t('name')} error={message(errors.name)}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className={inputClass(!!errors.name)}
          autoFocus
        />
      </Field>
      <Field label={t('phone')} error={message(errors.phone)}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('phonePlaceholder')}
          inputMode="tel"
          dir="ltr"
          className={`${inputClass(!!errors.phone)} rtl:text-end`}
        />
      </Field>
      <Field
        label={t('email')}
        hint={t('optional')}
        error={message(errors.email)}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          type="email"
          dir="ltr"
          className={`${inputClass(!!errors.email)} rtl:text-end`}
        />
      </Field>
      <p className="-mb-1 text-xs text-muted">{t('employeesHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('role')} error={message(errors.role)}>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={inputClass(!!errors.role)}
          >
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('language')} error={message(errors.language)}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={inputClass(!!errors.language)}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
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

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
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
  );
}
