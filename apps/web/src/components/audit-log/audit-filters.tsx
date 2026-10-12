'use client';

import { AUDIT_ENTITY_TYPES } from '@mdarj/shared';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { inputClass } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Filters for the audit log: record type and a date range (days in the company time zone).
 * They live in the address bar, so a filtered view can be refreshed, bookmarked or shared.
 * The employee filter is set by clicking a name in the list; the chip here removes it.
 */
export default function AuditFilters({
  type,
  from,
  to,
  employee,
}: {
  type?: string;
  from?: string;
  to?: string;
  employee: { id: string; label: string } | null;
}) {
  const t = useTranslations('AuditLog');
  const router = useRouter();
  const [form, setForm] = useState({
    type: type ?? '',
    from: from ?? '',
    to: to ?? '',
  });

  /** New filters start again from page 1 */
  function apply(event: React.FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (employee) query.set('employeeId', employee.id);
    if (form.type) query.set('type', form.type);
    if (form.from) query.set('from', form.from);
    if (form.to) query.set('to', form.to);
    const search = query.toString();
    router.push(search ? `/audit-log?${search}` : '/audit-log');
  }

  // The same filters without the employee
  const withoutEmployee = new URLSearchParams();
  if (type) withoutEmployee.set('type', type);
  if (from) withoutEmployee.set('from', from);
  if (to) withoutEmployee.set('to', to);
  const withoutEmployeeHref = withoutEmployee.toString()
    ? `/audit-log?${withoutEmployee}`
    : '/audit-log';

  const filtered = Boolean(type || from || to || employee);

  return (
    <div className="mb-5 space-y-3">
      <form
        onSubmit={apply}
        className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
      >
        <label className="col-span-2 block md:col-span-1">
          <span className="mb-1.5 block text-[13px] font-medium">
            {t('filters.type')}
          </span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className={inputClass(false)}
          >
            <option value="">{t('filters.allTypes')}</option>
            {AUDIT_ENTITY_TYPES.map((key) => (
              <option key={key} value={key}>
                {t(`types.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium">
            {t('filters.from')}
          </span>
          <input
            type="date"
            value={form.from}
            max={form.to || undefined}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
            className={inputClass(false)}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] font-medium">
            {t('filters.to')}
          </span>
          <input
            type="date"
            value={form.to}
            min={form.from || undefined}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
            className={inputClass(false)}
          />
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <button
            type="submit"
            className="h-10 flex-1 rounded-[10px] bg-accent px-4 text-sm font-medium text-white hover:opacity-90 md:flex-none"
          >
            {t('filters.apply')}
          </button>
          {filtered && (
            <Link
              href="/audit-log"
              className="h-10 flex-1 rounded-[10px] border border-line px-4 text-center text-sm leading-10 whitespace-nowrap hover:bg-canvas md:flex-none"
            >
              {t('filters.clear')}
            </Link>
          )}
        </div>
      </form>

      {employee && (
        <Link
          href={withoutEmployeeHref}
          aria-label={t('filters.removeEmployee')}
          title={t('filters.removeEmployee')}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-nav-selected px-3 py-1 text-[13px] text-accent-fg hover:opacity-90"
        >
          <span className="truncate">
            {t('filters.employee', { name: employee.label })}
          </span>
          <X className="size-3.5 shrink-0" aria-hidden />
        </Link>
      )}
    </div>
  );
}
