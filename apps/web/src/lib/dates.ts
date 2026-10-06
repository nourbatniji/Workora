/** Date from an ISO day like "2026-10-04", read at noon so no time zone shifts it a day */
export function dayDate(iso: string) {
  return new Date(`${iso}T12:00:00`);
}
