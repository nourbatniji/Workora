import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import EmployeeForm from '@/components/employees/employee-form';
import type { JobTitle } from '@/components/settings/job-titles-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { serverGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/** Add employee (SCRUM-153, EM-01): the form; the system assigns the code. Admin only */
export default async function NewEmployeePage() {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('Employees.form');
  const jobTitles = await serverGet<{ items: JobTitle[] }>('/job-titles');

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/employees"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft
          className="size-4 rtl:rotate-180"
          strokeWidth={1.5}
          aria-hidden
        />
        {t('back')}
      </Link>
      <Card>
        <CardHeader title={t('title')} hint={t('hint')} />
        <EmployeeForm jobTitles={jobTitles.items} />
      </Card>
    </div>
  );
}
