// Create an employee (EM-01, FR-EM-1, FR-EM-2, FR-EM-3). One schema for both sides (D-30): the
// form checks it before sending, the API checks it again. The system assigns the code (D-76).
// Not here yet: photo (needs file storage, FND-06), disability (EM-02, law mode), salary (EM-04),
// shift (SH-02).
import { z } from 'zod';
import { normalizePhone } from '../phone.js';
import { isoDateSchema } from '../settings/settings-versions.js';

/** MVP limit (A-15): Active and Suspended employees count; Terminated ones don't */
export const EMPLOYEE_LIMIT = 50;

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'trainee'] as const;
export const GENDERS = ['male', 'female'] as const;

/** An empty box counts as "not given", so "" never reaches the database */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.string('tooLong').trim().max(max, 'tooLong').optional(),
  );

/** Stored in one form, +201012345678 (D-45) */
const optionalPhone = z.preprocess(
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
);

const optionalDay = z.preprocess(emptyToUndefined, isoDateSchema.optional());

const name = z.string('required').trim().min(1, 'required').max(100, 'tooLong');

export const createEmployeeSchema = z
  .object({
    // Required: what the Admin knows on day one
    nameAr: name,
    nameEn: name,
    employmentType: z.enum(EMPLOYMENT_TYPES, 'employmentTypeInvalid'),
    hireDate: isoDateSchema,

    // Job data (FR-EM-3)
    jobTitleId: z.preprocess(
      emptyToUndefined,
      z.uuid('invalidReference').optional(),
    ),
    probationEnd: optionalDay,
    /** Trainees only */
    trainingEnd: optionalDay,

    // Personal data (FR-EM-2)
    /** Egyptian national ID: 14 digits; spaces are removed. Unique in the company (D-76) */
    nationalId: z.preprocess(
      emptyToUndefined,
      z
        .string('nationalIdInvalid')
        .transform((value) => value.replace(/\s+/g, ''))
        .pipe(z.string().regex(/^\d{14}$/, 'nationalIdInvalid'))
        .optional(),
    ),
    birthDate: optionalDay,
    gender: z.preprocess(
      emptyToUndefined,
      z.enum(GENDERS, 'genderInvalid').optional(),
    ),
    phone: optionalPhone,
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
    address: optionalText(200),
    emergencyName: optionalText(100),
    emergencyPhone: optionalPhone,
  })
  .superRefine((employee, ctx) => {
    if (employee.probationEnd && employee.probationEnd < employee.hireDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['probationEnd'],
        message: 'dateBeforeHire',
      });
    }
    if (employee.trainingEnd) {
      if (employee.employmentType !== 'trainee') {
        ctx.addIssue({
          code: 'custom',
          path: ['trainingEnd'],
          message: 'trainingEndTraineesOnly',
        });
      } else if (employee.trainingEnd < employee.hireDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['trainingEnd'],
          message: 'dateBeforeHire',
        });
      }
    }
  });

/** What the form sends */
export type CreateEmployeeRequest = z.input<typeof createEmployeeSchema>;

/** What the API works with: trimmed, phone and email normalized, empty boxes removed */
export type CreateEmployeeInput = z.output<typeof createEmployeeSchema>;

/** EMP-0001: the system's code for employee number 1 of a company (A-14) */
export function employeeCode(number: number): string {
  return `EMP-${String(number).padStart(4, '0')}`;
}
