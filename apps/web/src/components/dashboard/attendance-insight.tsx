'use client';

import { ArrowUpRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';
import { attendanceRate, today } from '@/mock/dashboard';

/** Row 1, card 1: 86% headline, the mixed-weight sentence, and the Low → High meter */
export default function AttendanceInsight() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient place 1 of 4: the corner wash */}
      <div
        className="corner-wash pointer-events-none absolute inset-0"
        aria-hidden
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-medium">{t('insightTitle')}</h2>
          <Link
            href="/attendance"
            aria-label={t('openAttendance')}
            title={t('openAttendance')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface hover:bg-canvas"
          >
            <ArrowUpRight
              className="size-[18px] rtl:-scale-x-100"
              strokeWidth={1.5}
              aria-hidden
            />
          </Link>
        </div>

        <p className="mt-4 text-[40px] leading-none font-medium tracking-tight tabular-nums">
          {format.number(attendanceRate / 100, { style: 'percent' })}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          {t('insightCaption', { due: format.number(today.due) })}
        </p>

        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">
          {t.rich('insightSentence', {
            late: format.number(today.late),
            absent: format.number(today.absent),
            b: (chunks) => (
              <strong className="font-medium text-text">{chunks}</strong>
            ),
          })}
        </p>

        {/* Gradient place 2 of 4: the insight meter */}
        <div className="mt-auto pt-6">
          <div
            role="meter"
            aria-label={t('meterLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={attendanceRate}
            className="relative h-2 rounded-full"
            style={{ background: 'var(--brand-gradient-inline)' }}
          >
            <span
              className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-[3px] border-surface bg-text ltr:-translate-x-1/2 rtl:translate-x-1/2"
              style={{ insetInlineStart: `${attendanceRate}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{t('meterLow')}</span>
            <span>{t('meterHigh')}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
