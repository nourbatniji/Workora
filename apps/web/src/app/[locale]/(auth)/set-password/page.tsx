import { Clock, Link2Off } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SetPasswordForm from '@/components/auth/set-password-form';
import { Link } from '@/i18n/navigation';
import { getInvite } from '@/lib/invites';

/**
 * Opened from an invite link: /set-password?token=… (UA-01).
 * The server asks the API whether the link is still good before showing the form.
 */
export default async function SetPasswordPage({
  searchParams,
}: PageProps<'/[locale]/set-password'>) {
  const t = await getTranslations('Auth.setPassword');
  const { token } = await searchParams;
  const value = typeof token === 'string' ? token : undefined;
  const check = await getInvite(value);

  if (!check.invite) {
    const expired = check.reason === 'inviteExpired';
    const Icon = expired ? Clock : Link2Off;
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-nav-selected text-accent-fg">
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className="text-xl font-medium text-text">
          {expired ? t('expiredTitle') : t('invalidTitle')}
        </h1>
        <p className="text-sm text-muted">
          {expired ? t('expiredBody') : t('invalidBody')}
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm text-accent-fg hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  const { user, company } = check.invite;
  return (
    <>
      <h1 className="text-xl font-medium text-text">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">
        {t('invitedTo', { name: user.name ?? '', company: company.name })}
      </p>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      <SetPasswordForm token={value!} />
    </>
  );
}
