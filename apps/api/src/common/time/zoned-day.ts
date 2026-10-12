// Days in a company's time zone (FR-CS-3). The database stores moments in UTC; people think in
// local days. "2026-10-12" in Cairo starts at 2026-10-11T21:00:00Z (UTC+3), not at midnight UTC.

/** How far a time zone is ahead of UTC at a moment, in milliseconds (Cairo in summer: +3 h) */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The moment a local day starts: startOfDayIn('2026-10-12', 'Africa/Cairo') → 2026-10-11T21:00:00Z */
export function startOfDayIn(day: string, timeZone: string): Date {
  const midnightUtc = Date.parse(`${day}T00:00:00.000Z`);
  // Twice, so a day on which clocks change (summer time) still lands on the right moment
  let start = midnightUtc - offsetMs(new Date(midnightUtc), timeZone);
  start = midnightUtc - offsetMs(new Date(start), timeZone);
  return new Date(start);
}

/** The day after: '2026-10-31' → '2026-11-01' */
export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}
