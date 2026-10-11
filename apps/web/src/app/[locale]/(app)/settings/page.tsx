import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import JobTitlesCard, {
  type JobTitle,
} from '@/components/settings/job-titles-card';
import { serverGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/**
 * Settings (SRS 3.1, SCRUM-152). Admin only. Built section by section with the Company
 * settings feature: job titles first (CS-09); profile, work week, payroll and check-in follow.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('Settings');
  const jobTitles = await serverGet<{ items: JobTitle[] }>('/job-titles');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-medium">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">
          {t('hint', { company: session.user.company.name })}
        </p>
      </div>
      <JobTitlesCard items={jobTitles.items} />
    </div>
  );
}
