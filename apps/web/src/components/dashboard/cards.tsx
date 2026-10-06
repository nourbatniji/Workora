'use client';

import {
  ArrowUpRight,
  CalendarOff,
  Check,
  Construction,
  FileWarning,
  Inbox,
  UserRoundSearch,
  X,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader } from '@/components/ui/card';
import IconButton from '@/components/ui/icon-button';
import { useExceptions } from '@/components/exceptions/exceptions-store';
import {
  Amount,
  Duration,
  EmployeeCell,
  TypeBadge,
} from '@/components/exceptions/parts';
import { useAppState } from '@/components/shell/app-state';
import { dayDate } from '@/lib/dates';
import { contracts, pendingLeaveRequests } from '@/mock/dashboard';

/** Pending exceptions + leave requests. The exceptions count is live: deciding one updates it. */
export function PendingCard() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const { pendingCount } = useExceptions();

  const rows = [
    {
      key: 'pendingExceptions',
      count: pendingCount,
      href: '/exceptions',
      icon: Inbox,
    },
    {
      key: 'pendingLeave',
      count: pendingLeaveRequests,
      href: '/leave',
      icon: CalendarOff,
    },
  ] as const;

  return (
    <Card>
      <CardHeader title={t('pendingTitle')} />
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key}>
              <Link
                href={row.href}
                className="flex items-center gap-3 rounded-[10px] border border-line p-3 transition-colors hover:bg-canvas"
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-nav-selected text-accent-fg">
                  <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-muted">
                    {t(row.key)}
                  </span>
                  <span className="block text-[28px] leading-tight font-medium tabular-nums">
                    {format.number(row.count)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[13px] text-accent-fg">
                  {row.count > 0 ? t('review') : t('allClear')}
                  <ArrowUpRight
                    className="size-4 rtl:-scale-x-100"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Compliance arrives in MVP-2, so this is an empty state with the blurred orb */
export function ComplianceCard() {
  const t = useTranslations('Dashboard');
  const tShell = useTranslations('Shell');
  const { open } = useAppState();

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient place 3 of 4: the compliance assistant's blurred orb */}
      <div
        className="pointer-events-none absolute -end-10 -top-10 size-40 rounded-full opacity-50 blur-2xl dark:opacity-40"
        style={{ background: 'var(--brand-gradient)' }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-medium">{t('complianceTitle')}</h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line bg-surface px-2.5 py-0.5 text-xs text-muted">
            <Construction className="size-3.5" strokeWidth={1.5} aria-hidden />
            {tShell('nextPhase')}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {t('complianceBody')}
        </p>
        <div className="mt-4 flex items-center gap-2" aria-hidden>
          <span className="size-2 rounded-full bg-success" />
          <span className="size-2 rounded-full bg-warning" />
          <span className="size-2 rounded-full bg-danger" />
        </div>
        <p className="mt-3 text-[13px]">{t('complianceRelease')}</p>
        <button
          type="button"
          onClick={() => open('lawRef')}
          className="mt-4 inline-flex h-9 items-center rounded-[10px] border border-line bg-surface px-3.5 text-sm hover:bg-canvas"
        >
          {t('complianceAction')}
        </button>
      </div>
    </Card>
  );
}

/** FR-CT-4 contract counts */
export function ContractsCard() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const items = [
    {
      key: 'expiringSoon',
      hint: 'expiringSoonHint',
      value: contracts.expiringSoon,
      dot: 'bg-warning',
    },
    {
      key: 'expired',
      hint: 'expiredHint',
      value: contracts.expired,
      dot: 'bg-danger',
    },
  ] as const;

  return (
    <Card>
      <CardHeader
        title={t('contractsTitle')}
        action={
          <Link
            href="/contracts"
            aria-label={t('contractsTitle')}
            className="inline-flex size-9 items-center justify-center rounded-[10px] border border-line hover:bg-canvas"
          >
            <FileWarning
              className="size-[18px]"
              strokeWidth={1.5}
              aria-hidden
            />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-[10px] bg-canvas p-3">
            <p className="flex items-center gap-1.5 text-[13px]">
              <span className={`size-2 rounded-full ${item.dot}`} aria-hidden />
              {t(item.key)}
            </p>
            <p className="mt-1 text-[28px] leading-tight font-medium tabular-nums">
              {format.number(item.value)}
            </p>
            <p className="text-xs text-muted">{t(item.hint)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CandidatesCard() {
  const t = useTranslations('Dashboard');
  const tShell = useTranslations('Shell');
  return (
    <Card>
      <CardHeader
        title={t('candidatesTitle')}
        action={
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">
            <Construction className="size-3.5" strokeWidth={1.5} aria-hidden />
            {tShell('nextPhase')}
          </span>
        }
      />
      <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-line p-3">
        <UserRoundSearch
          className="mt-0.5 size-[18px] shrink-0 text-muted"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="text-[13px] text-muted">{t('candidatesEmpty')}</p>
      </div>
    </Card>
  );
}

/** The newest pending exceptions with quick approve / reject (they update the inbox and the nav badge) */
export function LatestExceptions() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const { exceptions, pendingCount, approve, reject } = useExceptions();
  const pending = exceptions
    .filter((e) => e.status === 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <Card className="min-w-0">
      <CardHeader
        title={t('latestTitle')}
        hint={t('latestHint', { count: pendingCount })}
        action={
          <Link
            href="/exceptions"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] border border-line px-3 text-[13px] hover:bg-canvas"
          >
            {t('viewAll')}
            <ArrowUpRight
              className="size-4 rtl:-scale-x-100"
              strokeWidth={1.5}
              aria-hidden
            />
          </Link>
        }
      />

      {pending.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line p-6 text-center text-sm text-muted">
          {t('nothingWaiting')}
        </p>
      ) : (
        <div className="thin-scroll relative -mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 text-start font-normal">{t('employee')}</th>
                <th className="pb-2 text-start font-normal">{t('type')}</th>
                <th className="pb-2 text-start font-normal">{t('date')}</th>
                <th className="pb-2 text-end font-normal">{t('amount')}</th>
                <th className="pb-2 text-end font-normal">
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {pending.map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 pe-3">
                    <EmployeeCell employeeId={e.employeeId} />
                  </td>
                  <td className="py-2.5 pe-3">
                    <TypeBadge type={e.type} />
                    <span className="ms-2 text-xs text-muted">
                      <Duration exception={e} />
                    </span>
                  </td>
                  <td className="py-2.5 pe-3 whitespace-nowrap text-muted">
                    {format.dateTime(dayDate(e.date), {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td className="py-2.5 text-end">
                    <Amount value={e.suggestedAmount} />
                  </td>
                  <td className="py-2.5 ps-3">
                    <div className="flex justify-end gap-1.5">
                      <IconButton
                        icon={Check}
                        label={t('approve')}
                        onClick={() => approve([e.id])}
                        disabled={e.suggestedAmount === null}
                        className="disabled:opacity-40"
                      />
                      <IconButton
                        icon={X}
                        label={t('reject')}
                        onClick={() => reject([e.id])}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
