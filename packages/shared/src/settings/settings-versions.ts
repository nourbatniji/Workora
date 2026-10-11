// Settings that change money or attendance are saved as versions with a start date
// (FR-CS-8, D-27, D-70). One change = { effectiveFrom, and the settings that change }.
// The work week (CS-04) comes first; payroll (CS-05) and check-in (CS-07) add their fields here.
import { z } from 'zod';

/** A calendar date like "2026-11-01" (D-29) */
export const isoDateSchema = z.iso.date('dateInvalid');

/** 0 = Sunday … 5 = Friday, 6 = Saturday (the JavaScript numbering, D-71) */
export const weekdaySchema = z
  .int('dayInvalid')
  .min(0, 'dayInvalid')
  .max(6, 'dayInvalid');

export const settingsChangeSchema = z
  .object({
    effectiveFrom: isoDateSchema,
    // Weekly rest days (FR-CS-4); at least one working day must stay
    restDays: z
      .array(weekdaySchema)
      .max(6, 'needWorkingDay')
      .refine((days) => new Set(days).size === days.length, 'dayRepeated')
      .transform((days) => [...days].sort((a, b) => a - b))
      .optional(),
  })
  .refine((change) => change.restDays !== undefined, {
    message: 'nothingToChange',
    path: ['body'],
  });

export type SettingsChangeInput = z.output<typeof settingsChangeSchema>;

/** GET /company/settings?date= */
export const settingsDateQuerySchema = z.object({
  date: isoDateSchema.optional(),
});

export type SettingsDateQuery = z.output<typeof settingsDateQuerySchema>;
