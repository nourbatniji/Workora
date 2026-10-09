import { Construction } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Marks a screen that still shows sample data (SCRUM-176): a real Admin must never
 * mistake mock numbers for their company's data. Removed when the feature's API is wired in.
 */
export default function PrototypeBadge() {
  const t = useTranslations('Prototype');
  return (
    <p className="mb-4 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">
      <Construction className="size-3.5" strokeWidth={1.5} aria-hidden />
      <span className="font-medium">{t('badge')}</span>
      <span>· {t('hint')}</span>
    </p>
  );
}
