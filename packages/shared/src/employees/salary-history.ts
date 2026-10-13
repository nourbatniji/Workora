import { z } from 'zod';
import { isoDateSchema } from '../settings/settings-versions.js';

// Decimal strings avoid rounding money through JavaScript numbers. Decimal(12,2).
export const salaryChangeSchema = z
  .object({
    baseSalary: z
      .string('salaryInvalid')
      .trim()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, 'salaryInvalid'),
    effectiveFrom: isoDateSchema,
  })
  .strict();
export const salaryHistoryQuerySchema = z
  .object({ date: isoDateSchema.optional() })
  .strict();
export type SalaryChangeInput = z.output<typeof salaryChangeSchema>;
export interface SalaryEntry {
  id: string;
  baseSalary: string;
  effectiveFrom: string;
  createdAt: string;
}
export interface SalaryHistory {
  date: string;
  currency: string;
  current: SalaryEntry | null;
  items: SalaryEntry[];
}
