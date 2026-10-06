'use client';

import {
  CalendarOff,
  Check,
  Clock,
  FileText,
  Paperclip,
  PencilLine,
  X,
} from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import Sheet from '@/components/ui/sheet';
import { Field, inputClass } from '@/components/ui/field';
import { dayDate } from '@/lib/dates';
import { useMoney } from '@/lib/format';
import {
  LEAVE_TYPES,
  type AttendanceException,
  type LeaveTypeKey,
} from '@/mock/exceptions';
import { SHIFTS, employeeById, type Locale } from '@/mock/people';
import {
  Amount,
  Duration,
  EmployeeCell,
  PolicyText,
  StatusPill,
  TypeBadge,
} from './parts';
import { useExceptions } from './exceptions-store';

type Mode = 'approve' | 'reject' | 'edit' | 'convert';
export type DecisionEvent = {
  kind: 'approved' | 'rejected' | 'converted' | 'recalculated';
  snapshot: AttendanceException[];
};

/** One exception, full detail, and the four decisions from FR-EX-4 (plus FR-EX-5 for missing check-outs) */
export default function DetailPanel({
  exception,
  onClose,
  onDecided,
}: {
  exception: AttendanceException | null;
  onClose: () => void;
  onDecided: (event: DecisionEvent) => void;
}) {
  const t = useTranslations('Inbox');
  return (
    <Sheet
      open={exception !== null}
      onClose={onClose}
      title={exception ? t('detailTitle', { id: exception.id }) : ''}
      closeLabel={t('close')}
    >
      {exception && (
        <Detail
          key={exception.id + exception.status + exception.type}
          exception={exception}
          onDecided={onDecided}
        />
      )}
    </Sheet>
  );
}

function Detail({
  exception: e,
  onDecided,
}: {
  exception: AttendanceException;
  onDecided: (event: DecisionEvent) => void;
}) {
  const t = useTranslations('Inbox');
  const tLeave = useTranslations('Ex.leaveTypes');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const money = useMoney();
  const employee = employeeById(e.employeeId);
  const shift = SHIFTS[employee.shift];

  return (
    <div className="flex flex-col gap-5">
      <EmployeeCell employeeId={e.employeeId} />

      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={e.type} />
        <span className="text-[13px] text-muted">
          <Duration exception={e} />
        </span>
        <span className="ms-auto">
          <StatusPill status={e.status} />
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-[14px] border border-line p-4 text-[13px]">
        <div>
          <dt className="text-xs text-muted">{t('colShift')}</dt>
          <dd className="mt-0.5">
            {format.dateTime(dayDate(e.date), {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t('shift')}</dt>
          <dd className="mt-0.5 tabular-nums">
            {t('shiftTimes', { start: shift.start, end: shift.end })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t('checkIn')}</dt>
          <dd className="mt-0.5 tabular-nums">{e.checkIn ?? t('noPunch')}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t('checkOut')}</dt>
          <dd
            className={`mt-0.5 tabular-nums ${!e.checkOut && e.type === 'missingCheckout' ? 'text-danger' : ''}`}
          >
            {e.checkOut ?? t('noPunch')}
          </dd>
        </div>
      </dl>

      <div>
        <p className="text-xs text-muted">{t('suggested')}</p>
        <p className="mt-1 text-[28px] leading-tight font-medium">
          <Amount value={e.suggestedAmount} />
        </p>
        <p className="mt-1 text-xs text-muted">
          {t('policy')}: <PolicyText exception={e} />
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted">{t('employeeReason')}</p>
        {e.employeeReason ? (
          <div className="rounded-[10px] bg-canvas p-3 text-[13px]">
            <p>{e.employeeReason[locale]}</p>
            {e.hasAttachment && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs">
                <Paperclip className="size-3.5" strokeWidth={1.5} aria-hidden />
                <span dir="ltr">{t('attachmentName')}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-muted">{t('noReason')}</p>
        )}
      </div>

      {e.status === 'pending' ? (
        e.type === 'missingCheckout' ? (
          <MissingCheckout exception={e} onDecided={onDecided} />
        ) : (
          <Decision exception={e} onDecided={onDecided} />
        )
      ) : (
        <div className="rounded-[14px] border border-line p-4 text-[13px]">
          {e.decidedBy && (
            <p>
              {t('decidedBy', { name: e.decidedBy[locale] })}{' '}
              {e.decidedAt && (
                <span className="text-muted">
                  {t('decidedAt', {
                    date: format.dateTime(new Date(e.decidedAt), {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    }),
                  })}
                </span>
              )}
            </p>
          )}
          {e.status === 'converted' && e.leaveType ? (
            <p className="mt-2 inline-flex items-center gap-1.5">
              <CalendarOff
                className="size-4 text-accent-fg"
                strokeWidth={1.5}
                aria-hidden
              />
              {t('convertedTo', { leave: tLeave(e.leaveType) })}
            </p>
          ) : (
            <p className="mt-2">
              {t('finalAmount')}: <Amount value={e.finalAmount ?? 0} />
            </p>
          )}
          {e.carriedForward && (
            <p
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-nav-selected px-2 py-0.5 text-xs text-accent-fg"
              title={t('carriedHint')}
            >
              {t('carried')}
            </p>
          )}
          {e.note && <p className="mt-2 text-muted">“{e.note}”</p>}
          {e.suggestedAmount !== null &&
            e.finalAmount !== undefined &&
            e.status === 'approved' &&
            e.finalAmount !== e.suggestedAmount && (
              <p className="mt-2 text-xs text-muted">
                {t('suggested')}: {money.signed(e.suggestedAmount)}
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function Decision({
  exception: e,
  onDecided,
}: {
  exception: AttendanceException;
  onDecided: (event: DecisionEvent) => void;
}) {
  const t = useTranslations('Inbox');
  const tLeave = useTranslations('Ex.leaveTypes');
  const format = useFormatter();
  const { approve, reject, editAndApprove, convertToLeave } = useExceptions();
  const [mode, setMode] = useState<Mode>('approve');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(String(e.suggestedAmount ?? 0));
  const [amountError, setAmountError] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveTypeKey>('casual');
  // Overtime can't be converted to leave; only time taken away (late, early, absent) can
  const canConvert = e.type !== 'overtime';

  const options: { mode: Mode; label: string; icon: typeof Check }[] = [
    { mode: 'approve', label: t('approve'), icon: Check },
    { mode: 'reject', label: t('reject'), icon: X },
    { mode: 'edit', label: t('editAmount'), icon: PencilLine },
    ...(canConvert
      ? [{ mode: 'convert' as const, label: t('convert'), icon: CalendarOff }]
      : []),
  ];

  function confirm() {
    const snapshot = [e];
    const trimmed = note.trim() || undefined;
    if (mode === 'approve') {
      approve([e.id], trimmed);
      onDecided({ kind: 'approved', snapshot });
    } else if (mode === 'reject') {
      reject([e.id], trimmed);
      onDecided({ kind: 'rejected', snapshot });
    } else if (mode === 'edit') {
      const value = Number(amount.replace(',', '.').replace('−', '-'));
      if (amount.trim() === '' || Number.isNaN(value)) {
        setAmountError(true);
        return;
      }
      editAndApprove(e.id, Math.round(value * 100) / 100, trimmed);
      onDecided({ kind: 'approved', snapshot });
    } else {
      convertToLeave(e.id, leaveType, trimmed);
      onDecided({ kind: 'converted', snapshot });
    }
  }

  return (
    <div className="rounded-[14px] border border-line p-4">
      <p className="mb-3 text-sm font-medium">{t('decision')}</p>
      <div
        role="radiogroup"
        aria-label={t('decision')}
        className="grid grid-cols-2 gap-2"
      >
        {options.map((o) => {
          const Icon = o.icon;
          const active = mode === o.mode;
          return (
            <button
              key={o.mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(o.mode)}
              className={`flex min-h-10 items-center gap-2 rounded-[10px] border px-3 py-2 text-start text-[13px] transition-colors ${
                active
                  ? 'border-accent bg-nav-selected text-accent-fg'
                  : 'border-line hover:bg-canvas'
              }`}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              {o.label}
            </button>
          );
        })}
      </div>

      {mode === 'edit' && (
        <div className="mt-4">
          <Field
            label={t('amountLabel')}
            error={amountError ? t('amountInvalid') : undefined}
          >
            <input
              value={amount}
              onChange={(ev) => {
                setAmount(ev.target.value);
                setAmountError(false);
              }}
              inputMode="decimal"
              dir="ltr"
              className={`${inputClass(amountError)} tabular-nums rtl:text-end`}
            />
          </Field>
          <p className="mt-1 text-xs text-muted">{t('amountHint')}</p>
        </div>
      )}

      {mode === 'convert' && (
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-[13px] font-medium">
            {t('leaveType')}
          </legend>
          <div className="flex flex-col gap-2">
            {LEAVE_TYPES.map((lt) => (
              <label
                key={lt.key}
                className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-[13px] ${
                  leaveType === lt.key
                    ? 'border-accent bg-nav-selected'
                    : 'border-line'
                }`}
              >
                <input
                  type="radio"
                  name="leaveType"
                  value={lt.key}
                  checked={leaveType === lt.key}
                  onChange={() => setLeaveType(lt.key)}
                  className="accent-[var(--accent)]"
                />
                <span className="flex-1">{tLeave(lt.key)}</span>
                <span className="text-xs text-muted">
                  {Number.isFinite(lt.balance)
                    ? t('leaveBalance', { days: format.number(lt.balance) })
                    : t('leaveUnlimited')}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4">
        <Field label={t('note')}>
          <textarea
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder={t('notePlaceholder')}
            rows={2}
            className={`${inputClass(false)} h-auto py-2`}
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={confirm}
        className="mt-4 h-10 w-full rounded-[10px] bg-accent text-sm font-medium text-white hover:opacity-90"
      >
        {t('confirm')}
      </button>
    </div>
  );
}

function MissingCheckout({
  exception: e,
  onDecided,
}: {
  exception: AttendanceException;
  onDecided: (event: DecisionEvent) => void;
}) {
  const t = useTranslations('Inbox');
  const { setCheckout } = useExceptions();
  const shift = SHIFTS[employeeById(e.employeeId).shift];
  const [time, setTime] = useState(shift.end);

  return (
    <div className="rounded-[14px] border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Clock className="size-4 text-warning" strokeWidth={1.5} aria-hidden />
        {t('missingTitle')}
      </p>
      <p className="mt-1 text-[13px] text-muted">{t('missingBody')}</p>
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Field label={t('checkoutTime')}>
            <input
              type="time"
              value={time}
              onChange={(ev) => setTime(ev.target.value)}
              dir="ltr"
              className={`${inputClass(false)} tabular-nums`}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!time) return;
            setCheckout(e.id, time);
            onDecided({ kind: 'recalculated', snapshot: [e] });
          }}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
        >
          <FileText className="size-4" strokeWidth={1.5} aria-hidden />
          {t('recalculate')}
        </button>
      </div>
    </div>
  );
}
