import { describe, expect, it } from 'vitest';

import { pinIsUsable, pinMatches } from '@/domain/ootd';

import { makeItem } from './factories';

/**
 * The home screen rebuilt its suggestion whenever its inputs moved, and the
 * weather is one of those inputs — so an outfit could quietly become a
 * different outfit between breakfast and the front door. Fine for a
 * suggestion; wrong for a thing with a name on it.
 */

const today = '2026-09-02';
const closet = [
  makeItem({ id: 'top', category: 'tshirt' }),
  makeItem({ id: 'bottom', category: 'jeans' }),
  makeItem({ id: 'shoes', category: 'sneakers' }),
];

describe('pinIsUsable', () => {
  it('holds a pick made today out of things that are still clean', () => {
    expect(pinIsUsable({ date: today, itemIds: ['top', 'bottom'] }, today, closet)).toBe(true);
  });

  it('drops yesterday', () => {
    expect(pinIsUsable({ date: '2026-09-01', itemIds: ['top', 'bottom'] }, today, closet)).toBe(false);
  });

  it('drops a pick with nothing written down', () => {
    expect(pinIsUsable(undefined, today, closet)).toBe(false);
    expect(pinIsUsable({ date: today, itemIds: [] }, today, closet)).toBe(false);
  });

  /*
   * A pin goes stale in more ways than by being yesterday's. Half an outfit is
   * worse than a fresh one, so any missing piece drops the lot.
   */
  it('drops a pick whose pieces have been archived, deleted or thrown in the wash', () => {
    expect(pinIsUsable({ date: today, itemIds: ['top', 'gone'] }, today, closet)).toBe(false);

    const inTheWash = closet.filter((item) => item.id !== 'bottom');
    expect(pinIsUsable({ date: today, itemIds: ['top', 'bottom'] }, today, inTheWash)).toBe(false);
  });
});

describe('pinMatches', () => {
  it('is true only for the same pieces in the same order, today', () => {
    const pin = { date: today, itemIds: ['top', 'bottom'] };
    expect(pinMatches(pin, today, ['top', 'bottom'])).toBe(true);
    expect(pinMatches(pin, today, ['bottom', 'top'])).toBe(false);
    expect(pinMatches(pin, today, ['top'])).toBe(false);
    expect(pinMatches(pin, '2026-09-03', ['top', 'bottom'])).toBe(false);
    expect(pinMatches(undefined, today, ['top', 'bottom'])).toBe(false);
  });
});
