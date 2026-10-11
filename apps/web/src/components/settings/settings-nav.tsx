import { getTranslations } from 'next-intl/server';

/** The Settings sections, in page order; each id is on its card */
const SECTIONS = [
  ['profile', 'profile.title'],
  ['compliance', 'compliance.title'],
  ['work-week', 'workWeek.title'],
  ['payroll', 'payroll.title'],
  ['check-in', 'checkIn.title'],
  ['job-titles', 'jobTitles.title'],
] as const;

/**
 * Jump links to each Settings section (SCRUM-152). Plain anchors: no JavaScript needed.
 * Stays under the top bar (h-16) while scrolling; on a phone the row scrolls sideways in its own box.
 */
export default async function SettingsNav() {
  const t = await getTranslations('Settings');
  return (
    <nav
      aria-label={t('sections')}
      className="sticky top-16 z-20 -mx-1 overflow-x-auto bg-canvas/90 px-1 py-2 backdrop-blur"
    >
      <ul className="flex gap-2">
        {SECTIONS.map(([id, key]) => (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-[13px] whitespace-nowrap hover:border-accent hover:text-accent-fg"
            >
              {t(key)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
