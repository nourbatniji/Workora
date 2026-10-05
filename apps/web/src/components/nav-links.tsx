'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const NAV_ITEMS = [
  { href: '/', key: 'dashboard' },
  { href: '/employees', key: 'employees' },
  { href: '/attendance', key: 'attendance' },
  { href: '/leave', key: 'leave' },
  { href: '/payroll', key: 'payroll' },
  { href: '/settings', key: 'settings' },
] as const;

export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`block rounded px-3 py-2 ${isActive ? 'bg-black/10 font-bold' : 'hover:bg-black/5'}`}
            >
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}