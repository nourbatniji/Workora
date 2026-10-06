import { getTranslations } from 'next-intl/server';
import LoginForm from '@/components/auth/login-form';

export default async function LoginPage() {
  const t = await getTranslations('Auth.login');

  return (
    <>
      <h1 className="text-xl font-medium text-text">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      <LoginForm />
    </>
  );
}
