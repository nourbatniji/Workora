// Log in with email or phone (UA-03, FR-UA-3). One box takes either; the schema works out which.
import { z } from 'zod';
import { normalizePhone } from '../phone.js';
import { PASSWORD_MAX_LENGTH } from './sign-up.js';

export const loginSchema = z.object({
  // Has "@" → email (trimmed, lowercased). Otherwise → phone (normalized, D-45).
  identifier: z
    .string('required')
    .trim()
    .min(1, 'required')
    .max(254, 'tooLong')
    .transform((value, ctx) => {
      if (value.includes('@')) {
        const email = value.toLowerCase();
        if (!z.email().safeParse(email).success) {
          ctx.addIssue({ code: 'custom', message: 'emailInvalid' });
          return z.NEVER;
        }
        return { kind: 'email' as const, value: email };
      }
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: 'custom', message: 'phoneInvalid' });
        return z.NEVER;
      }
      return { kind: 'phone' as const, value: phone };
    }),
  // No minimum length here: login only checks the password, it doesn't set one
  password: z
    .string('required')
    .min(1, 'required')
    .max(PASSWORD_MAX_LENGTH, 'tooLong'),
});

/** What the login form sends */
export type LoginRequest = z.input<typeof loginSchema>;

/** What the API works with: identifier is { kind: 'email' | 'phone', value } */
export type LoginInput = z.output<typeof loginSchema>;
