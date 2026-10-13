'use client';

import type { EmployeeListItem } from '@mdarj/shared';
import { UserPlus } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import AppAccessButton from './app-access-button';
import { useTenure } from './person-bits';
import EmployeeAvatar from './employee-avatar';

/** Desktop columns: person · job · status · hired · phone · app access. Phones: one card per person (NFR-7) */
const COLUMNS =
  'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_7rem_minmax(0,1.1fr)_8.5rem_9.5rem] md:items-center md:gap-4';

const STATUS_STYLE: Record<EmployeeListItem['status'], string> = {
  active: 'bg-success/10 text-text',
  suspended: 'bg-warning/15 text-text',
  terminated: 'bg-canvas text-muted',
};
const STATUS_DOT: Record<EmployeeListItem['status'], string> = {
  active: 'bg-success',
  suspended: 'bg-warning',
  terminated: 'bg-muted',
};

/** The employee list. A name opens the employee's profile */
export default function EmployeesTable({
  items,
  page,
  pageSize,
  total,
  filters,
}: {
  items: EmployeeListItem[];
  page: number;
  pageSize: number;
  total: number;
  /** The current filters as a query string, without the page */
  filters: string;
}) {
  const t = useTranslations('Employees');
  const format = useFormatter();
  const locale = useLocale();
  const tenure = useTenure();

  if (items.length === 0) {
    return filters ? (
      <p className="py-12 text-center text-sm text-muted">
        {t('emptyFiltered')}
      </p>
    ) : (
      <div className="flex flex-col items-center py-14 text-center">
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-nav-selected text-accent-fg">
          <UserPlus className="size-6" strokeWidth={1.5} aria-hidden />
        </span>
        <p className="mb-4 max-w-xs text-sm text-muted">{t('empty')}</p>
        <Link
          href="/employees/new"
          className="inline-flex h-9 items-center rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white hover:opacity-90"
        >
          {t('add')}
        </Link>
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (n: number) => {
    const query = new URLSearchParams(filters);
    query.set('page', String(n));
    return `/employees?${query}`;
  };

  return (
    <>
      <p className="mb-2 text-xs text-muted">
        {t('resultCount', { count: total })}
      </p>

      <div
        className={`hidden border-b border-line px-2 pb-2 text-xs font-medium text-muted ${COLUMNS}`}
      >
        <span>{t('columns.name')}</span>
        <span>{t('columns.jobTitle')}</span>
        <span>{t('columns.status')}</span>
        <span>{t('columns.hireDate')}</span>
        <span>{t('columns.phone')}</span>
        <span>{t('access.column')}</span>
      </div>

      <ul className="-mx-2">
        {items.map((employee) => {
          const name = locale === 'ar' ? employee.nameAr : employee.nameEn;
          const otherName = locale === 'ar' ? employee.nameEn : employee.nameAr;
          const title = employee.jobTitle
            ? locale === 'ar'
              ? employee.jobTitle.nameAr
              : employee.jobTitle.nameEn
            : null;
          return (
            <li
              key={employee.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-[12px] px-2 py-3 text-sm transition-colors hover:bg-canvas ${COLUMNS}`}
            >
              {/* Person: avatar, name, code and the other-language name */}
              <span className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                <EmployeeAvatar
                  employee={employee}
                  name={name}
                  locale={locale}
                />
                <span className="min-w-0 leading-tight">
                  <Link
                    href={`/employees/${employee.code}`}
                    className="block truncate font-medium hover:text-accent hover:underline"
                  >
                    {name}
                  </Link>
                  <span className="block truncate text-xs text-muted">
                    <span dir="ltr">{employee.code}</span> · {otherName}
                  </span>
                </span>
              </span>

              {/* Status: top corner of the card on phones, its own column on desktop */}
              <span className="justify-self-end md:order-3 md:justify-self-start">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLE[employee.status]}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${STATUS_DOT[employee.status]}`}
                    aria-hidden
                  />
                  {t(`status.${employee.status}`)}
                </span>
              </span>

              {/* Job: title and employment type */}
              <span className="col-span-3 min-w-0 ps-12 md:order-2 md:col-span-1 md:ps-0">
                <span className="block truncate">{title ?? t('none')}</span>
                <span className="block text-xs text-muted">
                  {t(`types.${employee.employmentType}`)}
                </span>
              </span>

              {/* Hired: date and how long ago */}
              <span className="col-span-3 min-w-0 ps-12 text-xs text-muted md:order-4 md:col-span-1 md:ps-0 md:text-sm md:text-text">
                <span className="block">
                  {format.dateTime(new Date(`${employee.hireDate}T00:00:00Z`), {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
                <span className="block text-xs text-muted">
                  {tenure(employee.hireDate)}
                </span>
              </span>

              {/* Phone */}
              <span
                className="col-span-3 min-w-0 truncate ps-12 text-xs text-muted md:order-5 md:col-span-1 md:ps-0 md:text-sm md:text-text rtl:text-end"
                dir="ltr"
              >
                {employee.phone ?? (
                  <span className="hidden md:inline">{t('none')}</span>
                )}
              </span>

              {/* App access (D-77): a badge, or the button that sends the invite */}
              <span className="col-span-3 ps-12 pt-1 md:order-6 md:col-span-1 md:ps-0 md:pt-0">
                <AppAccessButton employee={employee} />
              </span>
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-3 text-sm"
          aria-label={t('pagination')}
        >
          <span className="text-muted">{t('pageOf', { page, pages })}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="h-9 rounded-[10px] border border-line px-3.5 leading-9 hover:bg-canvas"
              >
                {t('previous')}
              </Link>
            )}
            {page < pages && (
              <Link
                href={pageHref(page + 1)}
                className="h-9 rounded-[10px] border border-line px-3.5 leading-9 hover:bg-canvas"
              >
                {t('next')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
