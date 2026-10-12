import { Download, Plus } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { EmployeeListPage } from '@mdarj/shared';
import EmployeeFilters from '@/components/employees/employee-filters';
import EmployeesTable from '@/components/employees/employees-table';
import {
  STATUS_CHOICES,
  type StatusChoice,
} from '@/components/employees/status-choices';
import StatusTabs from '@/components/employees/status-tabs';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { serverGet, serverGetResult } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/** What each status tab asks the API for (no status = Active and Suspended) */
const STATUS_QUERY: Record<StatusChoice, string | undefined> = {
  working: undefined,
  active: 'active',
  suspended: 'suspended',
  terminated: 'terminated',
  all: 'active,suspended,terminated',
};

/**
 * Employees (SCRUM-153, EM-09 list and EM-01 create): status tabs with counts, search and filters
 * that apply at once, sort, pages, Excel export of what is on screen, and "Add employee".
 * Admin only: other roles get "not found", and the API refuses them too.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('Employees');
  const locale = await getLocale();
  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === 'string' && params[key] !== ''
      ? params[key]
      : undefined;

  const statusChoice =
    STATUS_CHOICES.find((s) => s === one('status')) ?? 'working';

  // The filters other than status, as the page's address keeps them
  const otherFilters = new URLSearchParams();
  for (const key of ['q', 'employmentType', 'jobTitleId', 'sort']) {
    const value = one(key);
    if (value) otherFilters.set(key, value);
  }

  // The page's address (status as the tab's name) and the API's query (status as a list)
  const pageFilters = new URLSearchParams(otherFilters);
  if (statusChoice !== 'working') pageFilters.set('status', statusChoice);
  const apiFilters = new URLSearchParams(otherFilters);
  const status = STATUS_QUERY[statusChoice];
  if (status) apiFilters.set('status', status);

  const apiQuery = new URLSearchParams(apiFilters);
  const page = one('page');
  if (page) apiQuery.set('page', page);

  const [result, jobTitles] = await Promise.all([
    serverGetResult<EmployeeListPage>(`/employees?${apiQuery}`),
    serverGet<{ items: JobTitle[] }>('/job-titles'),
  ]);

  // The export downloads exactly what is on screen, in the page's language. A plain link through
  // the /api proxy (with the session cookie), not a next-intl Link, which would add /en or /ar
  const exportQuery = new URLSearchParams(apiFilters);
  exportQuery.set('lang', locale === 'ar' ? 'ar' : 'en');

  const created = one('created');

  return (
    <Card>
      <CardHeader
        title={t('title')}
        hint={t('hint', { company: session.user.company.name })}
        action={
          <div className="flex shrink-0 gap-2">
            <a
              href={`/api/employees/export?${exportQuery}`}
              download
              title={t('export')}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line px-3 text-sm hover:bg-canvas"
            >
              <Download className="size-4" strokeWidth={1.5} aria-hidden />
              <span className="hidden sm:inline">{t('export')}</span>
            </a>
            <Link
              href="/employees/new"
              className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Plus className="size-[18px]" strokeWidth={1.5} aria-hidden />
              <span className="hidden sm:inline">{t('add')}</span>
            </Link>
          </div>
        }
      />

      {created && (
        <p
          role="status"
          className="mb-4 rounded-[10px] bg-success/10 px-3 py-2 text-sm"
        >
          {t('created', { code: created })}
        </p>
      )}

      <StatusTabs
        current={statusChoice}
        counts={result.ok ? result.data.counts : null}
        filters={otherFilters.toString()}
      />

      <EmployeeFilters
        q={one('q')}
        status={statusChoice === 'working' ? undefined : statusChoice}
        employmentType={one('employmentType')}
        jobTitleId={one('jobTitleId')}
        sort={one('sort')}
        jobTitles={jobTitles.items}
      />

      {result.ok ? (
        <EmployeesTable
          items={result.data.items}
          page={result.data.page}
          pageSize={result.data.pageSize}
          total={result.data.total}
          filters={pageFilters.toString()}
        />
      ) : (
        <p role="alert" className="py-8 text-center text-sm text-danger">
          {result.status === 400 ? t('badFilters') : t('loadFailed')}
        </p>
      )}
    </Card>
  );
}
