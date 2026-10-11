// Invite users (UA-01, FR-UA-1, FR-UA-2): the Admin creates a user, the person sets a password from the link.
// One schema for both sides (D-30): the web form checks it before sending, the API checks it again.
import { z } from 'zod';
import { normalizePhone } from '../phone.js';
import { signUpSchema } from '../auth/sign-up.js';

/** An empty box counts as "not given", so "" never reaches the database */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const USER_ROLES = ['admin', 'employee', 'interviewer'] as const;

export const createUserSchema = z
  .object({
    name: z.string('required').trim().min(1, 'required').max(100, 'tooLong'),
    // Trimmed and lowercased, like sign-up, so one person can't get two accounts by case
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
    // Stored in one form, +201012345678 (D-45)
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
    role: z.enum(USER_ROLES, 'roleInvalid'),
    // Missing → the inviting Admin's language (D-66)
    language: z.enum(['en', 'ar'], 'languageInvalid').optional(),
  })
  // Login needs one of the two (FR-UA-3): workers without email use their phone
  .refine((user) => user.email !== undefined || user.phone !== undefined, {
    message: 'emailOrPhoneRequired',
    path: ['email'],
  });

/** What the invite form sends */
export type CreateUserRequest = z.input<typeof createUserSchema>;

/** What the API works with: email lowercased, phone normalized, empty boxes removed */
export type CreateUserInput = z.output<typeof createUserSchema>;

/** Set a password from an invite link: same password rules as sign-up (D-43) */
export const acceptInviteSchema = z.object({
  password: signUpSchema.shape.password,
});

export type AcceptInviteInput = z.output<typeof acceptInviteSchema>;

/** GET /users?page=&pageSize= (api-conventions.md §7) */
export const listUsersQuerySchema = z.object({
  page: z.coerce
    .number('badRequest')
    .int('badRequest')
    .min(1, 'badRequest')
    .default(1),
  pageSize: z.coerce
    .number('badRequest')
    .int('badRequest')
    .min(1, 'badRequest')
    .max(100, 'badRequest')
    .default(20),
});

export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;

/** Forgot password (UA-04, FR-UA-4): the email to send a reset link to */
export const passwordResetRequestSchema = z.object({
  email: signUpSchema.shape.email,
});

export type PasswordResetRequest = z.output<typeof passwordResetRequestSchema>;
