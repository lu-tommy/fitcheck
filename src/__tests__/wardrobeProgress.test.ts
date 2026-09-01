import { describe, expect, it } from 'vitest';

import {
  combinations,
  countBySlot,
  EMPTY_COUNTS,
  nextBestSlot,
  progressLine,
} from '@/domain/wardrobeProgress';

describe('what the next photograph is worth', () => {
  it('counts nothing for an empty wardrobe', () => {
    expect(combinations(EMPTY_COUNTS)).toBe(0);
    expect(progressLine(EMPTY_COUNTS)).toBe('');
  });

  it('multiplies tops by bottoms', () => {
    expect(combinations({ ...EMPTY_COUNTS, top: 3, bottom: 4 })).toBe(12);
  });

  it('lets shoes multiply rather than gate, so a shoeless closet is not zero', () => {
    expect(combinations({ ...EMPTY_COUNTS, top: 2, bottom: 2 })).toBe(4);
    expect(combinations({ ...EMPTY_COUNTS, top: 2, bottom: 2, footwear: 3 })).toBe(12);
  });

  it('counts a one-piece as its own combination', () => {
    expect(combinations({ ...EMPTY_COUNTS, fullbody: 2 })).toBe(2);
    expect(combinations({ ...EMPTY_COUNTS, top: 1, bottom: 1, fullbody: 2 })).toBe(3);
  });

  it('points at the slot that unlocks the most', () => {
    // five tops and no bottoms: one pair of trousers is worth five combinations.
    const best = nextBestSlot({ ...EMPTY_COUNTS, top: 5 })!;
    expect(best.slot).toBe('bottom');
    expect(best.gain).toBe(5);
  });

  it('prefers the scarcer side once both exist', () => {
    const best = nextBestSlot({ ...EMPTY_COUNTS, top: 6, bottom: 2 })!;
    expect(best.slot).toBe('bottom'); // +6 beats +2
    expect(best.gain).toBe(6);
  });

  it('tells someone with only jumpers what to do next, without scolding', () => {
    const line = progressLine({ ...EMPTY_COUNTS, top: 4 });
    expect(line).toContain('4 pieces');
    expect(line).toMatch(/add a bottom/);
    expect(line).not.toMatch(/!|great|well done|congrat/i);
  });

  it('reads as a plain count once things combine', () => {
    expect(progressLine({ ...EMPTY_COUNTS, top: 3, bottom: 2, footwear: 2 })).toBe(
      '7 pieces · 12 combinations',
    );
  });

  it('says combinations, never promises good outfits', () => {
    expect(progressLine({ ...EMPTY_COUNTS, top: 2, bottom: 1 })).not.toMatch(/outfit/i);
  });

  it('buckets real categories into slots', () => {
    const c = countBySlot(['tshirt', 'jeans', 'sneakers', 'dress', 'watch']);
    expect(c.top).toBe(1);
    expect(c.bottom).toBe(1);
    expect(c.footwear).toBe(1);
    expect(c.fullbody).toBe(1);
    expect(c.accessory).toBe(1);
  });
});
