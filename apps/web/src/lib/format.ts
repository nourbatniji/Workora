'use client';

import { useFormatter } from 'next-intl';

/** EGP amounts the way each language expects them (EGP 187.50 / ج.م.‏ 187.50) */
export function useMoney() {
  const format = useFormatter();
  return {
    /** Plain amount, e.g. salary */
    egp: (amount: number) =>
      format.number(amount, { style: 'currency', currency: 'EGP' }),
    /** With a + or − sign: deductions are negative, overtime positive (FR-EX-2) */
    signed: (amount: number) =>
      format.number(amount, {
        style: 'currency',
        currency: 'EGP',
        signDisplay: 'exceptZero',
      }),
  };
}
