// Give an employee app access (D-77): the same 7-day invite as the Users page, but the login is
// connected to the employee record, so "my payslips" knows whose they are and terminating the
// employee can switch the login off (UA-06). The email and phone default to the employee's own.
import { z } from 'zod';
import { normalizePhone } from '../phone.js';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** POST /employees/:id/access */
export const employeeAccessSchema = z.object({
  email: z.preprocess(
    emptyToUndefined,
    z
      .string('emailInvalid')
      .trim()
      .toLowerCase()
      .max(254, 'tooLong')
      .pipe(z.email('emailInvalid'))
      .optional(),
  ),
  phone: z.preprocess(
    emptyToUndefined,
    z
      .string('phoneInvalid')
      .trim()
      .max(32, 'tooLong')
      .transform((value, ctx) => {
        const phone = normalizePhone(value);
        if (!phone) {
          ctx.addIssue({ code: 'custom', message: 'phoneInvalid' });
          return z.NEVER;
        }
        return phone;
      })
      .optional(),
  ),
  /** The invite's language; missing → the Admin's language (D-66) */
  language: z.enum(['en', 'ar'], 'languageInvalid').optional(),
});

export type EmployeeAccessRequest = z.input<typeof employeeAccessSchema>;
export type EmployeeAccessInput = z.output<typeof employeeAccessSchema>;
