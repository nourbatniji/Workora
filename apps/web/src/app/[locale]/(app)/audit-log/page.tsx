import { notFound } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { AuditLogPage as AuditPage } from '@mdarj/shared';
import AuditFilters from '@/components/audit-log/audit-filters';
import AuditTable from '@/components/audit-log/audit-table';
import { Card, CardHeader } from '@/components/ui/card';
import { serverGetResult } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/** The filters this page passes on to GET /audit-log, read from the address bar */
const FILTER_KEYS = ['employeeId', 'type', 'from', 'to'] as const;

/**
 * Audit log viewer (SCRUM-163, FR-DB-4, NFR-8): who changed what and when, read-only.
 * Admin only: other roles get "not found", and the API refuses them too.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('AuditLog');
  const locale = await getLocale();
  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === 'string' ? params[key] : undefined;

  // The filters, without the page number: what every link and the pages carry along
  const filters = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = one(key);
    if (value) filters.set(key, value);
  }
  const query = new URLSearchParams(filters);
  const page = one('page');
  if (page) query.set('page', page);

  const result = await serverGetResult<AuditPage>(`/audit-log?${query}`);
  const format = await getFormatter();
  // Safari and Node can use different ICU punctuation; send one formatted snapshot.
  const timestamps = Object.fromEntries(
    (result.ok ? result.data.items : []).map((item) => [
      item.id,
      format.dateTime(new Date(item.createdAt), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    ]),
  );

  // The employee chip: the rows already carry the filtered employee's code and name
  const employeeId = one('employeeId');
  const employeeRow = result.ok
    ? result.data.items.find((item) => item.employee?.id === employeeId)
        ?.employee
    : undefined;
  const employee = employeeId
    ? {
        id: employeeId,
        label: employeeRow
          ? `${employeeRow.code} · ${locale === 'ar' ? employeeRow.nameAr : employeeRow.nameEn}`
          : t('filters.anEmployee'),
      }
    : null;

  return (
    <Card>
      <CardHeader
        title={t('title')}
        hint={t('hint', { company: session.user.company.name })}
      />
      <AuditFilters
        type={one('type')}
        from={one('from')}
        to={one('to')}
        employee={employee}
      />
      {result.ok ? (
        <AuditTable
          items={result.data.items}
          timestamps={timestamps}
          page={result.data.page}
          pageSize={result.data.pageSize}
          total={result.data.total}
          filters={filters.toString()}
        />
      ) : (
        <p role="alert" className="py-8 text-center text-sm text-danger">
          {result.status === 400 ? t('badFilters') : t('loadFailed')}
        </p>
      )}
    </Card>
  );
}
