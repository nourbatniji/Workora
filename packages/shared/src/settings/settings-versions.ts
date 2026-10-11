// Settings that change money or attendance are saved as versions with a start date
// (FR-CS-8, D-27, D-70). One change = { effectiveFrom, and the settings that change }.
// Work week (CS-04) and payroll rules (CS-05) so far; check-in (CS-07) adds its fields here.
import { z } from 'zod';

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
 * One lateness band (BR-7): from `fromMinutes` to `toMinutes` late (null = and more),
 * deduct this part of a day's pay. Example: 16–60 → 0.25, 61–120 → 0.5, 121+ → 1.
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
          // In order, not overlapping, and only the last one may be open-ended
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
            if (
              previous &&
              (previous.toMinutes === null ||
                band.fromMinutes <= previous.toMinutes)
            ) {
              ctx.addIssue({
                code: 'custom',
                message: 'bandsOverlap',
                path: [i],
              });
            }
          });
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
] as const;

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
