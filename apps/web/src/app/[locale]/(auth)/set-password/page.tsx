import { Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SetPasswordForm from '@/components/auth/set-password-form';
import { Link } from '@/i18n/navigation';

/**
 * Opened from an invite or reset link: /set-password?token=…
 * Until UA-01 checks real tokens, /set-password?expired=1 shows the expired screen.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const t = await getTranslations('Auth.setPassword');
  const { expired } = await searchParams;

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-nav-selected text-accent-fg">
          <Clock className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className="text-xl font-medium text-text">{t('expiredTitle')}</h1>
        <p className="text-sm text-muted">{t('expiredBody')}</p>
        <Link
          href="/login"
          className="mt-2 text-sm text-accent-fg hover:underline"
        >
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-medium text-text">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      <SetPasswordForm />
    </>
  );
}
