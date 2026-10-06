// Company sign-up (CS-01, FR-CS-1): the owner creates the company and becomes its first Admin.
// One schema for both sides (D-30): the web form checks it before sending, the API checks it again.
import { z } from 'zod';

// Password length limits (D-43)
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Errors are keys, not sentences: the web app translates them into Arabic or English (D-44)
export const signUpSchema = z.object({
  companyName: z
    .string('required')
    .trim()
    .min(1, 'required')
    .max(100, 'tooLong'),
  name: z.string('required').trim().min(1, 'required').max(100, 'tooLong'),
  // Trim and lowercase first, so "Mona@Nile.com " and "mona@nile.com" are the same person
  email: z
    .string('required')
    .trim()
    .toLowerCase()
    .min(1, 'required')
    .max(254, 'tooLong')
    .pipe(z.email('emailInvalid')),
  // Never trimmed: spaces can be part of a password
  password: z
    .string('required')
    .min(PASSWORD_MIN_LENGTH, 'passwordTooShort')
    .max(PASSWORD_MAX_LENGTH, 'tooLong'),
  // The language the page was in; the new Admin's account starts in it
  language: z.enum(['en', 'ar'], 'languageInvalid').default('en'),
});

/** What the form sends (language may be missing) */
export type SignUpRequest = z.input<typeof signUpSchema>;

/** What the API works with after checking (language always set, email lowercased) */
export type SignUpInput = z.output<typeof signUpSchema>;
