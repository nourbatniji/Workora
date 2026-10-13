'use client';

import { EMPLOYMENT_TYPES } from '@mdarj/shared';
import { Search, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { useRouter } from '@/i18n/navigation';

const SORT_CHOICES = ['code', 'nameEn', 'nameAr', '-hireDate', 'hireDate'];

/** The small pill-shaped menus of the toolbar */
const pill =
  'h-9 max-w-full rounded-full border border-line bg-surface ps-3 pe-8 text-[13px] outline-none transition-colors hover:bg-canvas focus:border-accent';

/**
 * Search and filters for the employee list. Every change applies at once (search after a short
 * pause) and lives in the address bar, so a filtered list can be refreshed, shared, or exported
 * exactly as it is. The status is chosen with the tabs above.
 */
export default function EmployeeFilters({
  q,
  status,
  employmentType,
  jobTitleId,
  sort,
  jobTitles,
}: {
  q?: string;
  /** The current status tab, kept when the other filters change */
  status?: string;
  employmentType?: string;
  jobTitleId?: string;
  sort?: string;
  jobTitles: JobTitle[];
}) {
  const t = useTranslations('Employees');
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState(q ?? '');

  /** Builds the address with one filter changed; new filters start again from page 1 */
  function go(change: Record<string, string | undefined>) {
    const next = { q, status, employmentType, jobTitleId, sort, ...change };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === 'sort' && value === 'code')) query.set(key, value);
    }
    const text = query.toString();
    router.replace(text ? `/employees?${text}` : '/employees');
  }

  // Search as you type, after a 400 ms pause, so every key press isn't a request
  useEffect(() => {
    if (search.trim() === (q ?? '')) return; // nothing new to search for
    const timer = setTimeout(() => go({ q: search.trim() || undefined }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text starts a search
  }, [search]);

  const titleName = (id: string) => {
    const title = jobTitles.find((item) => item.id === id);
    return title ? (locale === 'ar' ? title.nameAr : title.nameEn) : '';
  };

  // The filters in use, as chips with a remove button
  const chips = [
    q && { key: 'q', label: t('chips.search', { q }) },
    employmentType && {
      key: 'employmentType',
      label: t(`types.${employmentType as (typeof EMPLOYMENT_TYPES)[number]}`),
    },
    jobTitleId && { key: 'jobTitleId', label: titleName(jobTitleId) },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-full sm:basis-64">
          <span className="sr-only">{t('filters.search')}</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go({ q: search.trim() || undefined });
            }}
            placeholder={t('filters.searchPlaceholder')}
            className="h-9 w-full rounded-full border border-line bg-surface ps-9 pe-3 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
        </label>

        <select
          aria-label={t('filters.type')}
          value={employmentType ?? ''}
          onChange={(e) => go({ employmentType: e.target.value || undefined })}
          className={pill}
        >
          <option value="">{t('filters.allTypes')}</option>
          {EMPLOYMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>

        <select
          aria-label={t('filters.jobTitle')}
          value={jobTitleId ?? ''}
          onChange={(e) => go({ jobTitleId: e.target.value || undefined })}
          className={pill}
        >
          <option value="">{t('filters.allTitles')}</option>
          {jobTitles.map((title) => (
            <option key={title.id} value={title.id}>
              {locale === 'ar' ? title.nameAr : title.nameEn}
            </option>
          ))}
        </select>

        <select
          aria-label={t('filters.sort')}
          value={sort ?? 'code'}
          onChange={(e) => go({ sort: e.target.value })}
          className={pill}
        >
          {SORT_CHOICES.map((choice) => (
            <option key={choice} value={choice}>
              {t('filters.sort')}: {t(`sorts.${choice}`)}
            </option>
          ))}
        </select>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                if (chip.key === 'q') setSearch('');
                go({ [chip.key]: undefined });
              }}
              aria-label={t('chips.remove', { name: chip.label })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-nav-selected px-3 py-1 text-[13px] text-accent-fg hover:opacity-90"
            >
              <span className="truncate">{chip.label}</span>
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSearch('');
              go({
                q: undefined,
                employmentType: undefined,
                jobTitleId: undefined,
              });
            }}
            className="text-[13px] text-muted hover:text-text"
          >
            {t('chips.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}
