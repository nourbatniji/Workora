import { getTranslations } from 'next-intl/server';
import SignUpForm from '@/components/auth/sign-up-form';

export default async function SignUpPage() {
  const t = await getTranslations('Auth.signUp');

  return (
    <>
      <h1 className="text-xl font-medium text-text">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      <SignUpForm />
    </>
  );
}
