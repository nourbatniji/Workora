// Settings that change money or attendance are saved as versions with a start date
// (FR-CS-8, D-27, D-70). One change = { effectiveFrom, and the settings that change }.
// Work week (CS-04), payroll rules (CS-05) and check-in (CS-07).
import { z } from 'zod';
import { isIpOrRange, normalizeIp } from '../ip.js';

/** A calendar date like "2026-11-01" (D-29) */
export const isoDateSchema = z.iso.date('dateInvalid');

/** 0 = Sunday … 5 = Friday, 6 = Saturday (the JavaScript numbering, D-71) */
export const weekdaySchema = z
  .int('dayInvalid')
  .min(0, 'dayInvalid')
  .max(6, 'dayInvalid');

/** How the daily rate is worked out (BR-6): salary ÷ 30, ÷ 26, or ÷ the working days of the month */
export const DAILY_RATE_DIVISORS = [
  'days_30',
  'days_26',
  'working_days',
] as const;

/**
 * One lateness band (BR-7, D-72): from `fromMinutes` to `toMinutes` late or early, both
 * included (null = and more), deduct this part of a day's pay.
 * Example: 16–60 → 0.25, 61–120 → 0.5, 121+ → 1. Below the first band = 0.
 */
export const latenessBandSchema = z.object({
  fromMinutes: z
    .int('minutesInvalid')
    .min(1, 'minutesInvalid')
    .max(1440, 'minutesInvalid'),
  toMinutes: z
    .int('minutesInvalid')
    .min(1, 'minutesInvalid')
    .max(1440, 'minutesInvalid')
    .nullable(),
  dayFraction: z
    .number('fractionInvalid')
    .gt(0, 'fractionInvalid')
    .max(1, 'fractionInvalid'),
});

export type LatenessBand = z.output<typeof latenessBandSchema>;

/** Lateness and early-leave policy (BR-7): exact per minute, or the company's bands */
export const latenessPolicySchema = z.discriminatedUnion(
  'mode',
  [
    z.object({ mode: z.literal('exact') }),
    z.object({
      mode: z.literal('tiered'),
      bands: z
        .array(latenessBandSchema)
        .min(1, 'bandsRequired')
        .max(10, 'tooManyBands')
        .superRefine((bands, ctx) => {
          // D-72: in order with no gaps (each band starts 1 minute after the one above
          // ends), and only the last band is open-ended, so every minute has a band
          bands.forEach((band, i) => {
            if (band.toMinutes !== null && band.toMinutes < band.fromMinutes) {
              ctx.addIssue({
                code: 'custom',
                message: 'bandRangeInvalid',
                path: [i],
              });
            }
            if (band.toMinutes === null && i !== bands.length - 1) {
              ctx.addIssue({
                code: 'custom',
                message: 'openBandNotLast',
                path: [i],
              });
            }
            const previous = bands[i - 1];
            if (!previous) return;
            if (
              previous.toMinutes === null ||
              band.fromMinutes <= previous.toMinutes
            ) {
              ctx.addIssue({
                code: 'custom',
                message: 'bandsOverlap',
                path: [i],
              });
            } else if (band.fromMinutes > previous.toMinutes + 1) {
              // e.g. 16–60 then 90–120: minutes 61–89 would cost nothing
              ctx.addIssue({
                code: 'custom',
                message: 'bandsGap',
                path: [i],
              });
            }
          });
          const last = bands.at(-1);
          if (last && last.toMinutes !== null) {
            // Without an open last band, a very late day would cost nothing
            ctx.addIssue({
              code: 'custom',
              message: 'lastBandNotOpen',
              path: [bands.length - 1],
            });
          }
        }),
    }),
  ],
  'policyInvalid',
);

export type LatenessPolicy = z.output<typeof latenessPolicySchema>;

/** An overtime multiplier like "1.35": between 1.00 and 5.00, 2 decimals at most (BR-9) */
const rateSchema = z
  .string('rateInvalid')
  .trim()
  .regex(/^\d(\.\d{1,2})?$/, 'rateInvalid')
  .refine(
    (value) => Number(value) >= 1 && Number(value) <= 5,
    'rateOutOfRange',
  );

/** The settings a change may carry. Each part is optional: send only what changes */
const SETTING_FIELDS = [
  'restDays',
  'dailyRateDivisor',
  'latenessPolicy',
  'overtimeDayRate',
  'overtimeNightRate',
  'overtimeRestDayRate',
  'overtimeHolidayRate',
  'overtimeMinMinutes',
  'checkInWindowMinutes',
  'checkOutWindowMinutes',
  'ipAllowList',
] as const;

/**
 * Office IP addresses or ranges (FR-CS-7, D-73): trimmed, written one way (normalizeIp),
 * duplicates removed, 50 at most
 */
const ipAllowListSchema = z
  .array(
    z
      .string('ipInvalid')
      .trim()
      .toLowerCase()
      .refine(isIpOrRange, 'ipInvalid')
      .transform(normalizeIp),
  )
  .max(50, 'tooManyIps')
  .transform((list) => [...new Set(list)]);

export const settingsChangeSchema = z
  .object({
    effectiveFrom: isoDateSchema,
    // Work week (CS-04, FR-CS-4); at least one working day must stay
    restDays: z
      .array(weekdaySchema)
      .max(6, 'needWorkingDay')
      .refine((days) => new Set(days).size === days.length, 'dayRepeated')
      .transform((days) => [...days].sort((a, b) => a - b))
      .optional(),
    // Payroll rules (CS-05, FR-CS-5)
    dailyRateDivisor: z.enum(DAILY_RATE_DIVISORS, 'divisorInvalid').optional(),
    latenessPolicy: latenessPolicySchema.optional(),
    overtimeDayRate: rateSchema.optional(),
    overtimeNightRate: rateSchema.optional(),
    overtimeRestDayRate: rateSchema.optional(),
    overtimeHolidayRate: rateSchema.optional(),
    // BR-5: overtime counts only from this many minutes after shift end
    overtimeMinMinutes: z
      .int('minutesInvalid')
      .min(0, 'minutesInvalid')
      .max(240, 'minutesInvalid')
      .optional(),
    // Check-in (CS-07, FR-CS-7, FR-AT-2, D-38): minutes before shift start, minutes after shift end
    checkInWindowMinutes: z
      .int('minutesInvalid')
      .min(0, 'minutesInvalid')
      .max(240, 'minutesInvalid')
      .optional(),
    checkOutWindowMinutes: z
      .int('minutesInvalid')
      .min(30, 'minutesInvalid')
      .max(720, 'minutesInvalid')
      .optional(),
    // Empty = check-in from anywhere (D-18)
    ipAllowList: ipAllowListSchema.optional(),
  })
  .refine(
    (change) => SETTING_FIELDS.some((field) => change[field] !== undefined),
    { message: 'nothingToChange', path: ['body'] },
  );

export type SettingsChangeInput = z.output<typeof settingsChangeSchema>;

/** GET /company/settings?date= */
export const settingsDateQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

export type SettingsDateQuery = z.output<typeof settingsDateQuerySchema>;
