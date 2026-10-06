// Phone numbers are stored and compared in one form: + and digits, like +201012345678 (D-45)

/** "010 1234 5678", "00201012345678" or "+20 101-234-5678" → "+201012345678". Not a phone number → null. */
export function normalizePhone(raw: string): string | null {
  let phone = raw.replace(/[\s\-().]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  // Egyptian mobile written locally: 01xxxxxxxxx → +201xxxxxxxxx
  if (/^01\d{9}$/.test(phone)) phone = `+2${phone}`;
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}
