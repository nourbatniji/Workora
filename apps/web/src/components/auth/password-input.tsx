'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { inputClass } from '@/components/ui/field';

/** Password box with a show/hide eye button. Used by login, sign-up and set password. */
export default function PasswordInput({
  value,
  onChange,
  invalid,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  autoComplete: 'current-password' | 'new-password';
}) {
  const t = useTranslations('Auth');
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={shown ? 'text' : 'password'}
        dir="ltr"
        autoComplete={autoComplete}
        className={`${inputClass(invalid)} pe-10 rtl:text-end`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={t(shown ? 'hidePassword' : 'showPassword')}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted hover:text-text"
      >
        {shown ? (
          <EyeOff className="size-4" strokeWidth={1.5} aria-hidden />
        ) : (
          <Eye className="size-4" strokeWidth={1.5} aria-hidden />
        )}
      </button>
    </div>
  );
}
