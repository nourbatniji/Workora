'use client';

import type { EmployeeProfile } from '@mdarj/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Card, CardHeader } from '@/components/ui/card';

/** Job data, read only for now: editing it is EM-03 (SCRUM-50) */
export default function JobCard({ employee }: { employee: EmployeeProfile }) {
  const t = useTranslations('Employees');
  const format = useFormatter();
  const locale = useLocale();

  const day = (value: string | null) =>
    value
      ? format.dateTime(new Date(`${value}T00:00:00Z`), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null;

  const rows: [string, string | null][] = [
    [
      'jobTitle',
      employee.jobTitle
        ? locale === 'ar'
          ? employee.jobTitle.nameAr
          : employee.jobTitle.nameEn
        : null,
    ],
    ['employmentType', t(`types.${employee.employmentType}`)],
    ['hireDate', day(employee.hireDate)],
    ['probationEnd', day(employee.probationEnd)],
    ...(employee.employmentType === 'trainee'
      ? ([['trainingEnd', day(employee.trainingEnd)]] as [
          string,
          string | null,
        ][])
      : []),
    ...(employee.status === 'terminated'
      ? ([['terminationDate', day(employee.terminationDate)]] as [
          string,
          string | null,
        ][])
      : []),
  ];

  return (
    <Card>
      <CardHeader title={t('profile.job')} hint={t('profile.jobHint')} />
      <dl className="flex flex-col gap-3 text-sm">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{t(`profile.fields.${key}`)}</dt>
            <dd className={`text-end ${value ? '' : 'text-muted'}`}>
              {value ?? t('profile.notGiven')}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
