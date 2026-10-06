'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PASSWORD_MIN_LENGTH, signUpSchema } from '@mdarj/shared';
import PasswordInput from '@/components/auth/password-input';
import { Field } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';

// Same password rules as sign-up (D-43)
const passwordSchema = signUpSchema.shape.password;

/**
 * Set a password from an invite or reset link (UA-01, UA-04). View only for now:
 * saving arrives with UA-01, which also checks the link's token.
 */
export default function SetPasswordForm() {
  const t = useTranslations('Auth');
  const tErr = useTranslations('Errors');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = passwordSchema.safeParse(password);
    const next: typeof errors = {};
    if (!check.success) next.password = check.error.issues[0].message;
    else if (confirm !== password) next.confirm = 'passwordsDontMatch';
    setErrors(next);
    if (next.password || next.confirm) return;

    // UA-01 will call POST /api/auth/set-password with the link's token here
    router.push('/login');
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

      <button
        type="submit"
        className="h-10 w-full rounded-[10px] bg-accent text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {t('setPassword.submit')}
      </button>
    </form>
  );
}
