'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/card';
import { today } from '@/mock/dashboard';

type Row = {
  key: 'onTime' | 'late' | 'absent' | 'onLeave' | 'notYetIn';
  value: number;
  color: string;
  hint?: string;
};

/** FR-AT-6 "today" board: who is in, late, not yet in, absent, on leave */
export default function TodayBoard() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();

  const rows: Row[] = [
    { key: 'onTime', value: today.onTime, color: 'bg-success' },
    { key: 'late', value: today.late, color: 'bg-warning' },
    { key: 'absent', value: today.absent, color: 'bg-danger' },
    { key: 'onLeave', value: today.onLeave, color: 'bg-accent' },
    {
      key: 'notYetIn',
      value: today.notYetIn,
      color: 'bg-line',
      hint: t('notYetInHint'),
    },
  ];
  return (
    <Card>
      <CardHeader title={t('boardTitle')} hint={t('boardHint')} />

      {/* One thin segmented bar; 2px gaps between segments, each segment also listed with its label below */}
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {rows.map((r) => (
          <span
            key={r.key}
            className={`h-full ${r.color} first:rounded-s-full last:rounded-e-full`}
            style={{ flexGrow: r.value }}
          />
        ))}
      </div>

      <dl className="mt-4 divide-y divide-line">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 py-2">
            <span
              className={`size-2 shrink-0 rounded-full ${r.color}`}
              aria-hidden
            />
            <dt className="min-w-0 flex-1 text-[13px]">
              {t(r.key)}
              {r.hint && (
                <span className="block text-xs text-muted">{r.hint}</span>
              )}
            </dt>
            <dd className="text-sm font-medium tabular-nums">
              {format.number(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
