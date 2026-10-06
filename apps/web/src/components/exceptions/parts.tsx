'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { employeeById, initials, type Locale } from '@/mock/people';
import type {
  AttendanceException,
  ExceptionStatus,
  ExceptionType,
} from '@/mock/exceptions';
import { useMoney } from '@/lib/format';

/** Dot colour per type: deductions red, overtime green, missing check-out orange. Always paired with the label. */
const TYPE_DOT: Record<ExceptionType, string> = {
  late: 'bg-danger',
  earlyLeave: 'bg-danger',
  absent: 'bg-danger',
  overtime: 'bg-success',
  missingCheckout: 'bg-warning',
};

export function TypeBadge({ type }: { type: ExceptionType }) {
  const t = useTranslations('Ex.types');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs whitespace-nowrap">
      <span className={`size-1.5 rounded-full ${TYPE_DOT[type]}`} aria-hidden />
      {t(type)}
    </span>
  );
}

const STATUS_STYLE: Record<ExceptionStatus, string> = {
  pending: 'bg-canvas text-text',
  approved: 'bg-success/10 text-text',
  rejected: 'bg-danger/10 text-text',
  converted: 'bg-nav-selected text-accent-fg',
  resolved: 'bg-canvas text-muted',
};

export function StatusPill({ status }: { status: ExceptionStatus }) {
  const t = useTranslations('Ex.status');
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLE[status]}`}
    >
      {t(status)}
    </span>
  );
}

export function EmployeeCell({
  employeeId,
  compact = false,
}: {
  employeeId: string;
  compact?: boolean;
}) {
  const locale = useLocale() as Locale;
  const employee = employeeById(employeeId);
  const name = employee.name[locale];
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-nav-selected text-xs font-medium text-accent-fg">
        {initials(name, locale)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-medium">{name}</span>
        {!compact && (
          <span className="block truncate text-xs text-muted">
            {employee.jobTitle[locale]} · <span dir="ltr">{employee.code}</span>
          </span>
        )}
      </span>
    </span>
  );
}

/** "42 min", "1.5 h" or "1 day" */
export function Duration({ exception }: { exception: AttendanceException }) {
  const t = useTranslations('Ex');
  const format = useFormatter();
  if (exception.days) return <>{t('days', { days: exception.days })}</>;
  if (exception.type === 'missingCheckout' && exception.checkIn)
    return <>{t('inAt', { time: exception.checkIn })}</>;
  if (!exception.minutes) return <>{t('noAmount')}</>;
  if (exception.type === 'overtime' && exception.minutes >= 60) {
    return (
      <>
        {t('hours', {
          hours: format.number(exception.minutes / 60, {
            maximumFractionDigits: 2,
          }),
        })}
      </>
    );
  }
  return <>{t('minutes', { minutes: format.number(exception.minutes) })}</>;
}

/** Signed EGP amount; tabular figures so columns line up */
export function Amount({
  value,
  muted = false,
}: {
  value: number | null | undefined;
  muted?: boolean;
}) {
  const money = useMoney();
  const t = useTranslations('Ex');
  if (value === null || value === undefined)
    return <span className="text-muted">{t('noAmount')}</span>;
  return (
    <span
      className={`whitespace-nowrap tabular-nums [unicode-bidi:isolate] ${muted ? 'text-muted' : 'text-text'}`}
    >
      {money.signed(value)}
    </span>
  );
}

/** The rule used to get the amount (FR-EX-2) */
export function PolicyText({ exception }: { exception: AttendanceException }) {
  const t = useTranslations('Ex');
  const money = useMoney();
  const format = useFormatter();
  const p = exception.policy;
  switch (p.kind) {
    case 'lateExact':
    case 'earlyExact':
      return (
        <>
          {t(`policy.${p.kind}`, {
            minutes: format.number(p.minutes),
            hourly: money.egp(p.hourly),
          })}
        </>
      );
    case 'absenceDay':
      return <>{t('policy.absenceDay', { daily: money.egp(p.daily) })}</>;
    case 'overtime':
      return (
        <>
          {t('policy.overtime', {
            hours: format.number(p.hours),
            hourly: money.egp(p.hourly),
            multiplier: format.number(p.multiplier),
            rate: t(`rates.${p.rate}`),
          })}
        </>
      );
    default:
      return <>{t('policy.awaitingCheckout')}</>;
  }
}
