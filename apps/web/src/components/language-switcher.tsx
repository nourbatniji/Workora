'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LanguageSwitcher() {
  const t = useTranslations('Shell');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: otherLocale })}
      className="rounded border px-3 py-1 text-sm"
    >
      {t('switchLanguage')}
    </button>
  );
}