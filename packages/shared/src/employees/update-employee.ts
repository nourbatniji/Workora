// Edit an employee's personal data (EM-02, FR-EM-2). One schema for the form and the API (D-30).
// Every field is optional: only what is sent changes. An empty box clears an optional field.
// The combined PATCH schema also accepts job data (EM-03).
import { z } from 'zod';
import { normalizePhone } from '../phone.js';
import { isoDateSchema } from '../settings/settings-versions.js';
import { EMPLOYMENT_TYPES, GENDERS } from './create-employee.js';

/** An empty box means "remove it", so it becomes null */
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const name = z.string('required').trim().min(1, 'required').max(100, 'tooLong');

const clearableText = (max: number) =>
  z.preprocess(
    emptyToNull,
    z.string('tooLong').trim().max(max, 'tooLong').nullable().optional(),
  );

const clearablePhone = z.preprocess(
  emptyToNull,
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
    .nullable()
    .optional(),
);

/** PATCH /employees/:id */
export const updateEmployeePersonalSchema = z.object({
  nameAr: name.optional(),
  nameEn: name.optional(),
  /** 14 digits, spaces removed, unique in the company (D-76) */
  nationalId: z.preprocess(
    emptyToNull,
    z
      .string('nationalIdInvalid')
      .transform((value) => value.replace(/\s+/g, ''))
      .pipe(z.string().regex(/^\d{14}$/, 'nationalIdInvalid'))
      .nullable()
      .optional(),
  ),
  birthDate: z.preprocess(emptyToNull, isoDateSchema.nullable().optional()),
  gender: z.preprocess(
    emptyToNull,
    z.enum(GENDERS, 'genderInvalid').nullable().optional(),
  ),
  phone: clearablePhone,
  email: z.preprocess(
    emptyToNull,
    z
      .string('emailInvalid')
      .trim()
      .toLowerCase()
      .max(254, 'tooLong')
      .pipe(z.email('emailInvalid'))
      .nullable()
      .optional(),
  ),
  address: clearableText(200),
  emergencyName: clearableText(100),
  emergencyPhone: clearablePhone,
  /** Only when the company follows the Labor Law; Admins only (D-04) */
  hasDisability: z.boolean('badRequest').optional(),
});

/** Job edits are partial; dates are checked against the stored employee by the API. */
export const updateEmployeeJobSchema = z.object({
  jobTitleId: z.preprocess(
    emptyToNull,
    z.uuid('invalidReference').nullable().optional(),
  ),
  employmentType: z.enum(EMPLOYMENT_TYPES, 'employmentTypeInvalid').optional(),
  hireDate: isoDateSchema.optional(),
  probationEnd: z.preprocess(emptyToNull, isoDateSchema.nullable().optional()),
  trainingEnd: z.preprocess(emptyToNull, isoDateSchema.nullable().optional()),
});

export const updateEmployeeSchema = updateEmployeePersonalSchema
  .extend(updateEmployeeJobSchema.shape)
  .strict();
export type UpdateEmployeeInput = z.output<typeof updateEmployeeSchema>;

export type UpdateEmployeePersonalRequest = z.input<
  typeof updateEmployeePersonalSchema
>;
export type UpdateEmployeePersonalInput = z.output<
  typeof updateEmployeePersonalSchema
>;

/** The page addresses an employee by code (/employees/EMP-0001); the API takes a code or an id */
export const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9-]{1,40}$/; // a code or a uuid

/** One employee as GET /employees/:id returns it (Admin view) */
export interface EmployeeProfile {
  id: string;
  hasPhoto: boolean;
  code: string;
  nameAr: string;
  nameEn: string;
  nationalId: string | null;
  birthDate: string | null;
  gender: (typeof GENDERS)[number] | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  jobTitle: { id: string; nameAr: string; nameEn: string } | null;
  employmentType: 'full_time' | 'part_time' | 'trainee';
  hireDate: string;
  probationEnd: string | null;
  trainingEnd: string | null;
  status: 'active' | 'suspended' | 'terminated';
  terminationDate: string | null;
  /** Shown and editable only when the company follows the Labor Law (D-04) */
  hasDisability: boolean;
  /** Does the company follow the Labor Law? Decides whether the disability field is shown */
  lawMode: boolean;
  login: { id: string; status: 'invited' | 'active' | 'deactivated' } | null;
  createdAt: string;
}
