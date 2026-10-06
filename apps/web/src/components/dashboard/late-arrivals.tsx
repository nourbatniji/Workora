'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/card';
import { dayDate } from '@/lib/dates';
import { lateArrivals } from '@/mock/dashboard';

const CHART_HEIGHT = 160;

/**
 * Row 1, card 2. Pale bars = this week, thin orange line = last week, both on ONE axis
 * (same unit: late arrivals per day). Today's bar is solid blue. Friday is the weekly rest day.
 */
export default function LateArrivals() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const isRtl = useLocale() === 'ar';
  const [hover, setHover] = useState<number | null>(null);

  const values = lateArrivals.flatMap((d) => [
    d.thisWeek ?? 0,
    d.lastWeek ?? 0,
  ]);
  const max = Math.max(...values, 1);
  const top = Math.ceil(max / 2) * 2; // round the axis up to an even number
  const gridSteps = [top, top / 2, 0];

  const thisWeek = lateArrivals.reduce((sum, d) => sum + (d.thisWeek ?? 0), 0);
  const lastWeek = lateArrivals.reduce((sum, d) => sum + (d.lastWeek ?? 0), 0);
  const delta = thisWeek - lastWeek;

  const n = lateArrivals.length;
  // x in % of the plot width at each column centre; mirrored for right-to-left time
  const x = (i: number) => {
    const ltr = ((i + 0.5) / n) * 100;
    return isRtl ? 100 - ltr : ltr;
  };
  const y = (v: number) => 100 - (v / top) * 100;
  const linePoints = lateArrivals
    .map((d, i) => (d.lastWeek === null ? null : `${x(i)},${y(d.lastWeek)}`))
    .filter(Boolean)
    .join(' ');

  return (
    <Card className="relative flex flex-col">
      <CardHeader
        title={t('lateTitle')}
        hint={t('lateHint')}
        action={
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-[3px] bg-chart-bar"
                aria-hidden
              />
              {t('legendThisWeek')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full bg-chart-line"
                aria-hidden
              />
              {t('legendLastWeek')}
            </span>
          </div>
        }
      />

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] leading-none font-medium tabular-nums">
            {format.number(thisWeek)}
          </span>
          <span className="text-[13px] text-muted">{t('lateTotal')}</span>
        </p>
        <p className="inline-flex items-center gap-1 text-[13px] text-muted">
          {delta > 0 && (
            <TrendingUp
              className="size-4 text-danger"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {delta < 0 && (
            <TrendingDown
              className="size-4 text-success"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {delta > 0
            ? t('lateDeltaUp', { delta: format.number(delta) })
            : delta < 0
              ? t('lateDeltaDown', { delta: format.number(-delta) })
              : t('lateDeltaSame')}
        </p>
      </div>

      {/* Plot: y-axis labels on the start side, recessive grid */}
      <div className="mt-5 flex gap-3" aria-hidden>
        <div
          className="flex flex-col justify-between text-[11px] text-muted tabular-nums"
          style={{ height: CHART_HEIGHT }}
        >
          {gridSteps.map((step) => (
            <span key={step} className="-my-1.5 leading-3">
              {format.number(step)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: CHART_HEIGHT }}>
            {gridSteps.map((step) => (
              <div
                key={step}
                className="absolute inset-x-0 border-t border-line"
                style={{ top: `${y(step)}%` }}
              />
            ))}

            {/* Bars */}
            <div className="absolute inset-0 flex">
              {lateArrivals.map((d, i) => {
                const isToday = i === n - 1;
                const value = d.thisWeek ?? 0;
                return (
                  <div
                    key={d.date}
                    className="relative flex flex-1 items-end justify-center"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {d.thisWeek === null ? (
                      <span className="mb-1 h-1 w-[46%] max-w-9 rounded-full border border-dashed border-line" />
                    ) : (
                      <span
                        className={`w-[46%] max-w-9 rounded-t-[4px] transition-opacity ${isToday ? 'bg-accent' : 'bg-chart-bar'} ${
                          hover !== null && hover !== i ? 'opacity-60' : ''
                        }`}
                        style={{ height: `${(value / top) * 100}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Last week: 2px line + 8px markers, same y-scale as the bars */}
            <svg
              className="pointer-events-none absolute inset-0 size-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polyline
                points={linePoints}
                fill="none"
                stroke="var(--chart-line)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
            {lateArrivals.map((d, i) =>
              d.lastWeek === null ? null : (
                <span
                  key={d.date}
                  className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-chart-line"
                  style={{ left: `${x(i)}%`, top: `${y(d.lastWeek)}%` }}
                />
              ),
            )}

            {/* Tooltip for the hovered day */}
            {hover !== null && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[10px] border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap"
                style={{
                  left: `${Math.min(Math.max(x(hover), 18), 82)}%`,
                  top: -8,
                }}
              >
                <p className="font-medium">
                  {format.dateTime(dayDate(lateArrivals[hover].date), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                {lateArrivals[hover].thisWeek === null ? (
                  <p className="text-muted">{t('restDay')}</p>
                ) : (
                  <>
                    <p className="mt-1 flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px] bg-accent" />
                      {t('legendThisWeek')}:{' '}
                      {t('tooltipCount', {
                        count: lateArrivals[hover].thisWeek ?? 0,
                      })}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-chart-line" />
                      {t('legendLastWeek')}:{' '}
                      {t('tooltipCount', {
                        count: lateArrivals[hover].lastWeek ?? 0,
                      })}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Day labels */}
          <div className="mt-2 flex">
            {lateArrivals.map((d, i) => (
              <span
                key={d.date}
                className={`flex-1 text-center text-[11px] ${i === n - 1 ? 'font-medium text-text' : 'text-muted'}`}
              >
                {format.dateTime(dayDate(d.date), { weekday: 'short' })}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Same numbers as a table for screen readers */}
      <div className="sr-only">
        <table>
          <caption>{t('chartTable')}</caption>
          <thead>
            <tr>
              <th>{t('day')}</th>
              <th>{t('legendThisWeek')}</th>
              <th>{t('legendLastWeek')}</th>
            </tr>
          </thead>
          <tbody>
            {lateArrivals.map((d) => (
              <tr key={d.date}>
                <td>{format.dateTime(dayDate(d.date), { weekday: 'long' })}</td>
                <td>{d.thisWeek === null ? t('restDay') : d.thisWeek}</td>
                <td>{d.lastWeek === null ? t('restDay') : d.lastWeek}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
