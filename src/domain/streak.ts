import type { WearLog } from '@/types';

/**
 * A run of days logged.
 *
 * Streaks are the cheapest retention mechanic there is and the easiest one to
 * point at the wrong behaviour. A streak that counts *new outfits* teaches
 * somebody that repeating a jumper is a failure — which is precisely the
 * pressure this app exists to remove, and it would be doing it in the name of
 * engagement. That version is not built here and should not be later.
 *
 * What is counted is **logging**, which is a different thing entirely. It costs
 * one tap, it can be satisfied by wearing exactly what you wore yesterday, and
 * every log feeds the wear history, the cost per wear, the memories and the
 * taste model. Rewarding it is rewarding the thing that makes the rest of the
 * app work.
 *
 * Two kindnesses in the arithmetic, both deliberate:
 *
 * - **Today is not yet a failure.** A run stays alive until the day after a
 *   missed one, so opening the app at breakfast never shows a streak that has
 *   just been broken by not having got dressed yet.
 * - **The week is reported alongside the run.** Five days out of seven is a
 *   good week and a broken streak, and a screen that only knows how to say the
 *   second thing is lying by omission.
 */

export interface Streak {
  /** Consecutive days with a log, counting back from today or yesterday. */
  current: number;
  longest: number;
  /** Whether today already has one, which changes what there is to say. */
  loggedToday: boolean;
  /** Days logged out of the last seven — the gentler measure. */
  thisWeek: number;
  /** One line, in the app's own voice. */
  note: string;
}

export function readStreak(wearLogs: WearLog[], today: string): Streak {
  const days = new Set(wearLogs.map((log) => log.date));

  const loggedToday = days.has(today);
  // The grace day: a run is still alive on the morning of the day after its
  // last entry, because not having got dressed yet is not a lapse.
  const from = loggedToday ? today : shift(today, -1);

  let current = 0;
  let cursor = from;
  while (days.has(cursor)) {
    current += 1;
    cursor = shift(cursor, -1);
  }

  let thisWeek = 0;
  for (let back = 0; back < 7; back += 1) {
    if (days.has(shift(today, -back))) thisWeek += 1;
  }

  return {
    current,
    longest: longestRun(days),
    loggedToday,
    thisWeek,
    note: describe(current, loggedToday, thisWeek),
  };
}

/**
 * What to say about it.
 *
 * Never anything that implies wearing the same thing twice is a lapse. The line
 * about the jeans is load-bearing: it is the one place the app states outright
 * that repeating is allowed, on the screen most likely to suggest otherwise.
 */
function describe(current: number, loggedToday: boolean, thisWeek: number): string {
  if (current === 0) {
    return 'Log what you wore and the count starts. It takes one tap.';
  }
  if (!loggedToday) {
    return current === 1
      ? 'Logged yesterday. Today keeps it going.'
      : `${current} days in a row. Logging today keeps it.`;
  }
  if (current === 1) {
    return thisWeek > 1
      ? `Logged today, and ${thisWeek} days this week.`
      : 'Logged today. That is the whole streak so far.';
  }
  return `${current} days logged in a row. Wearing the same jeans counts — that is rather the point.`;
}

/** The best run there has ever been, so a broken one is not the only number. */
function longestRun(days: Set<string>): number {
  let longest = 0;
  days.forEach((day) => {
    // Only start counting from the beginning of a run, so each is walked once.
    if (days.has(shift(day, -1))) return;
    let run = 0;
    let cursor = day;
    while (days.has(cursor)) {
      run += 1;
      cursor = shift(cursor, 1);
    }
    longest = Math.max(longest, run);
  });
  return longest;
}

/**
 * Move a YYYY-MM-DD key by whole days.
 *
 * Built at noon rather than midnight. A date built at midnight and shifted can
 * land on the previous day the moment a timezone with a negative offset is
 * involved, which turns a streak into a lottery decided by where somebody is
 * standing.
 */
export function shift(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1, 12);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
