import { describe, expect, it } from 'vitest';

import { readWardrobeReport } from '@/domain/wardrobeReport';
import type { ClothingItem } from '@/types';

import { makeItem } from './factories';

/**
 * Dressing the wardrobe against itself.
 *
 * The Fit Score answers "is this outfit good". This answers "why is getting
 * dressed hard on Tuesdays", which is a fact about the wardrobe rather than
 * about a morning — and the only one of the two somebody can act on when they
 * are next in a shop.
 */

/** Enough of a wardrobe to be dressed several different ways. */
function wardrobe(extra: ClothingItem[] = []): ClothingItem[] {
  return [
    makeItem({ id: 'white-tee', category: 'tshirt', name: 'White tee', primaryColor: 'white', wearCount: 20 }),
    makeItem({ id: 'navy-shirt', category: 'shirt', name: 'Navy shirt', primaryColor: 'navy', wearCount: 12 }),
    makeItem({ id: 'grey-knit', category: 'tshirt', name: 'Grey tee', primaryColor: 'grey', wearCount: 8 }),
    makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans', primaryColor: 'denim', wearCount: 25 }),
    makeItem({ id: 'chinos', category: 'chinos', name: 'Stone chinos', primaryColor: 'tan', wearCount: 10 }),
    makeItem({ id: 'black-jeans', category: 'jeans', name: 'Black jeans', primaryColor: 'black', wearCount: 6 }),
    makeItem({ id: 'sneakers', category: 'sneakers', name: 'White sneakers', primaryColor: 'white', wearCount: 30 }),
    makeItem({ id: 'boots', category: 'boots', name: 'Brown boots', primaryColor: 'brown', wearCount: 9 }),
    ...extra,
  ];
}

describe('readWardrobeReport', () => {
  it('scores the wardrobe by dressing it against itself', () => {
    const report = readWardrobeReport(wardrobe());
    expect(report.samples).toBeGreaterThan(5);
    expect(report.average).toBeGreaterThan(0);
    expect(report.average).toBeLessThanOrEqual(100);
    expect(report.note).toBeUndefined();
  });

  it('says so rather than inventing a verdict from three garments', () => {
    const thin = readWardrobeReport([
      makeItem({ id: 'a', category: 'tshirt' }),
      makeItem({ id: 'b', category: 'sneakers' }),
    ]);
    expect(thin.samples).toBe(0);
    expect(thin.note).toMatch(/\S/);
    expect(thin.lifting).toEqual([]);
    expect(thin.harder).toEqual([]);
  });

  it('ignores what has been archived, because it is out of circulation', () => {
    const archived = wardrobe().map((item) =>
      item.id === 'jeans' ? { ...item, archived: true } : item,
    );
    const report = readWardrobeReport(archived);
    const named = [...report.lifting, ...report.harder].map((entry) => entry.itemId);
    expect(named).not.toContain('jeans');
    report.best.forEach((pair) => expect(pair.itemIds).not.toContain('jeans'));
  });

  /*
   * The garment everybody owns and nobody can place: dressed several steps
   * above everything it could be worn with. It scores low wherever it lands,
   * and it lands low for a reason that is about the wardrobe rather than about
   * the trousers, which is exactly the reading this exists to give.
   *
   * A LOUD piece was the obvious candidate and is the wrong one — one saturated
   * garment in a wardrobe of neutrals is the 60-30-10 anchor working, and the
   * score correctly rewards it. Being colourful is not the same as being hard
   * to place, and a report that conflated them would send people to archive the
   * only interesting thing they own.
   */
  const orphan = () =>
    makeItem({
      id: 'formal',
      category: 'dress-pants',
      name: 'Tuxedo trousers',
      primaryColor: 'black',
      formality: 'black-tie',
      wearCount: 14,
    });

  it('finds the piece that is harder to place than the rest', () => {
    const report = readWardrobeReport(wardrobe([orphan()]));
    expect(report.harder.map((entry) => entry.itemId)).toContain('formal');
  });

  it('does not mistake a colourful piece for a difficult one', () => {
    const loud = makeItem({
      id: 'loud',
      category: 'chinos',
      name: 'Orange trousers',
      primaryColor: 'orange',
      wearCount: 14,
    });
    const report = readWardrobeReport(wardrobe([loud]));
    // One accent against neutrals is good styling, and the score says so.
    expect(report.harder.map((entry) => entry.itemId)).not.toContain('loud');
  });

  it('never calls a garment bad, and says what keeps happening around it', () => {
    const report = readWardrobeReport(wardrobe([orphan()]));
    const standing = report.harder.find((entry) => entry.itemId === 'formal');

    expect(standing).toBeDefined();
    expect(standing!.commonReason).toBe(
      'usually because it is dressier or plainer than what it goes with',
    );
    // The reading blames what is around it, which is also the accurate one.
    expect(standing!.commonReason).toMatch(/^usually because/);
  });

  it('carries the count, so a number is never mistaken for a verdict', () => {
    const report = readWardrobeReport(wardrobe());
    [...report.lifting, ...report.harder].forEach((entry) => {
      expect(entry.appearances).toBeGreaterThanOrEqual(3);
    });
  });

  it('splits standings honestly around the wardrobe average', () => {
    const report = readWardrobeReport(wardrobe());
    report.lifting.forEach((entry) => expect(entry.delta).toBeGreaterThan(0));
    report.harder.forEach((entry) => expect(entry.delta).toBeLessThan(0));
  });

  it('returns the best pairings, best first, as real pieces', () => {
    const report = readWardrobeReport(wardrobe());
    const ids = new Set(wardrobe().map((item) => item.id));
    expect(report.best.length).toBeGreaterThan(0);
    report.best.forEach((pair) => {
      pair.itemIds.forEach((id) => expect(ids.has(id)).toBe(true));
    });
    const scores = report.best.map((pair) => pair.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('dresses a dress on its own rather than hunting for a bottom', () => {
    const report = readWardrobeReport(
      wardrobe([
        makeItem({ id: 'dress', category: 'dress', name: 'Black dress', primaryColor: 'black', wearCount: 15 }),
      ]),
    );
    const appeared = [...report.lifting, ...report.harder].map((entry) => entry.itemId);
    // It took part — which it could not have done if a dress needed trousers.
    expect(report.samples).toBeGreaterThan(9);
    expect(appeared.length).toBeGreaterThan(0);
  });

  /*
   * The pairing is quadratic, so the cap is what keeps a real wardrobe from
   * becoming ten thousand outfit builds. Worth a test: it is the kind of limit
   * that gets raised later by somebody who has not noticed the shape of it.
   */
  it('stays cheap on a wardrobe far larger than the cap', () => {
    const many: ClothingItem[] = [];
    for (let i = 0; i < 60; i += 1) {
      many.push(makeItem({ id: `top-${i}`, category: 'tshirt', name: `Tee ${i}`, wearCount: i }));
      many.push(makeItem({ id: `bottom-${i}`, category: 'jeans', name: `Jeans ${i}`, wearCount: i }));
    }
    many.push(makeItem({ id: 'shoes', category: 'sneakers', name: 'Sneakers' }));

    const started = Date.now();
    const report = readWardrobeReport(many);
    expect(Date.now() - started).toBeLessThan(2000);
    // 12 x 12, not 60 x 60.
    expect(report.samples).toBeLessThanOrEqual(144);
  });
});
