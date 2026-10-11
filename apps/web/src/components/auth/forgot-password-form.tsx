'use client';

import { MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { signUpSchema } from '@mdarj/shared';
import { Field, inputClass } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import { postJson } from '@/lib/api';

// Same email rules as sign-up: trimmed, lowercased, valid
const emailSchema = signUpSchema.shape.email;

/**
 * Forgot password (UA-04, FR-UA-4): the API emails a 1-hour link when the email has an
 * Active account. The "check your email" screen never says whether the account exists.
 */
export default function ForgotPasswordForm() {
  const t = useTranslations('Auth');
  const tErr = useTranslations('Errors');

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [sending, setSending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = emailSchema.safeParse(email);
    if (!check.success) {
      setError(check.error.issues[0].message);
      return;
    }

    setError(undefined);
    setSending(true);
    const { status } = await postJson('/auth/password-reset', {
      email: check.data,
    });
    setSending(false);

    // 204 whether or not the account exists; anything else is a real failure
    if (status === 204) {
      setSentTo(check.data);
      return;
    }
    setError(status === 400 ? 'emailInvalid' : 'somethingWrong');
  }

  if (sentTo) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-nav-selected text-accent-fg">
          <MailCheck className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="text-base font-medium text-text">
          {t('forgot.sentTitle')}
        </h2>
        <p className="text-sm text-muted">
          {t('forgot.sentBody', { email: sentTo })}
        </p>
        <p className="text-[13px] text-muted">{t('forgot.noEmail')}</p>
        <Link
          href="/login"
          className="mt-2 text-sm text-accent-fg hover:underline"
        >
          {t('forgot.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field label={t('forgot.email')} error={error ? tErr(error) : undefined}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          dir="ltr"
          autoComplete="email"
          className={`${inputClass(!!error)} rtl:text-end`}
        />
      </Field>

      <button
        type="submit"
        disabled={sending}
        className="h-10 w-full rounded-[10px] bg-accent text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {sending ? t('sending') : t('forgot.submit')}
      </button>

      <p className="text-center text-[13px] text-muted">
        {t('forgot.noEmail')}
      </p>
      <Link
        href="/login"
        className="text-center text-sm text-accent-fg hover:underline"
      >
        {t('forgot.backToLogin')}
      </Link>
    </form>
  );
}
