import { z } from 'zod';
import { isoDateSchema } from '../settings/settings-versions.js';

export const uploadEmployeeDocumentSchema = z.object({
  docType: z.string().trim().min(1, 'required').max(100, 'tooLong'),
  expiryDate: z.preprocess(
    (value) => (value === '' ? undefined : value),
    isoDateSchema.optional(),
  ),
});

export type UploadEmployeeDocumentInput = z.output<
  typeof uploadEmployeeDocumentSchema
>;

export interface EmployeeDocumentItem {
  id: string;
  docType: string;
  expiryDate: string | null;
  createdAt: string;
}

export interface EmployeeDocumentList {
  items: EmployeeDocumentItem[];
}
