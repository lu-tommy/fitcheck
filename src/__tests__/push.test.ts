import { isDue, localNow, type StoredSubscription } from '@/server/push';

/**
 * Reminder timing.
 *
 * The scheduler runs on a NAS whose clock is UTC while the people using it are
 * not, so "half past seven" has to mean their half past seven. These pin the
 * two rules that make that work: the window, and once per day.
 */

const at = (hour: number, minute: number, overrides: Partial<StoredSubscription> = {}) =>
  ({
    subscription: { endpoint: 'https://example.test/x' },
    timeZone: 'UTC',
    hour,
    minute,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as StoredSubscription;

describe('localNow', () => {
  it('reads the clock in the reader’s zone, not the server’s', () => {
    const utc = localNow('UTC');
    const tokyo = localNow('Asia/Tokyo');
    // Tokyo is nine hours ahead; the hours must differ unless one has wrapped.
    const gap = (tokyo.hour - utc.hour + 24) % 24;
    expect(gap).toBe(9);
  });

  it('falls back rather than throwing on a nonsense zone', () => {
    const now = localNow('Not/AZone');
    expect(now.hour).toBeGreaterThanOrEqual(0);
    expect(now.hour).toBeLessThan(24);
    expect(now.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isDue', () => {
  const now = localNow('UTC');

  it('fires inside the window', () => {
    expect(isDue(at(now.hour, now.minute))).toBe(true);
  });

  it('does not fire before the time', () => {
    const later = (now.hour + 2) % 24;
    expect(isDue(at(later, now.minute))).toBe(false);
  });

  it('does not fire long after the time', () => {
    // Ten minutes ago is outside the five-minute window.
    const total = now.hour * 60 + now.minute - 10;
    const wrapped = (total + 1440) % 1440;
    expect(isDue(at(Math.floor(wrapped / 60), wrapped % 60))).toBe(false);
  });

  it('only fires once a day', () => {
    const entry = at(now.hour, now.minute, { lastSentOn: now.date });
    expect(isDue(entry)).toBe(false);
  });

  it('fires again the next day', () => {
    const entry = at(now.hour, now.minute, { lastSentOn: '2020-01-01' });
    expect(isDue(entry)).toBe(true);
  });
});
