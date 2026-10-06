'use client';

import { Bell, BriefcaseBusiness, CircleHelp, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import IconButton from '@/components/ui/icon-button';
import { useAppState } from './app-state';
import LogoMark from './logo-mark';

/** The 64px rail: MDARJ mark, HR workspace, compliance, notifications, help */
export default function IconRail({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Shell');
  const { unreadCount, setNotificationsOpen, open } = useAppState();

  return (
    <div className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-e border-line bg-surface py-4">
      <Link
        href="/"
        aria-label={t('railHome')}
        title={t('railHome')}
        onClick={onNavigate}
        className="mb-3 rounded-[10px]"
      >
        <LogoMark />
      </Link>

      {/* The HR workspace is the only workspace for now, so it is always the selected one */}
      <span
        aria-current="true"
        title={t('railWorkspace')}
        className="inline-flex size-9 items-center justify-center rounded-[10px] bg-nav-selected text-accent-fg"
      >
        <BriefcaseBusiness
          className="size-[18px]"
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="sr-only">{t('railWorkspace')}</span>
      </span>

      <Link
        href="/compliance"
        onClick={onNavigate}
        aria-label={t('railCompliance')}
        title={t('railCompliance')}
        className="inline-flex size-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-canvas hover:text-text"
      >
        <ShieldCheck className="size-[18px]" strokeWidth={1.5} aria-hidden />
      </Link>

      <IconButton
        icon={Bell}
        label={t('railNotifications')}
        badge={unreadCount > 0 ? 'dot' : undefined}
        bordered={false}
        className="text-muted hover:text-text"
        onClick={() => {
          onNavigate?.();
          setNotificationsOpen(true);
        }}
      />

      <div className="mt-auto">
        <IconButton
          icon={CircleHelp}
          label={t('railHelp')}
          bordered={false}
          className="text-muted hover:text-text"
          onClick={() => {
            onNavigate?.();
            open('help');
          }}
        />
      </div>
    </div>
  );
}
