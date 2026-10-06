'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/** The same page in the other language (/en/login ↔ /ar/login) */
export default function AuthLanguageLink() {
  const t = useTranslations('Shell');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <Link
      href={pathname}
      locale={locale === 'ar' ? 'en' : 'ar'}
      aria-label={t('switchLanguageLabel')}
      className="inline-flex h-9 items-center rounded-[10px] border border-line bg-surface px-3 text-[13px] text-text"
    >
      {t('switchLanguage')}
    </Link>
  );
}
