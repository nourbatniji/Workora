'use client';

import type { EmployeeListPage } from '@mdarj/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { STATUS_CHOICES, type StatusChoice } from './status-choices';

/**
 * Status tabs with live counts: "Working 12 · Active 11 · Suspended 1 · Left 3 · All 15".
 * The counts follow the other filters (search, type, job title), so they always match the list.
 */
export default function StatusTabs({
  current,
  counts,
  filters,
}: {
  current: StatusChoice;
  counts: EmployeeListPage['counts'] | null;
  /** The other filters as a query string (no status, no page) */
  filters: string;
}) {
  const t = useTranslations('Employees.tabs');
  const format = useFormatter();

  const countOf = (choice: StatusChoice) => {
    if (!counts) return null;
    if (choice === 'working') return counts.active + counts.suspended;
    if (choice === 'all')
      return counts.active + counts.suspended + counts.terminated;
    return counts[choice];
  };

  const href = (choice: StatusChoice) => {
    const query = new URLSearchParams(filters);
    if (choice !== 'working') query.set('status', choice);
    const search = query.toString();
    return search ? `/employees?${search}` : '/employees';
  };

  return (
    // Scrolls sideways inside itself on narrow phones; the page never does (NFR-7)
    <nav className="-mx-5 mb-4 overflow-x-auto px-5 md:-mx-6 md:px-6">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {STATUS_CHOICES.map((choice) => {
          const active = choice === current;
          const count = countOf(choice);
          return (
            <li key={choice}>
              <Link
                href={href(choice)}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
                  active
                    ? 'border-accent font-medium text-text'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                {t(choice)}
                {count !== null && (
                  <span
                    className={`rounded-full px-1.5 py-px text-xs tabular-nums ${
                      active ? 'bg-nav-selected text-accent-fg' : 'bg-canvas'
                    }`}
                  >
                    {format.number(count)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
