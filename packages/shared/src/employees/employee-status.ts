import { z } from 'zod';
import { isoDateSchema } from '../settings/settings-versions.js';

export const employeeStatusSchema = z.enum([
  'active',
  'suspended',
  'terminated',
]);

export const changeEmployeeStatusSchema = z.object({
  toStatus: employeeStatusSchema,
  effectiveDate: isoDateSchema,
  reason: z.string().trim().min(1, 'required').max(1000, 'tooLong'),
});

export type ChangeEmployeeStatusInput = z.output<
  typeof changeEmployeeStatusSchema
>;

export interface EmployeeStatusHistoryItem {
  id: string;
  fromStatus: 'active' | 'suspended' | 'terminated' | null;
  toStatus: 'active' | 'suspended' | 'terminated';
  effectiveDate: string;
  reason: string | null;
  changedBy: { id: string; name: string | null } | null;
  createdAt: string;
}
export interface EmployeeStatusHistory {
  date: string;
  items: EmployeeStatusHistoryItem[];
}
