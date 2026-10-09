import { getFormatter, getTranslations } from 'next-intl/server';
import AttendanceInsight from '@/components/dashboard/attendance-insight';
import LateArrivals from '@/components/dashboard/late-arrivals';
import TodayBoard from '@/components/dashboard/today-board';
import {
  CandidatesCard,
  ComplianceCard,
  ContractsCard,
  LatestExceptions,
  PendingCard,
} from '@/components/dashboard/cards';
import { getSession } from '@/lib/session';
import { today } from '@/mock/dashboard';
import { dayDate } from '@/lib/dates';

/** Admin dashboard (FR-DB-1): a bento grid with cards of different widths */
export default async function DashboardPage() {
  const t = await getTranslations('Dashboard');
  const format = await getFormatter();
  // The real logged-in user (the layout already asked the API; getSession reuses that answer)
  const { user } = await getSession();
  const shownName = user?.name ?? user?.email ?? '';

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-5">
        <p className="text-lg font-medium">
          {t('greeting', { name: shownName.split(' ')[0] })}
        </p>
        <p className="text-[13px] text-muted">
          {t('subtitle', {
            date: format.dateTime(dayDate(today.date), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 *:min-w-0 md:grid-cols-2 lg:grid-cols-12">
        {/* Row 1 */}
        <div className="md:col-span-2 lg:col-span-5">
          <AttendanceInsight />
        </div>
        <div className="md:col-span-2 lg:col-span-7">
          <LateArrivals />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-4">
          <TodayBoard />
        </div>
        <div className="lg:col-span-4">
          <PendingCard />
        </div>
        <div className="md:col-span-2 lg:col-span-4">
          <ComplianceCard />
        </div>

        {/* Row 3 */}
        <div className="min-w-0 md:col-span-2 lg:col-span-8">
          <LatestExceptions />
        </div>
        <div className="flex flex-col gap-4 md:col-span-2 md:grid md:grid-cols-2 lg:col-span-4 lg:flex">
          <ContractsCard />
          <CandidatesCard />
        </div>
      </div>
    </div>
  );
}
