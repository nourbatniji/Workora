'use client';

import { Bell, Menu, MessageSquare, Moon, Sun, UserPlus } from 'lucide-react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { navItemForPath } from '@/lib/nav';
import { employeeById, type Locale } from '@/mock/people';
import IconButton from '@/components/ui/icon-button';
import Popover from '@/components/ui/popover';
import { useAppState } from './app-state';
import { useRole } from './current-user';
import RoleSwitcher from './role-switcher';
import UserMenu from './user-menu';

export default function TopBar() {
  const t = useTranslations('Shell');
  const tNav = useTranslations('Nav');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const {
    theme,
    toggleTheme,
    open,
    unreadCount,
    notificationsOpen,
    setNotificationsOpen,
  } = useAppState();
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

      <div className="hidden md:block">
        <RoleSwitcher />
      </div>

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

      <Popover
        label={t('notifications')}
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        trigger={({ toggle }) => (
          <IconButton
            icon={Bell}
            label={t('notifications')}
            badge={unreadCount}
            onClick={toggle}
            aria-expanded={notificationsOpen}
          />
        )}
      >
        {() => <NotificationsPanel locale={locale} />}
      </Popover>

      <div className="hidden sm:block">
        <Popover
          label={t('messages')}
          width="w-72"
          trigger={({ toggle, open: isOpen }) => (
            <IconButton
              icon={MessageSquare}
              label={t('messages')}
              onClick={toggle}
              aria-expanded={isOpen}
            />
          )}
        >
          {() => <MessagesPanel />}
        </Popover>
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

function NotificationsPanel({ locale }: { locale: Locale }) {
  const t = useTranslations('Notifications');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { notifications, unreadCount, markRead, markAllRead } = useAppState();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
        <div>
          <p className="text-sm font-medium">{t('title')}</p>
          <p className="text-xs text-muted">
            {t('unread', { count: unreadCount })}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="rounded-md px-2 py-1 text-xs text-accent-fg hover:bg-canvas"
          >
            {t('markAllRead')}
          </button>
        )}
      </div>
      <ul className="thin-scroll max-h-80 overflow-y-auto">
        {notifications.map((n) => {
          const name =
            typeof n.params.name === 'string'
              ? employeeById(n.params.name).name[locale]
              : '';
          const when = new Date(now.getTime() - n.minutesAgo * 60_000);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => markRead(n.id)}
                className="flex w-full items-start gap-3 rounded-[10px] px-2 py-2.5 text-start hover:bg-canvas"
              >
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] ${n.read ? 'text-muted' : 'text-text'}`}
                  >
                    {t(n.type, {
                      ...n.params,
                      name,
                      count: n.params.count ?? 0,
                      days: n.params.days ?? 0,
                    })}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {format.relativeTime(when, now)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MessagesPanel() {
  const t = useTranslations('Messages');
  return (
    <div className="px-3 py-6 text-center">
      <MessageSquare
        className="mx-auto size-6 text-muted"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="mt-2 text-sm font-medium">{t('empty')}</p>
      <p className="mt-1 text-xs text-muted">{t('emptyHint')}</p>
    </div>
  );
}
