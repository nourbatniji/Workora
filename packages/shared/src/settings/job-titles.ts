// Job titles (CS-09, FR-CS-9): a company list managed in Settings and picked on each employee.
import { z } from 'zod';

const name = z.string('required').trim().min(1, 'required').max(100, 'tooLong');

/** Add or rename a job title: both languages are required (NFR-6) */
export const jobTitleSchema = z.object({
  nameAr: name,
  nameEn: name,
});

export type JobTitleInput = z.output<typeof jobTitleSchema>;
