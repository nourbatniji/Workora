// Mock attendance exceptions (SRS 3.8). Amounts follow BR-6 to BR-9 with the company's mock settings,
// so the numbers on screen are the same ones the real backend would suggest.

import { EMPLOYEES, SHIFTS, employeeById, type Localized } from './people';

export type ExceptionType =
  'late' | 'earlyLeave' | 'absent' | 'overtime' | 'missingCheckout';
export type ExceptionStatus =
  'pending' | 'approved' | 'rejected' | 'converted' | 'resolved';
export type LeaveTypeKey = 'annual' | 'casual' | 'unpaid';

/** Company payroll settings used by the mock (FR-CS-5) */
export const PAYROLL_SETTINGS = {
  divisor: 30,
  unpaidBreakMinutes: 60,
  latenessMode: 'exact' as const,
  overtimeMinMinutes: 30,
  multipliers: { day: 1.35, night: 1.7, restDay: 2 },
};

/** Which rule produced the amount, shown under each exception (FR-EX-2) */
export type Policy =
  | { kind: 'lateExact'; minutes: number; hourly: number }
  | { kind: 'earlyExact'; minutes: number; hourly: number }
  | { kind: 'absenceDay'; daily: number }
  | {
      kind: 'overtime';
      hours: number;
      hourly: number;
      multiplier: number;
      rate: 'day' | 'night' | 'restDay';
    }
  | { kind: 'awaitingCheckout' };

export type AttendanceException = {
  id: string;
  employeeId: string;
  /** Shift date (a night shift belongs to the date it started) */
  date: string;
  type: ExceptionType;
  minutes?: number;
  days?: number;
  checkIn?: string;
  checkOut?: string;
  /** EGP, negative = deduction, positive = overtime. null until a missing check-out is fixed */
  suggestedAmount: number | null;
  finalAmount?: number;
  policy: Policy;
  employeeReason?: Localized;
  hasAttachment?: boolean;
  createdAt: string;
  status: ExceptionStatus;
  decidedBy?: Localized;
  decidedAt?: string;
  note?: string;
  leaveType?: LeaveTypeKey;
  /** Decided after its month's payroll was approved, so it goes to next month's run (FR-EX-8) */
  carriedForward?: boolean;
};

export const CURRENT_ADMIN: Localized = {
  ar: 'هالة منصور',
  en: 'Hala Mansour',
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function rates(employeeId: string) {
  const { baseSalary } = employeeById(employeeId);
  const daily = baseSalary / PAYROLL_SETTINGS.divisor;
  const paidHours = 8 - PAYROLL_SETTINGS.unpaidBreakMinutes / 60;
  return { daily: round2(daily), hourly: round2(daily / paidHours) };
}

/** BR-7 exact mode, capped at one daily rate (D-39) */
export function lateAmount(employeeId: string, minutes: number) {
  const { daily, hourly } = rates(employeeId);
  return -Math.min(round2((minutes * hourly) / 60), daily);
}

/** BR-9: overtime hours × hourly rate × multiplier */
export function overtimeAmount(
  employeeId: string,
  minutes: number,
  rate: 'day' | 'night' | 'restDay',
) {
  const { hourly } = rates(employeeId);
  return round2((minutes / 60) * hourly * PAYROLL_SETTINGS.multipliers[rate]);
}

type Seed = {
  id: string;
  employeeId: string;
  date: string;
  type: ExceptionType;
  minutes?: number;
  checkIn?: string;
  checkOut?: string;
  rate?: 'day' | 'night' | 'restDay';
  reason?: Localized;
  hasAttachment?: boolean;
  createdAt: string;
  status?: ExceptionStatus;
  decidedAt?: string;
  note?: string;
  finalAmount?: number;
  leaveType?: LeaveTypeKey;
  carriedForward?: boolean;
};

function build(seed: Seed): AttendanceException {
  const { hourly, daily } = rates(seed.employeeId);
  let suggestedAmount: number | null = null;
  let policy: Policy = { kind: 'awaitingCheckout' };

  if (seed.type === 'late' && seed.minutes) {
    suggestedAmount = lateAmount(seed.employeeId, seed.minutes);
    policy = { kind: 'lateExact', minutes: seed.minutes, hourly };
  } else if (seed.type === 'earlyLeave' && seed.minutes) {
    suggestedAmount = lateAmount(seed.employeeId, seed.minutes);
    policy = { kind: 'earlyExact', minutes: seed.minutes, hourly };
  } else if (seed.type === 'absent') {
    suggestedAmount = -daily;
    policy = { kind: 'absenceDay', daily };
  } else if (seed.type === 'overtime' && seed.minutes) {
    const rate = seed.rate ?? 'day';
    suggestedAmount = overtimeAmount(seed.employeeId, seed.minutes, rate);
    policy = {
      kind: 'overtime',
      hours: round2(seed.minutes / 60),
      hourly,
      multiplier: PAYROLL_SETTINGS.multipliers[rate],
      rate,
    };
  }

  const status = seed.status ?? 'pending';
  const decided = status !== 'pending';

  return {
    id: seed.id,
    employeeId: seed.employeeId,
    date: seed.date,
    type: seed.type,
    minutes: seed.type === 'absent' ? undefined : seed.minutes,
    days: seed.type === 'absent' ? 1 : undefined,
    checkIn: seed.checkIn,
    checkOut: seed.checkOut,
    suggestedAmount,
    finalAmount: decided
      ? (seed.finalAmount ??
        (status === 'approved' ? (suggestedAmount ?? 0) : 0))
      : undefined,
    policy,
    employeeReason: seed.reason,
    hasAttachment: seed.hasAttachment,
    createdAt: seed.createdAt,
    status,
    decidedBy: decided ? CURRENT_ADMIN : undefined,
    decidedAt: seed.decidedAt,
    note: seed.note,
    leaveType: seed.leaveType,
    carriedForward: seed.carriedForward,
  };
}

const r = (ar: string, en: string): Localized => ({ ar, en });

const SEEDS: Seed[] = [
  // ---- Pending: last night's night shift (shift date Oct 4) ----
  {
    id: 'EX-1041',
    employeeId: 'karim',
    date: '2026-10-04',
    type: 'late',
    minutes: 42,
    checkIn: '22:42',
    checkOut: '06:00',
    reason: r('الميكروباص عطل في الطريق', 'The microbus broke down on the way'),
    createdAt: '2026-10-05T08:00:00',
  },
  {
    id: 'EX-1042',
    employeeId: 'mahmoud',
    date: '2026-10-04',
    type: 'late',
    minutes: 25,
    checkIn: '22:25',
    checkOut: '06:02',
    createdAt: '2026-10-05T08:00:00',
  },
  {
    id: 'EX-1043',
    employeeId: 'youssef',
    date: '2026-10-04',
    type: 'late',
    minutes: 18,
    checkIn: '22:18',
    checkOut: '06:00',
    createdAt: '2026-10-05T08:00:00',
  },
  {
    id: 'EX-1044',
    employeeId: 'mostafa',
    date: '2026-10-04',
    type: 'late',
    minutes: 55,
    checkIn: '22:55',
    checkOut: '06:05',
    reason: r(
      'كنت في توصيلة متأخرة من الوردية المسائية',
      'I was finishing a late delivery from the evening run',
    ),
    createdAt: '2026-10-05T08:00:00',
  },
  {
    id: 'EX-1045',
    employeeId: 'omar',
    date: '2026-10-04',
    type: 'absent',
    createdAt: '2026-10-05T08:00:00',
  },
  {
    id: 'EX-1046',
    employeeId: 'abdelrahman',
    date: '2026-10-03',
    type: 'missingCheckout',
    checkIn: '22:04',
    createdAt: '2026-10-04T12:00:00',
  },
  // ---- Pending: earlier this week ----
  {
    id: 'EX-1038',
    employeeId: 'hany',
    date: '2026-10-04',
    type: 'overtime',
    minutes: 90,
    rate: 'day',
    checkIn: '14:00',
    checkOut: '23:30',
    createdAt: '2026-10-05T00:00:00',
  },
  {
    id: 'EX-1047',
    employeeId: 'mona',
    date: '2026-10-05',
    type: 'late',
    minutes: 12,
    checkIn: '06:12',
    createdAt: '2026-10-05T06:30:00',
  },
  {
    id: 'EX-1036',
    employeeId: 'sara',
    date: '2026-10-03',
    type: 'earlyLeave',
    minutes: 60,
    checkIn: '06:00',
    checkOut: '13:00',
    reason: r(
      'موعد عند الطبيب، والشهادة مرفقة',
      'Doctor appointment, certificate attached',
    ),
    hasAttachment: true,
    createdAt: '2026-10-03T22:00:00',
  },
  {
    id: 'EX-1034',
    employeeId: 'islam',
    date: '2026-10-03',
    type: 'absent',
    createdAt: '2026-10-04T08:00:00',
  },
  {
    id: 'EX-1029',
    employeeId: 'rehab',
    date: '2026-10-02',
    type: 'late',
    minutes: 35,
    checkIn: '14:35',
    checkOut: '22:00',
    createdAt: '2026-10-03T00:00:00',
  },
  {
    id: 'EX-1027',
    employeeId: 'karim',
    date: '2026-10-02',
    type: 'overtime',
    minutes: 480,
    rate: 'restDay',
    checkIn: '22:00',
    checkOut: '06:00',
    reason: r('غطّيت وردية محمود يوم الجمعة', 'Covered Mahmoud’s Friday shift'),
    createdAt: '2026-10-03T08:00:00',
  },
  {
    id: 'EX-1022',
    employeeId: 'ahmed',
    date: '2026-10-01',
    type: 'overtime',
    minutes: 60,
    rate: 'day',
    checkIn: '06:00',
    checkOut: '15:00',
    createdAt: '2026-10-01T16:00:00',
  },
  {
    id: 'EX-1023',
    employeeId: 'hossam',
    date: '2026-10-01',
    type: 'earlyLeave',
    minutes: 30,
    checkIn: '14:00',
    checkOut: '21:30',
    createdAt: '2026-10-02T00:00:00',
  },
  // ---- Decided ----
  {
    id: 'EX-1021',
    employeeId: 'mariam',
    date: '2026-10-01',
    type: 'late',
    minutes: 20,
    checkIn: '14:20',
    checkOut: '22:00',
    createdAt: '2026-10-02T00:00:00',
    status: 'approved',
    decidedAt: '2026-10-02T10:15:00',
  },
  {
    id: 'EX-1020',
    employeeId: 'noura',
    date: '2026-10-01',
    type: 'late',
    minutes: 15,
    checkIn: '06:15',
    checkOut: '14:00',
    reason: r('حادثة على الطريق الدائري', 'Accident on the Ring Road'),
    createdAt: '2026-10-01T14:30:00',
    status: 'rejected',
    decidedAt: '2026-10-02T10:16:00',
  },
  {
    id: 'EX-1012',
    employeeId: 'youssef',
    date: '2026-09-30',
    type: 'absent',
    createdAt: '2026-10-01T08:00:00',
    status: 'converted',
    leaveType: 'casual',
    decidedAt: '2026-10-01T11:00:00',
  },
  {
    id: 'EX-1009',
    employeeId: 'mahmoud',
    date: '2026-09-29',
    type: 'overtime',
    minutes: 120,
    rate: 'night',
    checkIn: '22:00',
    checkOut: '08:00',
    createdAt: '2026-09-30T10:00:00',
    status: 'approved',
    decidedAt: '2026-10-01T11:05:00',
    finalAmount: 300,
  },
  {
    id: 'EX-1004',
    employeeId: 'yasmine',
    date: '2026-09-28',
    type: 'late',
    minutes: 30,
    checkIn: '06:30',
    checkOut: '14:00',
    createdAt: '2026-09-28T14:30:00',
    status: 'approved',
    decidedAt: '2026-10-02T09:40:00',
    carriedForward: true,
  },
];

export const INITIAL_EXCEPTIONS: AttendanceException[] = SEEDS.map(build);

/** The leave types an exception can be converted into (FR-EX-4) */
export const LEAVE_TYPES: { key: LeaveTypeKey; balance: number }[] = [
  { key: 'annual', balance: 12 },
  { key: 'casual', balance: 4 },
  { key: 'unpaid', balance: Infinity },
];

/** When the Admin enters the real check-out time for a missing check-out (FR-EX-5) */
export function recalculateCheckout(
  exception: AttendanceException,
  checkOut: string,
): AttendanceException {
  const employee = EMPLOYEES.find((e) => e.id === exception.employeeId)!;
  const shift = SHIFTS[employee.shift];
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };
  // Night shifts end the next morning: move morning times past midnight
  const start = toMinutes(shift.start);
  let end = toMinutes(shift.end);
  let out = toMinutes(checkOut);
  if (end <= start) end += 24 * 60;
  if (out <= start) out += 24 * 60;

  const earlyGrace = 10;
  if (out < end - earlyGrace) {
    const minutes = end - out;
    return {
      ...exception,
      type: 'earlyLeave',
      minutes,
      checkOut,
      suggestedAmount: lateAmount(exception.employeeId, minutes),
      policy: {
        kind: 'earlyExact',
        minutes,
        hourly: rates(exception.employeeId).hourly,
      },
    };
  }
  if (out - end >= PAYROLL_SETTINGS.overtimeMinMinutes) {
    const minutes = out - end;
    const rate = employee.shift === 'night' ? 'night' : 'day';
    return {
      ...exception,
      type: 'overtime',
      minutes,
      checkOut,
      suggestedAmount: overtimeAmount(exception.employeeId, minutes, rate),
      policy: {
        kind: 'overtime',
        hours: round2(minutes / 60),
        hourly: rates(exception.employeeId).hourly,
        multiplier: PAYROLL_SETTINGS.multipliers[rate],
        rate,
      },
    };
  }
  // On time: the day is fine, nothing left to decide
  return {
    ...exception,
    checkOut,
    status: 'resolved',
    suggestedAmount: 0,
    finalAmount: 0,
    decidedBy: CURRENT_ADMIN,
    decidedAt: new Date().toISOString(),
  };
}
