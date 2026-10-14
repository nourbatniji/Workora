'use client';

import type { AuditLogItem } from '@mdarj/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import ChangeList from './change-list';

/** Desktop columns: when · who · what · employee · changes. Phones get one card per row (NFR-7) */
const COLUMNS =
  'md:grid md:grid-cols-[9.5rem_10rem_11rem_10rem_minmax(0,1fr)] md:gap-4';

/** Audit rows, newest first, read-only: there is no edit or delete action anywhere (NFR-8) */
export default function AuditTable({
  items,
  timestamps,
  page,
  pageSize,
  total,
  filters,
}: {
  items: AuditLogItem[];
  timestamps: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  /** The current filters as a query string, without the page */
  filters: string;
}) {
  const t = useTranslations('AuditLog');
  const locale = useLocale();

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        {filters ? t('emptyFiltered') : t('empty')}
      </p>
    );
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  /** The list with these filters plus extra ones */
  const href = (extra: Record<string, string>) => {
    const query = new URLSearchParams(filters);
    for (const [key, value] of Object.entries(extra)) query.set(key, value);
    return `/audit-log?${query}`;
  };

  return (
    <>
      <div
        className={`hidden border-b border-line pb-2 text-xs font-medium text-muted ${COLUMNS}`}
      >
        <span>{t('columns.when')}</span>
        <span>{t('columns.who')}</span>
        <span>{t('columns.what')}</span>
        <span>{t('columns.employee')}</span>
        <span>{t('columns.changes')}</span>
      </div>

      <ul>
        {items.map((item) => {
          const employeeName = item.employee
            ? locale === 'ar'
              ? item.employee.nameAr
              : item.employee.nameEn
            : null;
          return (
            <li
              key={item.id}
              className={`space-y-2 border-b border-line py-3 text-sm last:border-b-0 md:space-y-0 ${COLUMNS}`}
            >
              {/* When: in the company time zone (next-intl is set to Africa/Cairo) */}
              <p className="text-xs text-muted md:text-sm md:text-text">
                <time dateTime={item.createdAt}>{timestamps[item.id]}</time>
              </p>

              {/* Who */}
              <p className="min-w-0">
                <span className="me-1 text-xs text-muted md:sr-only">
                  {t('columns.who')}:
                </span>
                {item.user ? (
                  <span className="break-words">
                    {item.user.name ?? item.user.email ?? t('none')}
                  </span>
                ) : (
                  <span className="text-muted">{t('system')}</span>
                )}
              </p>

              {/* What */}
              <div className="min-w-0">
                <p className="font-medium">
                  {t(`types.${item.entityType}`)} ·{' '}
                  {t(`actions.${item.action}`)}
                </p>
                {item.subjectUser && (
                  <p className="text-xs break-words text-muted">
                    {item.subjectUser.name ?? item.subjectUser.email}
                  </p>
                )}
              </div>

              {/* Employee: click to see only this employee's changes */}
              <p className="min-w-0">
                {item.employee ? (
                  <Link
                    href={href({ employeeId: item.employee.id })}
                    title={t('showOnly', { name: employeeName ?? '' })}
                    className="break-words text-accent hover:underline"
                  >
                    <span dir="ltr">{item.employee.code}</span> · {employeeName}
                  </Link>
                ) : (
                  <span className="hidden text-muted md:inline">
                    {t('none')}
                  </span>
                )}
              </p>

              {/* Changes and reason */}
              <div className="min-w-0 space-y-1 rounded-[10px] bg-canvas p-3 md:bg-transparent md:p-0">
                <ChangeList before={item.before} after={item.after} />
                {item.reason && (
                  <p className="text-xs text-muted">
                    {t('reason', { reason: item.reason })}
                  </p>
                )}
              </div>
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
                href={href({ page: String(page - 1) })}
                className="h-9 rounded-[10px] border border-line px-3.5 leading-9 hover:bg-canvas"
              >
                {t('previous')}
              </Link>
            )}
            {page < pages && (
              <Link
                href={href({ page: String(page + 1) })}
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
