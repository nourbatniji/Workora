'use client';

import {
  Check,
  ChevronRight,
  MessageSquareText,
  Paperclip,
  Search,
  X,
} from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { dayDate } from '@/lib/dates';
import { useMoney } from '@/lib/format';
import type { AttendanceException, ExceptionType } from '@/mock/exceptions';
import { employeeById, type Locale } from '@/mock/people';
import DetailPanel, { type DecisionEvent } from './detail-panel';
import { useExceptions } from './exceptions-store';
import {
  Amount,
  Duration,
  EmployeeCell,
  PolicyText,
  StatusPill,
  TypeBadge,
} from './parts';

type Tab = 'pending' | 'decided' | 'all';
const TYPES: ExceptionType[] = [
  'late',
  'earlyLeave',
  'absent',
  'overtime',
  'missingCheckout',
];
type Toast = { message: string; snapshot: AttendanceException[] } | null;

/** SRS 3.8: the system detects, the manager decides, the system calculates */
export default function ExceptionsInbox() {
  const t = useTranslations('Inbox');
  const tTypes = useTranslations('Ex.types');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const money = useMoney();
  const { exceptions, approve, reject, undo } = useExceptions();

  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ExceptionType | 'all'>('all');
  const [under30, setUnder30] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  // Toast disappears after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const inTab = useMemo(
    () =>
      exceptions.filter((e) =>
        tab === 'pending'
          ? e.status === 'pending'
          : tab === 'decided'
            ? e.status !== 'pending'
            : true,
      ),
    [exceptions, tab],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inTab
      .filter((e) => type === 'all' || e.type === type)
      .filter((e) => !under30 || (e.minutes !== undefined && e.minutes < 30))
      .filter((e) => {
        if (!q) return true;
        const emp = employeeById(e.employeeId);
        return [emp.name.ar, emp.name.en, emp.code, e.id].some((v) =>
          v.toLowerCase().includes(q),
        );
      })
      .sort((a, b) =>
        tab === 'pending'
          ? b.date.localeCompare(a.date)
          : (b.decidedAt ?? b.date).localeCompare(a.decidedAt ?? a.date),
      );
  }, [inTab, type, under30, query, tab]);

  // Only pending rows can be selected, and only the ones still visible count
  const selectable = shown.filter((e) => e.status === 'pending');
  const selectedShown = selectable.filter((e) => selected.has(e.id));
  const allSelected =
    selectable.length > 0 && selectedShown.length === selectable.length;
  const selectedTotal = selectedShown.reduce(
    (sum, e) => sum + (e.suggestedAmount ?? 0),
    0,
  );
  const openException = exceptions.find((e) => e.id === openId) ?? null;
  const filtersOn = query !== '' || type !== 'all' || under30;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(kind: 'approve' | 'reject') {
    const snapshot = selectedShown;
    const ids = snapshot.map((e) => e.id);
    if (kind === 'approve') {
      const skipped = snapshot.filter((e) => e.suggestedAmount === null).length;
      approve(ids);
      const done = snapshot.length - skipped;
      const message = [
        done > 0 ? t('toastApproved', { count: done }) : null,
        skipped > 0 ? t('skippedMissing', { count: skipped }) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      setToast({ message, snapshot });
    } else {
      reject(ids);
      setToast({
        message: t('toastRejected', { count: snapshot.length }),
        snapshot,
      });
    }
    setSelected(new Set());
  }

  function onDecided(event: DecisionEvent) {
    const messages = {
      approved: t('toastApproved', { count: 1 }),
      rejected: t('toastRejected', { count: 1 }),
      converted: t('toastConverted'),
      recalculated: t('toastRecalculated'),
    };
    setToast({ message: messages[event.kind], snapshot: event.snapshot });
    // After a recalculation the item may still need a decision, so the panel stays open
    if (event.kind !== 'recalculated') setOpenId(null);
    setSelected((current) => {
      const next = new Set(current);
      event.snapshot.forEach((e) => next.delete(e.id));
      return next;
    });
  }

  const tabs: { key: Tab; count: number }[] = [
    {
      key: 'pending',
      count: exceptions.filter((e) => e.status === 'pending').length,
    },
    {
      key: 'decided',
      count: exceptions.filter((e) => e.status !== 'pending').length,
    },
    { key: 'all', count: exceptions.length },
  ];

  return (
    <div className="mx-auto max-w-[1280px]">
      <p className="mb-5 max-w-2xl text-[13px] text-muted">
        {t('intro', {
          month: format.dateTime(dayDate('2026-10-01'), { month: 'long' }),
        })}
      </p>

      <Card flush className="overflow-hidden">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label={t('colStatus')}
          className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3 md:px-4"
        >
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => {
                setTab(tb.key);
                setSelected(new Set());
              }}
              className={`-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm whitespace-nowrap ${
                tab === tb.key
                  ? 'border-accent font-medium text-text'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t(`tabs.${tb.key}`)}
              <span className="rounded-full bg-canvas px-1.5 text-[11px] leading-5 tabular-nums">
                {format.number(tb.count)}
              </span>
            </button>
          ))}
        </div>

        {/* Filters: one row above the list */}
        <div className="flex flex-col gap-3 border-b border-line p-3 md:p-4 lg:flex-row lg:items-center">
          <label className="relative block lg:w-64">
            <span className="sr-only">{t('search')}</span>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="h-9 w-full rounded-[10px] border border-line bg-canvas ps-9 pe-3 text-[13px] outline-none placeholder:text-muted focus:border-accent"
            />
          </label>

          <div className="thin-scroll -mx-3 flex gap-1.5 overflow-x-auto px-3 lg:mx-0 lg:flex-1 lg:flex-wrap lg:px-0">
            <Chip active={type === 'all'} onClick={() => setType('all')}>
              {t('allTypes')}
            </Chip>
            {TYPES.map((ty) => {
              const count = inTab.filter((e) => e.type === ty).length;
              return (
                <Chip
                  key={ty}
                  active={type === ty}
                  onClick={() => setType(ty)}
                  disabled={count === 0}
                >
                  {tTypes(ty)}
                  <span className="text-[11px] text-muted tabular-nums">
                    {format.number(count)}
                  </span>
                </Chip>
              );
            })}
            <Chip
              active={under30}
              onClick={() => setUnder30((v) => !v)}
              title={t('under30Hint')}
              dashed
            >
              {t('under30')}
            </Chip>
          </div>

          {filtersOn && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setType('all');
                setUnder30(false);
              }}
              className="self-start text-[13px] text-accent-fg hover:underline lg:self-auto"
            >
              {t('clearFilters')}
            </button>
          )}
        </div>

        {/* Bulk bar (FR-EX-6): works on the filtered selection */}
        {selectedShown.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-nav-selected px-3 py-2.5 md:px-4">
            <p className="text-[13px] font-medium text-accent-fg">
              {t('selected', { count: format.number(selectedShown.length) })}
            </p>
            <p className="text-[13px] text-muted">
              {t('selectedTotal', { amount: money.signed(selectedTotal) })}
            </p>
            <div className="ms-auto flex gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-8 rounded-lg px-2.5 text-[13px] text-muted hover:text-text"
              >
                {t('clearSelection')}
              </button>
              <button
                type="button"
                onClick={() => bulk('reject')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px]"
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden />
                {t('rejectSelected')}
              </button>
              <button
                type="button"
                onClick={() => bulk('approve')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-white"
              >
                <Check className="size-4" strokeWidth={1.5} aria-hidden />
                {t('approveSelected')}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-3 py-2.5 text-xs text-muted md:px-4">
          {tab !== 'decided' && selectable.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(selectable.map((e) => e.id)),
                )
              }
              aria-label={t('selectAll')}
              className="size-4 accent-[var(--accent)]"
            />
          )}
          <span>{t('results', { count: shown.length })}</span>
        </div>

        {shown.length === 0 ? (
          <p className="m-4 mt-0 rounded-[10px] border border-dashed border-line p-8 text-center text-sm text-muted">
            {filtersOn ? t('emptyFiltered') : t('emptyPending')}
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {shown.map((e) => {
              const isPending = e.status === 'pending';
              return (
                <li
                  key={e.id}
                  className={`group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-canvas md:px-4 ${selected.has(e.id) ? 'bg-nav-selected/50' : ''}`}
                >
                  {isPending ? (
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      aria-label={t('selectRow', {
                        name: employeeById(e.employeeId).name[locale],
                      })}
                      className="size-4 shrink-0 accent-[var(--accent)]"
                    />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}

                  {/* The whole row opens the detail panel */}
                  <button
                    type="button"
                    onClick={() => setOpenId(e.id)}
                    className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-start md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_7rem_minmax(0,1.2fr)_auto]"
                  >
                    <EmployeeCell employeeId={e.employeeId} />

                    {/* Phones: amount on the first line's end */}
                    <span className="text-end text-sm md:hidden">
                      <Amount
                        value={
                          isPending
                            ? e.suggestedAmount
                            : (e.finalAmount ?? null)
                        }
                      />
                    </span>

                    <span className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
                      <TypeBadge type={e.type} />
                      <span className="text-xs text-muted">
                        <Duration exception={e} />
                      </span>
                      {e.employeeReason && (
                        <MessageSquareText
                          className="size-3.5 text-muted"
                          strokeWidth={1.5}
                          aria-label={t('hasReason')}
                        />
                      )}
                      {e.hasAttachment && (
                        <Paperclip
                          className="size-3.5 text-muted"
                          strokeWidth={1.5}
                          aria-label={t('hasAttachment')}
                        />
                      )}
                      <span className="text-xs text-muted md:hidden">
                        ·{' '}
                        {format.dateTime(dayDate(e.date), {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </span>

                    <span className="hidden text-[13px] text-muted md:block">
                      {format.dateTime(dayDate(e.date), {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>

                    <span className="hidden min-w-0 text-end md:block">
                      <span className="block text-sm">
                        <Amount
                          value={
                            isPending
                              ? e.suggestedAmount
                              : (e.finalAmount ?? null)
                          }
                        />
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        <PolicyText exception={e} />
                      </span>
                    </span>

                    <span className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
                      <span className="flex items-center gap-1.5">
                        <StatusPill status={e.status} />
                        {e.carriedForward && (
                          <span
                            className="rounded-full bg-nav-selected px-2 py-0.5 text-xs text-accent-fg"
                            title={t('carriedHint')}
                          >
                            {t('carried')}
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted rtl:-scale-x-100"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <DetailPanel
        exception={openException}
        onClose={() => setOpenId(null)}
        onDecided={onDecided}
      />

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[14px] bg-text px-4 py-3 text-sm text-surface"
        >
          <span className="min-w-0 flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => {
              undo(toast.snapshot);
              setToast(null);
            }}
            className="shrink-0 font-medium underline-offset-2 hover:underline"
          >
            {t('undo')}
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
  dashed,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors disabled:opacity-40 ${
        active
          ? 'border-accent bg-nav-selected text-accent-fg'
          : `${dashed ? 'border-dashed' : ''} border-line hover:bg-canvas`
      }`}
    >
      {children}
    </button>
  );
}
