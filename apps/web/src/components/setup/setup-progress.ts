// The answer of GET /company/setup, shared by the wizard page and the dashboard banner
import type { SetupStep } from '@mdarj/shared';

export type SetupProgress = {
  steps: { key: SetupStep; status: 'todo' | 'done' | 'skipped' }[];
  complete: boolean;
};

/** The Settings section title of each step (the wizard reuses those sections) */
export const STEP_TITLE_KEY: Record<SetupStep, string> = {
  profile: 'profile.title',
  compliance: 'compliance.title',
  workWeek: 'workWeek.title',
  payroll: 'payroll.title',
  checkIn: 'checkIn.title',
  jobTitles: 'jobTitles.title',
};
