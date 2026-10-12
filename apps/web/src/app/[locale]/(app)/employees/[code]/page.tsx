import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import type { EmployeeProfile } from '@mdarj/shared';
import JobCard from '@/components/employees/job-card';
import PersonalCard from '@/components/employees/personal-card';
import ProfileHeader from '@/components/employees/profile-header';
import styles from '@/components/employees/profile.module.css';
import { Link } from '@/i18n/navigation';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { serverGet, serverGetResult } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/**
 * One employee (EM-08 profile, EM-02 personal data): /employees/EMP-0001. Admin only for now;
 * Employees will see their own with EM-10. Sections are added story by story (job, salary,
 * documents, contracts…).
 */
export default async function EmployeePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const { code } = await params;
  const result = await serverGetResult<EmployeeProfile>(
    `/employees/${encodeURIComponent(code)}`,
  );
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(`GET /employees/${code} answered ${result.status}`);
  }
  const employee = result.data;
  const jobTitles = await serverGet<{ items: JobTitle[] }>('/job-titles');
  const t = await getTranslations('Employees.profile');
  const format = await getFormatter();
  // Node and Safari can use different ICU punctuation. Hydrate with one server snapshot.
  const dateText = (value: string | null, month: 'long' | 'short') =>
    value
      ? format.dateTime(new Date(`${value}T00:00:00Z`), {
          day: 'numeric',
          month,
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null;
  const profileDates = {
    hireDate: dateText(employee.hireDate, 'short')!,
    probationEnd: dateText(employee.probationEnd, 'short'),
    trainingEnd: dateText(employee.trainingEnd, 'short'),
    terminationDate: dateText(employee.terminationDate, 'short'),
  };
  const referenceTime = (await getNow()).getTime();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link
        href="/employees"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft
          className="size-4 rtl:rotate-180"
          strokeWidth={1.5}
          aria-hidden
        />
        {t('back')}
      </Link>

      <ProfileHeader
        employee={employee}
        hireDateText={dateText(employee.hireDate, 'long')!}
        referenceTime={referenceTime}
      />

      <div className={styles.columns}>
        <PersonalCard
          employee={employee}
          birthDateText={dateText(employee.birthDate, 'long')}
        />
        <JobCard
          employee={employee}
          jobTitles={jobTitles.items}
          dates={profileDates}
        />
      </div>
    </div>
  );
}
