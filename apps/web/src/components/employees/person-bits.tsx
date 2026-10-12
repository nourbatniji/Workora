'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Soft avatar colours, picked from the code so a person always gets the same one */
const AVATAR_TINTS = [
  'bg-nav-selected text-accent-fg',
  'bg-success/12 text-success',
  'bg-warning/15 text-warning',
];

function tintFor(code: string) {
  let sum = 0;
  for (const char of code) sum += char.charCodeAt(0);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

/** "Mona Ali" → "MA"; Arabic names use the first letter only */
function initials(name: string, locale: string) {
  const words = name.trim().split(/\s+/);
  if (locale === 'ar') return words[0]?.[0] ?? '';
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** The employee's initials in a soft circle; the same colour everywhere for the same code */
export function Avatar({
  name,
  code,
  locale,
  size = 'md',
}: {
  name: string;
  code: string;
  locale: string;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${tintFor(code)} ${
        size === 'lg' ? 'size-16 text-xl' : 'size-9 text-xs'
      }`}
    >
      {initials(name, locale)}
    </span>
  );
}

/** Whole months between a day ("2025-08-01") and now */
function monthsSince(day: string, now: number) {
  const hired = new Date(`${day}T00:00:00Z`);
  const today = new Date(now);
  return (
    (today.getUTCFullYear() - hired.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - hired.getUTCMonth()) -
    (today.getUTCDate() < hired.getUTCDate() ? 1 : 0)
  );
}

/** "1 yr 2 mo", "3 mo", "New this month" or "Starts soon", from the hire date */
export function useTenure() {
  const t = useTranslations('Employees.tenure');
  const [now] = useState(() => Date.now());
  return (hireDate: string) => {
    const months = monthsSince(hireDate, now);
    if (months < 0) return t('starts');
    if (months === 0) return t('new');
    if (months < 12) return t('months', { months });
    return t('years', { years: Math.floor(months / 12), months: months % 12 });
  };
}
