'use client';

import { useTranslations } from 'next-intl';

type Values = Record<string, unknown>;

const asObject = (value: unknown): Values | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Values)
    : null;

/**
 * The fields a change touched, as "Field: old → new". Only fields whose value differs are shown,
 * so a settings save that changed one rate shows one line, not the whole settings version.
 */
export default function ChangeList({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const t = useTranslations('AuditLog');
  const old = asObject(before) ?? {};
  const now = asObject(after) ?? {};

  const keys = [...new Set([...Object.keys(old), ...Object.keys(now)])].filter(
    (key) => JSON.stringify(old[key]) !== JSON.stringify(now[key]),
  );

  if (keys.length === 0) {
    return <span className="text-muted">{t('noChanges')}</span>;
  }

  /** A value as short text: lists joined, yes/no, nested rules as compact JSON */
  const show = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return t('none');
    if (typeof value === 'boolean') return value ? t('yes') : t('no');
    if (Array.isArray(value))
      return value.length === 0 ? t('none') : value.map(String).join(', ');
    if (typeof value === 'object') {
      const text = JSON.stringify(value);
      return text.length > 80 ? `${text.slice(0, 77)}…` : text;
    }
    return String(value);
  };

  const label = (key: string) =>
    t.has(`fields.${key}`) ? t(`fields.${key}`) : key;

  const created = before === null;
  const deleted = after === null;

  return (
    <ul className="space-y-1">
      {keys.map((key) => (
        <li key={key} className="break-words">
          <span className="text-muted">{label(key)}: </span>
          {created ? (
            <bdi>{show(now[key])}</bdi>
          ) : deleted ? (
            <del className="text-muted">
              <bdi>{show(old[key])}</bdi>
            </del>
          ) : (
            <>
              <del className="text-muted">
                <bdi>{show(old[key])}</bdi>
              </del>
              <span
                className="mx-1 inline-block text-muted rtl:rotate-180"
                aria-hidden
              >
                →
              </span>
              <bdi className="font-medium">{show(now[key])}</bdi>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
