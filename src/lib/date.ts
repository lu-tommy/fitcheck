import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Calendar keys are local-date strings so a day never shifts across timezones. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatFriendlyDate(key: string): string {
  const date = fromDateKey(key);
  const diff = differenceInCalendarDays(date, new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(date, 'EEEE');
  return format(date, 'EEE d MMM');
}

export function formatRelative(iso?: string): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  const days = differenceInCalendarDays(new Date(), date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  return format(date, 'MMM yyyy');
}

/** Six-week grid covering the given month, Monday-first. */
export function monthGrid(monthDate: Date): Date[] {
  const first = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function currentSeason(date = new Date()): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = date.getMonth();
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'fall';
}

export { addDays, differenceInCalendarDays, format, isSameDay, startOfMonth };
