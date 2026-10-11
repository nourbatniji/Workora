'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PASSWORD_MIN_LENGTH, signUpSchema } from '@mdarj/shared';
import PasswordInput from '@/components/auth/password-input';
import { Field } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';

// Same password rules as sign-up (D-43)
const passwordSchema = signUpSchema.shape.password;

// Answers from the API that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = ['inviteInvalid', 'inviteExpired'];

/**
 * Set a password from an invite link (UA-01). On success the API activates the account
 * and logs the person in (session cookie), so we go straight into the app.
 */
export default function SetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const tErr = useTranslations('Errors');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    password?: string;
    confirm?: string;
    form?: string;
  }>({});
  const [sending, setSending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = passwordSchema.safeParse(password);
    const next: typeof errors = {};
    if (!check.success) next.password = check.error.issues[0].message;
    else if (confirm !== password) next.confirm = 'passwordsDontMatch';
    setErrors(next);
    if (next.password || next.confirm) return;

    // Ask the API; on success it sets the session cookie
    setSending(true);
    const { status, data } = await postJson(
      `/auth/invites/${encodeURIComponent(token)}/accept`,
      { password },
    );
    setSending(false);

    if (status === 200) {
      // Into the app; refresh so the (app) layout sees the new session
      router.replace('/');
      router.refresh();
      return;
    }
    if (status === 400 && data?.errors?.password) {
      setErrors({ password: data.errors.password });
      return;
    }
    const key = data?.message ?? '';
    setErrors({ form: KNOWN_ERRORS.includes(key) ? key : 'somethingWrong' });
  }

  const message = (key?: string) =>
    key ? tErr(key, { min: PASSWORD_MIN_LENGTH }) : undefined;

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field
        label={t('setPassword.password')}
        hint={t('signUp.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={message(errors.password)}
      >
        <PasswordInput
          value={password}
          onChange={setPassword}
          invalid={!!errors.password}
          autoComplete="new-password"
        />
      </Field>

      <Field label={t('setPassword.confirm')} error={message(errors.confirm)}>
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          invalid={!!errors.confirm}
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
        {sending ? t('sending') : t('setPassword.submit')}
      </button>
    </form>
  );
}
