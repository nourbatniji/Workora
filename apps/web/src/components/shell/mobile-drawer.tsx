'use client';

import { Moon, Sun, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import IconButton from '@/components/ui/icon-button';
import { useAppState } from './app-state';
import IconRail from './icon-rail';
import NavPanel from './nav-panel';
import RoleSwitcher from './role-switcher';

/**
 * Below 1024px the sidebar slides in from the start side (left in English, right in Arabic).
 * Tablets keep the 64px rail on screen; phones get the rail inside this drawer.
 */
export default function MobileDrawer() {
  const t = useTranslations('Shell');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { overlay, close, theme, toggleTheme } = useAppState();
  const isOpen = overlay === 'menu';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t('mainNav')}
    >
      <div
        className="absolute inset-0 bg-[rgb(15_18_34/0.32)]"
        onClick={close}
      />
      <div className="absolute inset-y-0 start-0 flex w-[304px] flex-col bg-surface md:w-60">
        {/* Close button sits on the backdrop, just outside the drawer's end edge */}
        <div className="absolute -end-12 top-3.5">
          <IconButton icon={X} label={t('closeMenu')} onClick={close} />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="md:hidden">
            <IconRail onNavigate={close} />
          </div>
          <NavPanel onNavigate={close} />
        </div>
        {/* Controls that don't fit in the phone top bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-3 md:hidden">
          <button
            type="button"
            onClick={() => {
              close();
              router.replace(pathname, {
                locale: locale === 'ar' ? 'en' : 'ar',
              });
            }}
            aria-label={t('switchLanguageLabel')}
            className="inline-flex h-9 items-center rounded-[10px] border border-line px-3 text-[13px]"
          >
            {t('switchLanguage')}
          </button>
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
            onClick={toggleTheme}
          />
          <RoleSwitcher />
        </div>
      </div>
    </div>
  );
}
