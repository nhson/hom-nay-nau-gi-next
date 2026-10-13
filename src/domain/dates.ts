/** Local calendar date of `now` as YYYY-MM-DD (device timezone, like the legacy app). */
export function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDay(date: string): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) return Number.NaN;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

/** Whole days from `from` to `to`. NaN when either date is malformed. */
export function daysBetween(from: string, to: string): number {
  return toUtcDay(to) - toUtcDay(from);
}

/** YYYY-MM-DD -> dd/mm. Malformed input is returned unchanged. */
export function formatDayMonth(date: string): string {
  const match = DATE_PATTERN.exec(date);
  return match ? `${match[3]}/${match[2]}` : date;
}
