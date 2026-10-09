'use client';

// Who is logged in, and the way out (SCRUM-169): name, role and company from GET /auth/me, plus Log out
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Popover from '@/components/ui/popover';
import { useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import { useCurrentUser } from './current-user';

export default function UserMenu() {
  const t = useTranslations('Shell');
  const tRoles = useTranslations('Roles');
  const user = useCurrentUser();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const shownName = user.name ?? user.email ?? user.phone ?? '';

  async function logOut() {
    setLeaving(true);
    // The API ends the session and removes the cookie; even if the call fails, go to login
    await postJson('/auth/logout');
    router.replace('/login');
    router.refresh(); // drop the pages Next.js kept for the logged-in user
  }

  return (
    <Popover
      label={t('userMenu')}
      width="w-64"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={t('userMenu')}
          title={shownName}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-nav-selected text-[13px] font-medium text-accent-fg"
        >
          {shownName.trim().charAt(0).toUpperCase() || '·'}
        </button>
      )}
    >
      {() => (
        <div className="p-1">
          <p className="truncate px-2 text-sm font-medium">{shownName}</p>
          <p className="truncate px-2 text-xs text-muted">
            {tRoles(user.role)} · {user.company.name}
          </p>
          <button
            type="button"
            onClick={logOut}
            disabled={leaving}
            className="mt-3 flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-start text-sm text-text hover:bg-canvas disabled:opacity-60"
          >
            <LogOut
              className="size-4 rtl:-scale-x-100"
              strokeWidth={1.5}
              aria-hidden
            />
            {leaving ? t('loggingOut') : t('logOut')}
          </button>
        </div>
      )}
    </Popover>
  );
}
