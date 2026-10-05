import { useFormatter, useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('Home');
  const format = useFormatter();

  const today = format.dateTime(new Date(), { dateStyle: 'full' });
  const salary = format.number(9000, { style: 'currency', currency: 'EGP' });

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-2">{t('description')}</p>
      <p className="mt-4 border-s-4 ps-3">{t('today', { date: today })}</p>
      <p className="mt-2 border-s-4 ps-3">{t('sampleSalary', { amount: salary })}</p>
    </div>
  );
}