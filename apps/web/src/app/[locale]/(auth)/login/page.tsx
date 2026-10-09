import { getTranslations } from 'next-intl/server';
import LoginForm from '@/components/auth/login-form';
import { safeNext } from '@/lib/session';

export default async function LoginPage({
  searchParams,
}: PageProps<'/[locale]/login'>) {
  const t = await getTranslations('Auth.login');
  const tErr = await getTranslations('Errors');
  const { next, reason } = await searchParams;

  return (
    <>
      <h1 className="text-xl font-medium text-text">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      {/* The (app) layout sent us here because the session ended (SCRUM-169) */}
      {reason === 'expired' && (
        <p
          role="status"
          className="mt-4 rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text"
        >
          {tErr('sessionExpired')}
        </p>
      )}
      <LoginForm next={safeNext(next)} />
    </>
  );
}
