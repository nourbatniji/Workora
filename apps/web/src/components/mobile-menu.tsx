'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import NavLinks from './nav-links';

export default function MobileMenu() {
  const t = useTranslations('Shell');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t('openMenu')}
        className="rounded border px-3 py-1 text-lg leading-none"
      >
        ☰
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40">
          {/* Dark background: tap it to close */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />

          {/* The panel, on the start side */}
          <nav className="absolute inset-y-0 start-0 w-64 max-w-[80%] bg-background p-4 shadow-lg">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mb-4 rounded border px-3 py-1 text-sm"
            >
              {t('closeMenu')}
            </button>
            <NavLinks onNavigate={() => setIsOpen(false)} />
          </nav>
        </div>
      )}
    </div>
  );
}