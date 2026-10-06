import { getTranslations } from 'next-intl/server';
import ForgotPasswordForm from '@/components/auth/forgot-password-form';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('Auth.forgot');

  return (
    <>
      <h1 className="text-xl font-medium text-text">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      <ForgotPasswordForm />
    </>
  );
}
