// Setup wizard (CS-02, FR-CS-2, D-74): after sign-up the Admin goes through the settings one
// step at a time; each step can be skipped and finished later from Settings.
import { z } from 'zod';

/**
 * The steps, in order. Public holidays, shift templates and leave types join the list when
 * those features are built (PH, SH, LV).
 */
export const SETUP_STEPS = [
  'profile',
  'compliance',
  'workWeek',
  'payroll',
  'checkIn',
  'jobTitles',
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_STEP_STATUSES = ['done', 'skipped'] as const;

export type SetupStepStatus = (typeof SETUP_STEP_STATUSES)[number];

/** PATCH /company/setup: mark one step done or skipped */
export const setupStepUpdateSchema = z.object({
  step: z.enum(SETUP_STEPS, 'stepInvalid'),
  status: z.enum(SETUP_STEP_STATUSES, 'statusInvalid'),
});

export type SetupStepUpdate = z.output<typeof setupStepUpdateSchema>;
