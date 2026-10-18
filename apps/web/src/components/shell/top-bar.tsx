'use client';

import { Menu, Moon, Sun, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { navItemForPath } from '@/lib/nav';
import IconButton from '@/components/ui/icon-button';
import { useAppState } from './app-state';
import { useRole } from './current-user';
import UserMenu from './user-menu';

export default function TopBar() {
  const t = useTranslations('Shell');
  const tNav = useTranslations('Nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme, open } = useAppState();
  const role = useRole();
  const title = tNav(navItemForPath(pathname)?.key ?? 'dashboard');
  const otherLocale = locale === 'ar' ? 'en' : 'ar';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-canvas/90 px-4 backdrop-blur md:px-6">
      <IconButton
        icon={Menu}
        label={t('openMenu')}
        className="lg:hidden"
        onClick={() => open('menu')}
      />

      <h1 className="min-w-0 flex-1 truncate text-lg font-medium md:text-xl">
        {title}
      </h1>

      {/* Language and theme: inside the menu on phones, to keep the bar inside 360px */}
      <button
        type="button"
        onClick={() => router.replace(pathname, { locale: otherLocale })}
        aria-label={t('switchLanguageLabel')}
        title={t('switchLanguageLabel')}
        lang={otherLocale}
        className="hidden h-9 items-center rounded-[10px] border border-line bg-surface px-3 text-[13px] transition-colors hover:bg-canvas sm:inline-flex"
      >
        {t('switchLanguage')}
      </button>
      <div className="hidden sm:block">
        <IconButton
          icon={theme === 'dark' ? Sun : Moon}
          label={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
          onClick={toggleTheme}
        />
      </div>

      {/* Inviting people is an Admin action (requirements/permissions.md §3) */}
      {role === 'admin' && (
        <button
          type="button"
          onClick={() => open('invite')}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 lg:px-3.5"
          aria-label={t('invite')}
        >
          <UserPlus className="size-[18px]" strokeWidth={1.5} aria-hidden />
          <span className="hidden lg:inline">{t('invite')}</span>
        </button>
      )}

      <UserMenu />
    </header>
  );
}
