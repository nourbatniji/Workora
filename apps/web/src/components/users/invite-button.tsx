'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAppState } from '@/components/shell/app-state';

/** Opens the same invite dialog as the top bar */
export default function InviteButton() {
  const t = useTranslations('Users');
  const { open } = useAppState();
  return (
    <button
      type="button"
      onClick={() => open('invite')}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
    >
      <UserPlus className="size-[18px]" strokeWidth={1.5} aria-hidden />
      {t('invite')}
    </button>
  );
}
