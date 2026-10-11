import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import CompanyProfileCard, {
  type CompanyProfile,
} from '@/components/settings/company-profile-card';
import WorkWeekCard, {
  type SettingsVersion,
} from '@/components/settings/work-week-card';
import JobTitlesCard, {
  type JobTitle,
} from '@/components/settings/job-titles-card';
import { serverGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

/**
 * Settings (SRS 3.1, SCRUM-152). Admin only. Built section by section with the Company
 * settings feature: profile (CS-03), work week from a date (CS-04, CS-08) and job titles (CS-09) so far; payroll and check-in follow.
 */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('Settings');
  const [company, settings, jobTitles] = await Promise.all([
    serverGet<CompanyProfile>('/company'),
    serverGet<{ today: string; items: SettingsVersion[] }>(
      '/company/settings/versions',
    ),
    serverGet<{ items: JobTitle[] }>('/job-titles'),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-medium">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">
          {t('hint', { company: session.user.company.name })}
        </p>
      </div>
      <CompanyProfileCard company={company} />
      <WorkWeekCard today={settings.today} versions={settings.items} />
      <JobTitlesCard items={jobTitles.items} />
    </div>
  );
}
