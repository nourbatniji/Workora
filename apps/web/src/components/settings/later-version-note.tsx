'use client';

import { TriangleAlert } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { SettingsVersion } from './work-week-card';

/**
 * D-70: a change does not flow into a version already scheduled after its start date. When one
 * exists, say so before saving: the change only applies until that version starts.
 */
export default function LaterVersionNote({
  versions,
  effectiveFrom,
}: {
  versions: SettingsVersion[];
  effectiveFrom: string;
}) {
  const t = useTranslations('Settings');
  const format = useFormatter();

  // The first version starting after the chosen day ("YYYY-MM-DD" sorts like a date)
  const later = versions
    .filter((v) => v.effectiveFrom > effectiveFrom)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  if (!later) return null;

  const date = format.dateTime(new Date(`${later.effectiveFrom}T12:00:00Z`), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <p className="flex items-start gap-2 rounded-[10px] border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
      <TriangleAlert
        className="mt-0.5 size-4 shrink-0 text-warning"
        strokeWidth={1.5}
        aria-hidden
      />
      <span>{t('laterVersion', { date })}</span>
    </p>
  );
}
