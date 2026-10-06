'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAppState, type Role } from './app-state';

const ROLES: Role[] = ['admin', 'employee', 'interviewer'];

/** Development-only switch to preview what each role will see. Not part of the real product. */
export default function RoleSwitcher() {
  const t = useTranslations('Shell');
  const tRoles = useTranslations('Roles');
  const { role, setRole } = useAppState();

  return (
    <label
      title={t('devRoleHint')}
      className="relative flex h-9 items-center gap-1.5 rounded-[10px] border border-dashed border-line bg-surface ps-2.5 pe-2 text-[13px]"
    >
      <span className="text-[11px] font-medium text-muted">{t('devRole')}</span>
      <select
        value={role}
        onChange={(event) => setRole(event.target.value as Role)}
        aria-label={t('devRoleHint')}
        className="cursor-pointer appearance-none bg-transparent pe-5 font-medium text-text outline-none"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {tRoles(r)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2 size-3.5 text-muted"
        strokeWidth={1.5}
        aria-hidden
      />
    </label>
  );
}
