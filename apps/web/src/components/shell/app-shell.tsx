'use client';

import { ArrowLeft, Check, Construction } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { useAppState } from './app-state';
import CommandPalette from './command-palette';
import IconRail from './icon-rail';
import { HelpDialog, LawRefDialog } from './info-dialogs';
import InviteDialog from './invite-dialog';
import MobileDrawer from './mobile-drawer';
import NavPanel from './nav-panel';
import TopBar from './top-bar';

/**
 * Layout by width:
 * - 1024px and up: 64px rail + 240px panel always visible
 * - 768–1023px: rail visible, panel opens from the menu button
 * - under 768px: both live in the menu drawer
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Shell');
  const { role } = useAppState();

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-[10px] bg-accent px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t('skipToContent')}
      </a>

      <aside className="sticky top-0 hidden h-dvh md:flex">
        <IconRail />
        <div className="hidden lg:flex">
          <NavPanel />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6">
          {role === 'admin' ? children : <FuturePortal />}
        </main>
      </div>

      <MobileDrawer />
      <CommandPalette />
      <InviteDialog />
      <LawRefDialog />
      <HelpDialog />
    </div>
  );
}

/** Shown when the dev role switcher is on Employee or Interviewer */
function FuturePortal() {
  const t = useTranslations('Portal');
  const { role, setRole } = useAppState();
  const isEmployee = role === 'employee';
  const items = isEmployee
    ? (['employee1', 'employee2', 'employee3', 'employee4'] as const)
    : (['interviewer1', 'interviewer2'] as const);

  return (
    <Card className="mx-auto mt-6 max-w-xl text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">
        <Construction className="size-3.5" strokeWidth={1.5} aria-hidden />
        {t('badge')}
      </span>
      <h2 className="mt-4 text-xl font-medium">
        {isEmployee ? t('employeeTitle') : t('interviewerTitle')}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {isEmployee ? t('employeeBody') : t('interviewerBody')}
      </p>
      <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-2 text-start">
        {items.map((key) => (
          <li
            key={key}
            className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2 text-sm"
          >
            <Check
              className="size-4 shrink-0 text-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            {t(key)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setRole('admin')}
        className="mt-6 inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
      >
        <ArrowLeft
          className="size-4 rtl:-scale-x-100"
          strokeWidth={1.5}
          aria-hidden
        />
        {t('back')}
      </button>
    </Card>
  );
}
