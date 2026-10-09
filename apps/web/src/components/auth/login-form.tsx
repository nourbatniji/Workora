'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { loginSchema, PASSWORD_MIN_LENGTH } from '@mdarj/shared';
import PasswordInput from '@/components/auth/password-input';
import { Field, inputClass } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

// Answers from the API that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = ['invalidCredentials', 'accountDeactivated'];

/**
 * Log in with email or phone (UA-03). Checks in the browser first, then asks the API.
 * next: the page to open after login, already checked by safeNext() (SCRUM-169).
 */
export default function LoginForm({ next = '/' }: { next?: string }) {
  const t = useTranslations('Auth');
  const tErr = useTranslations('Errors');
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // 1. Same rules as the server (shared schema), so mistakes show without a round trip
    const check = loginSchema.safeParse({ identifier, password });
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }

    // 2. Ask the API; on success it sets the session cookie
    setErrors({});
    setSending(true);
    const { status, data } = await postJson('/auth/login', {
      identifier,
      password,
    });
    setSending(false);

    if (status === 200) {
      // Back to the page that sent us to login; refresh so the (app) layout sees the new session
      router.replace(next);
      router.refresh();
      return;
    }
    const key = data?.message ?? '';
    setErrors({ form: KNOWN_ERRORS.includes(key) ? key : 'somethingWrong' });
  }

  // Error keys become sentences in the page's language; {min} is used by passwordTooShort
  const message = (key?: string) =>
    key ? tErr(key, { min: PASSWORD_MIN_LENGTH }) : undefined;

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field
        label={t('login.identifier')}
        hint={t('login.identifierHint')}
        error={message(errors.identifier)}
      >
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          dir="ltr"
          autoComplete="username"
          className={`${inputClass(!!errors.identifier)} rtl:text-end`}
        />
      </Field>

      <Field label={t('login.password')} error={message(errors.password)}>
        <PasswordInput
          value={password}
          onChange={setPassword}
          invalid={!!errors.password}
          autoComplete="current-password"
        />
      </Field>

      <div className="-mt-1 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-[13px] text-accent-fg hover:underline"
        >
          {t('login.forgot')}
        </Link>
      </div>

      {errors.form && (
        <p
          role="alert"
          className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
        >
          {message(errors.form)}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="h-10 w-full rounded-[10px] bg-accent text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {sending ? t('sending') : t('login.submit')}
      </button>

      <p className="text-center text-[13px] text-muted">
        {t('login.noAccount')}{' '}
        <Link href="/sign-up" className="text-accent-fg hover:underline">
          {t('login.signUpLink')}
        </Link>
      </p>
    </form>
  );
}
