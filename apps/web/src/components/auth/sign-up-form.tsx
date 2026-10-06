'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PASSWORD_MIN_LENGTH, signUpSchema } from '@mdarj/shared';
import PasswordInput from '@/components/auth/password-input';
import { Field, inputClass } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import { errorsByField } from '@/lib/form-errors';

/** Company sign-up (CS-01): creates the company and its first Admin, then logs them in. */
export default function SignUpForm() {
  const t = useTranslations('Auth');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();

  const [values, setValues] = useState({
    companyName: '',
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // One change handler for all four boxes
  const set = (field: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // 1. Same rules as the server; the account starts in the page's language
    const body = { ...values, language: locale };
    const check = signUpSchema.safeParse(body);
    if (!check.success) {
      setErrors(errorsByField(check.error.issues));
      return;
    }

    setErrors({});
    setSending(true);

    // 2. Create the company and its Admin
    const signUp = await postJson('/auth/sign-up', body);
    if (signUp.status !== 201) {
      setSending(false);
      // 400 and 409 carry one key per field, e.g. { email: 'emailTaken' }
      setErrors(signUp.data?.errors ?? { form: 'somethingWrong' });
      return;
    }

    // 3. Log straight in, so Mona doesn't type her password twice
    const login = await postJson('/auth/login', {
      identifier: values.email,
      password: values.password,
    });
    setSending(false);
    router.push(login.status === 200 ? '/' : '/login');
  }

  const message = (key?: string) =>
    key ? tErr(key, { min: PASSWORD_MIN_LENGTH }) : undefined;

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field
        label={t('signUp.companyName')}
        error={message(errors.companyName)}
      >
        <input
          value={values.companyName}
          onChange={(e) => set('companyName')(e.target.value)}
          autoComplete="organization"
          className={inputClass(!!errors.companyName)}
        />
      </Field>

      <Field label={t('signUp.name')} error={message(errors.name)}>
        <input
          value={values.name}
          onChange={(e) => set('name')(e.target.value)}
          autoComplete="name"
          className={inputClass(!!errors.name)}
        />
      </Field>

      <Field label={t('signUp.email')} error={message(errors.email)}>
        <input
          value={values.email}
          onChange={(e) => set('email')(e.target.value)}
          type="email"
          dir="ltr"
          autoComplete="email"
          className={`${inputClass(!!errors.email)} rtl:text-end`}
        />
      </Field>

      <Field
        label={t('signUp.password')}
        hint={t('signUp.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={message(errors.password)}
      >
        <PasswordInput
          value={values.password}
          onChange={set('password')}
          invalid={!!errors.password}
          autoComplete="new-password"
        />
      </Field>

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
        {sending ? t('sending') : t('signUp.submit')}
      </button>

      <p className="text-center text-[13px] text-muted">
        {t('signUp.haveAccount')}{' '}
        <Link href="/login" className="text-accent-fg hover:underline">
          {t('signUp.loginLink')}
        </Link>
      </p>
    </form>
  );
}
