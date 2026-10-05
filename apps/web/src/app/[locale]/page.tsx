import { useFormatter, useTranslations } from 'next-intl';
import DataTable from '@/components/data-table';

export default function HomePage() {
  const t = useTranslations('Home');
  const tc = useTranslations('Columns');
  const format = useFormatter();

  const today = format.dateTime(new Date(), { dateStyle: 'full' });
  const salary = format.number(9000, { style: 'currency', currency: 'EGP' });
  const hireDate = format.dateTime(new Date('2025-03-01'), { dateStyle: 'medium' });

  const columns = [tc('code'), tc('name'), tc('jobTitle'), tc('hireDate'), tc('salary'), tc('status')];
  const rows = [
    ['E-001', 'أحمد حسن', 'Accountant', hireDate, salary, tc('active')],
    ['E-002', 'Sara Ali', 'Driver', hireDate, salary, tc('active')],
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-2">{t('description')}</p>
      <p className="mt-4 border-s-4 ps-3">{t('today', { date: today })}</p>
      <p className="mt-2 border-s-4 ps-3">{t('sampleSalary', { amount: salary })}</p>

      <h2 className="mt-6 mb-2 text-lg font-semibold">{t('employeesTitle')}</h2>
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}