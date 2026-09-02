import { describe, expect, it } from 'vitest';

import { readStreak, shift } from '@/domain/streak';
import type { WearLog } from '@/types';

/**
 * A run of days logged.
 *
 * The mechanic is easy to point at the wrong behaviour: a streak counting NEW
 * outfits teaches somebody that repeating a jumper is a failure, which is the
 * exact pressure this app exists to remove. So the load-bearing test here is
 * the one proving a week of identical clothes still counts.
 */

const TODAY = '2026-09-02';

const logs = (...dates: string[]): WearLog[] =>
  dates.map((date, index) => ({
    id: `log-${index}`,
    itemIds: ['a'],
    date,
    createdAt: `${date}T09:00:00.000Z`,
    updatedAt: `${date}T09:00:00.000Z`,
  }));

describe('shift', () => {
  it('moves whole days, and over month and year ends', () => {
    expect(shift('2026-09-02', -1)).toBe('2026-09-01');
    expect(shift('2026-09-01', -1)).toBe('2026-08-31');
    expect(shift('2026-01-01', -1)).toBe('2025-12-31');
    expect(shift('2026-02-28', 1)).toBe('2026-03-01');
  });

  /*
   * Built at noon rather than midnight. A midnight date shifted across a
   * negative offset lands on the previous day, which would turn a streak into
   * a lottery decided by where somebody happened to be standing.
   */
  it('does not slip a day, whatever the clock is doing', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 400; i += 1) key = shift(key, 1);
    expect(key).toBe('2027-02-05');
  });
});

describe('readStreak', () => {
  it('counts nothing when nothing has been logged', () => {
    const streak = readStreak([], TODAY);
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(0);
    expect(streak.loggedToday).toBe(false);
    expect(streak.note).toContain('one tap');
  });

  it('counts a run that ends today', () => {
    const streak = readStreak(logs('2026-08-31', '2026-09-01', TODAY), TODAY);
    expect(streak.current).toBe(3);
    expect(streak.loggedToday).toBe(true);
  });

  /*
   * Opening the app at breakfast must not show a streak that has just been
   * broken by not having got dressed yet.
   */
  it('leaves the run alive on the morning after its last entry', () => {
    const streak = readStreak(logs('2026-08-31', '2026-09-01'), TODAY);
    expect(streak.current).toBe(2);
    expect(streak.loggedToday).toBe(false);
    expect(streak.note).toContain('keeps it');
  });

  it('breaks it once a whole day has actually been missed', () => {
    // Nothing on the 1st, so the run ended on 31 August.
    const streak = readStreak(logs('2026-08-30', '2026-08-31'), TODAY);
    expect(streak.current).toBe(0);
  });

  /*
   * The one that matters. A week of the same jeans is a perfect streak, and
   * the copy says so out loud on the screen most likely to suggest otherwise.
   */
  it('counts a week of identical clothes as a perfect run', () => {
    const week = ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', TODAY];
    const sameJeans: WearLog[] = week.map((date, index) => ({
      id: `log-${index}`,
      itemIds: ['jeans', 'tee', 'sneakers'],
      date,
      createdAt: `${date}T09:00:00.000Z`,
      updatedAt: `${date}T09:00:00.000Z`,
    }));
    const streak = readStreak(sameJeans, TODAY);
    expect(streak.current).toBe(7);
    expect(streak.note).toContain('same jeans counts');
  });

  it('remembers the best run even when the current one has gone', () => {
    const streak = readStreak(
      logs('2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-20'),
      TODAY,
    );
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(4);
  });

  /*
   * Five days out of seven is a good week and a broken streak. A screen that
   * only knows how to say the second thing is lying by omission.
   */
  it('reports the week alongside the run', () => {
    const streak = readStreak(
      logs('2026-08-27', '2026-08-29', '2026-08-30', '2026-09-01', TODAY),
      TODAY,
    );
    // Five of the last seven days, and a run of two. Both are true, and only
    // one of them is the streak.
    expect(streak.thisWeek).toBe(5);
    expect(streak.current).toBe(2);
  });

  it('is not confused by two logs on the same day', () => {
    const streak = readStreak(logs('2026-09-01', TODAY, TODAY), TODAY);
    expect(streak.current).toBe(2);
    expect(streak.thisWeek).toBe(2);
  });

  it('ignores anything logged in the future', () => {
    const streak = readStreak(logs('2026-09-05', TODAY), TODAY);
    expect(streak.current).toBe(1);
    expect(streak.thisWeek).toBe(1);
  });

  it('never says anything that treats repeating as a lapse', () => {
    const cases = [
      readStreak([], TODAY),
      readStreak(logs(TODAY), TODAY),
      readStreak(logs('2026-09-01'), TODAY),
      readStreak(logs('2026-08-31', '2026-09-01', TODAY), TODAY),
    ];
    cases.forEach((streak) => {
      expect(streak.note).not.toMatch(/new|different|fresh|again\b/i);
    });
  });
});
