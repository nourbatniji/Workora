// Company profile (CS-03, FR-CS-3): name, address, phone and time zone.
// The logo waits for file storage (FND-06); the currency is EGP for the MVP.
import { z } from 'zod';
import { normalizePhone } from '../phone.js';

/** An empty box means "remove it", so it becomes null */
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/** Is this a real IANA time zone, like "Africa/Cairo"? */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const companyProfileSchema = z.object({
  name: z.string('required').trim().min(1, 'required').max(100, 'tooLong'),
  address: z.preprocess(
    emptyToNull,
    z.string('tooLong').trim().max(200, 'tooLong').nullable().optional(),
  ),
  // The company's phone, stored like every phone: +201012345678 (D-45)
  phone: z.preprocess(
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
  ),
  timeZone: z.string('required').trim().refine(isTimeZone, 'timeZoneInvalid'),
});

export type CompanyProfileInput = z.output<typeof companyProfileSchema>;
