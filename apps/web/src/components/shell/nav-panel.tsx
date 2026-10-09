'use client';

import { Bookmark, ChevronRight, Scale, Search } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { SAVED_VIEWS, navItemForPath, navItemsFor } from '@/lib/nav';
import { payrollProgress } from '@/mock/shell';
import { useExceptions } from '@/components/exceptions/exceptions-store';
import { useAppState } from './app-state';
import { useCurrentUser, useRole } from './current-user';

/** True on Apple devices, so the search hint shows ⌘K instead of Ctrl K */
function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the platform is only known in the browser
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return isMac;
}

/** The 240px panel: search, navigation, saved views, payroll progress, law reference, company */
export default function NavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Shell');
  const tNav = useTranslations('Nav');
  const tViews = useTranslations('SavedViews');
  const tRoles = useTranslations('Roles');
  const format = useFormatter();
  const user = useCurrentUser();
  const role = useRole();
  const pathname = usePathname();
  const active = navItemForPath(pathname);
  const { open } = useAppState();
  const { pendingCount } = useExceptions();
  const isMac = useIsMac();
  const progress =
    (payrollProgress.stepsDone / payrollProgress.stepsTotal) * 100;

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-e border-line bg-surface">
      {/* The real company of the logged-in user (GET /auth/me), like a workspace switcher */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-4">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-canvas text-[13px] font-medium">
          {initialOf(user.company.name)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{user.company.name}</p>
          <p className="truncate text-xs text-muted">{tRoles(role)}</p>
        </div>
      </div>

      <div className="thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3 *:shrink-0">
        {/* Looks like a field, opens the command palette */}
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            open('palette');
          }}
          className="mb-4 flex h-9 w-full items-center gap-2 rounded-[10px] border border-line bg-canvas px-3 text-[13px] text-muted transition-colors hover:border-muted/40"
        >
          <Search className="size-4" strokeWidth={1.5} aria-hidden />
          <span className="flex-1 text-start">{t('search')}</span>
          <kbd
            className="rounded-md border border-line bg-surface px-1.5 font-sans text-[11px] text-muted"
            dir="ltr"
          >
            {isMac ? t('searchShortcutMac') : t('searchShortcutOther')}
          </kbd>
        </button>

        <nav aria-label={t('mainNav')}>
          <ul className="flex flex-col gap-0.5">
            {navItemsFor(role).map((item) => {
              const isActive = active?.key === item.key;
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex h-9 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors ${
                      isActive
                        ? 'bg-nav-selected font-medium text-accent-fg'
                        : 'text-muted hover:bg-canvas hover:text-text'
                    }`}
                  >
                    <Icon
                      className="size-[18px] shrink-0"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{tNav(item.key)}</span>
                    {item.key === 'exceptions' && pendingCount > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[11px] leading-5 tabular-nums ${
                          isActive
                            ? 'bg-accent text-white'
                            : 'bg-canvas text-text'
                        }`}
                      >
                        {format.number(pendingCount)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Saved views and the payroll card are Admin tools (requirements/permissions.md) */}
        {role === 'admin' && (
          <>
            <p className="mt-6 mb-2 px-3 text-xs text-muted">
              {t('savedViews')}
            </p>
            <ul className="flex flex-col gap-0.5">
              {SAVED_VIEWS.map((view) => (
                <li key={view.key}>
                  <Link
                    href={view.href}
                    onClick={onNavigate}
                    className="flex h-8 items-center gap-3 rounded-[10px] px-3 text-[13px] text-muted transition-colors hover:bg-canvas hover:text-text"
                  >
                    <Bookmark
                      className="size-4 shrink-0"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{tViews(view.key)}</span>
                    <span className="text-xs tabular-nums">
                      {format.number(view.count)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-auto pt-6">
          {/* Payroll progress (prototype, mock data): one of the four places the brand gradient is allowed */}
          {role === 'admin' && (
            <Link
              href="/payroll"
              onClick={onNavigate}
              className="block rounded-[14px] border border-line p-3 transition-colors hover:bg-canvas"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium">{t('payrollTitle')}</p>
                <span className="rounded-full bg-canvas px-2 text-[11px] leading-5 text-muted">
                  {t('payrollStatus')}
                </span>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={payrollProgress.stepsTotal}
                aria-valuenow={payrollProgress.stepsDone}
                aria-label={t('payrollTitle')}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'var(--brand-gradient-inline)',
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {t('payrollSteps', {
                  done: format.number(payrollProgress.stepsDone),
                  total: format.number(payrollProgress.stepsTotal),
                })}
              </p>
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              open('lawRef');
            }}
            title={t('lawRefHint')}
            className="mt-2 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start text-muted transition-colors hover:bg-canvas hover:text-text"
          >
            <Scale className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0 flex-1 text-[13px]">{t('lawRef')}</span>
            <ChevronRight
              className="size-4 shrink-0 rtl:-scale-x-100"
              strokeWidth={1.5}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/** The first letter of the company name, for the square badge */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '·';
}
