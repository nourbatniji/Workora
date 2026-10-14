import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import type {
  EmployeeDocumentList,
  EmployeeProfile,
  SalaryHistory,
  ShiftAssignments,
  ShiftTemplate,
} from '@mdarj/shared';
import ShiftCard from '@/components/employees/shift-card';
import DocumentsCard from '@/components/employees/documents-card';
import SalaryCard from '@/components/employees/salary-card';
import JobCard from '@/components/employees/job-card';
import PersonalCard from '@/components/employees/personal-card';
import ProfileHeader from '@/components/employees/profile-header';
import { Link } from '@/i18n/navigation';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { serverGet, serverGetResult } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/**
 * One employee (EM-08 profile, EM-02 personal data): /employees/EMP-0001. Admin only for now;
 * Employees will see their own with EM-10. Sections are added story by story (job, salary,
 * documents, contracts…).
 */

const profileTabs = [
  'personal',
  'job',
  'contract',
  'documents',
  'attendance',
  'leave',
  'payroll',
  'compliance',
];

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const { code } = await params;
  const { tab } = await searchParams;
  const activeTab =
    typeof tab === 'string' && profileTabs.includes(tab) ? tab : 'personal';
  const result = await serverGetResult<EmployeeProfile>(
    `/employees/${encodeURIComponent(code)}`,
  );
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(`GET /employees/${code} answered ${result.status}`);
  }
  const employee = result.data;
  const documents = await serverGet<EmployeeDocumentList>(
    `/employees/${employee.id}/documents`,
  );
  const jobTitles = await serverGet<{ items: JobTitle[] }>('/job-titles');
  const salary = await serverGet<SalaryHistory>(
    `/employees/${employee.id}/salary-history`,
  );
  const templates = await serverGet<{ items: ShiftTemplate[] }>(
    '/shift-templates',
  );
  const assignments = await serverGet<ShiftAssignments>(
    `/employees/${employee.id}/shift-assignments`,
  );
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
  const documentDates = Object.fromEntries(
    documents.items.map((row) => [row.id, dateText(row.expiryDate, 'long')]),
  );
  const shiftDates = Object.fromEntries(
    assignments.items.map((row) => [row.id, dateText(row.startDate, 'long')!]),
  );
  const salaryLabels = Object.fromEntries(
    salary.items.map((row) => [
      row.id,
      {
        amount: format.number(Number(row.baseSalary), {
          style: 'currency',
          currency: salary.currency,
        }),
        date: dateText(row.effectiveFrom, 'long')!,
      },
    ]),
  );

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

      <div className="flex gap-2 overflow-x-auto">
        {profileTabs.map((name) => (
          <Link
            key={name}
            href={`/employees/${encodeURIComponent(code)}?tab=${name}`}
            aria-current={activeTab === name ? 'page' : undefined}
            className={
              activeTab === name
                ? 'whitespace-nowrap rounded-lg border px-3 py-2 font-semibold'
                : 'whitespace-nowrap rounded-lg px-3 py-2 text-muted hover:text-text'
            }
          >
            {t(`tabs.${name}`)}
          </Link>
        ))}
      </div>

      {activeTab === 'personal' && (
        <PersonalCard
          employee={employee}
          birthDateText={dateText(employee.birthDate, 'long')}
        />
      )}
      {activeTab === 'job' && (
        <>
          <JobCard
            employee={employee}
            jobTitles={jobTitles.items}
            dates={profileDates}
          />
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div>
              <SalaryCard
                employeeId={employee.id}
                hireDate={employee.hireDate}
                history={salary}
                labels={salaryLabels}
              />
            </div>
            <div>
              <ShiftCard
                employeeId={employee.id}
                hireDate={employee.hireDate}
                templates={templates.items}
                assignments={assignments}
                dates={shiftDates}
              />
            </div>
          </div>
        </>
      )}
      {activeTab === 'documents' && (
        <DocumentsCard
          employeeId={employee.id}
          documents={documents}
          dates={documentDates}
        />
      )}
      {!['personal', 'job', 'documents'].includes(activeTab) && (
        <p className="rounded-lg border p-6 text-muted">{t('comingSoon')}</p>
      )}
    </div>
  );
}
