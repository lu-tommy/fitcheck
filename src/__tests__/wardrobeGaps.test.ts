import { describe, expect, it } from 'vitest';

import {
  gapWeight,
  missingFields,
  readShapeGaps,
  shapeProgress,
} from '@/domain/wardrobeGaps';

import { makeItem } from './factories';

/**
 * The to-do list the Fit Score wrote for itself.
 *
 * A rule that reports what it is missing and then offers no route to supplying
 * it is worse than one that stayed quiet: it turns every outfit into a reminder
 * of a chore with no beginning. These tests are mostly about the ORDER, because
 * a queue that asks about a scarf worn once before the jeans somebody lives in
 * is a queue nobody finishes.
 */

describe('missingFields', () => {
  it('asks a garment only what it can answer', () => {
    expect(missingFields(makeItem({ category: 'jeans' })).sort()).toEqual(['fit', 'rise']);
    expect(missingFields(makeItem({ category: 'tshirt' })).sort()).toEqual(['fit', 'length']);
    // A pair of sunglasses is never asked how it is cut.
    expect(missingFields(makeItem({ category: 'sunglasses' }))).toEqual([]);
    expect(missingFields(makeItem({ category: 'sneakers' }))).toEqual([]);
  });

  it('asks about a print only when there is one', () => {
    expect(missingFields(makeItem({ category: 'sneakers', pattern: 'solid' }))).toEqual([]);
    expect(missingFields(makeItem({ category: 'sneakers', pattern: 'camo' }))).toEqual([
      'patternScale',
    ]);
  });

  it('stops asking once it has been told', () => {
    const answered = makeItem({
      category: 'jeans',
      fit: 'relaxed',
      rise: 'high',
    });
    expect(missingFields(answered)).toEqual([]);
  });
});

describe('the order of the queue', () => {
  it('asks about the jeans you live in before the scarf you wore once', () => {
    const items = [
      makeItem({ id: 'scarf', category: 'scarf', name: 'Scarf', pattern: 'plaid', wearCount: 1 }),
      makeItem({ id: 'jeans', category: 'jeans', name: 'Jeans', wearCount: 40 }),
    ];
    expect(readShapeGaps(items).queue[0].item.id).toBe('jeans');
  });

  it('puts the pieces that set the proportions above the ones that do not', () => {
    // Same wear count, so only what the garment does for an outfit separates them.
    const top = makeItem({ id: 'top', category: 'tshirt', wearCount: 5 });
    const bag = makeItem({ id: 'bag', category: 'bag', pattern: 'floral', wearCount: 5 });
    expect(gapWeight(top)).toBeGreaterThan(gapWeight(bag));
    expect(readShapeGaps([bag, top]).queue[0].item.id).toBe('top');
  });

  it('counts a favourite for a little more', () => {
    const plain = makeItem({ id: 'a', category: 'tshirt', wearCount: 5 });
    const loved = makeItem({ id: 'b', category: 'tshirt', wearCount: 5, favorite: true });
    expect(gapWeight(loved)).toBeGreaterThan(gapWeight(plain));
  });

  /*
   * Logarithmic on purpose. A piece worn forty times should outrank one worn
   * four, without burying everything else in the wardrobe beneath it.
   */
  it('does not let one much-worn garment bury the rest', () => {
    const often = gapWeight(makeItem({ category: 'tshirt', wearCount: 200 }));
    const rarely = gapWeight(makeItem({ category: 'tshirt', wearCount: 2 }));
    expect(often).toBeGreaterThan(rarely);
    expect(often / rarely).toBeLessThan(5);
  });

  it('leaves out anything already answered, and anything archived', () => {
    const items = [
      makeItem({ id: 'done', category: 'tshirt', fit: 'regular', length: 'regular' }),
      makeItem({ id: 'gone', category: 'jeans', archived: true }),
      makeItem({ id: 'open', category: 'chinos' }),
    ];
    expect(readShapeGaps(items).queue.map((entry) => entry.item.id)).toEqual(['open']);
  });

  it('is empty, and says so, once everything has answered', () => {
    const report = readShapeGaps([
      makeItem({ category: 'tshirt', fit: 'relaxed', length: 'cropped' }),
      makeItem({ category: 'jeans', fit: 'fitted', rise: 'high' }),
    ]);
    expect(report.queue).toEqual([]);
    expect(report.headline).toContain('Nothing is holding the score back');
  });
});

describe('coverage', () => {
  it('reports a question nobody can answer as settled, not as zero', () => {
    // A wardrobe of shoes is never asked about rise, so there is nothing to nag.
    const report = readShapeGaps([makeItem({ category: 'sneakers' })]);
    const rise = report.coverage.find((entry) => entry.field === 'rise')!;
    expect(rise.share).toBe(1);
    expect(rise.outstanding).toBe(0);
  });

  it('weights coverage the way the queue is ordered', () => {
    // The much-worn piece answered; the rarely-worn one did not.
    const answered = readShapeGaps([
      makeItem({ category: 'tshirt', wearCount: 50, fit: 'relaxed', length: 'regular' }),
      makeItem({ category: 'polo', wearCount: 1 }),
    ]);
    const other = readShapeGaps([
      makeItem({ category: 'tshirt', wearCount: 50 }),
      makeItem({ category: 'polo', wearCount: 1, fit: 'relaxed', length: 'regular' }),
    ]);
    expect(answered.coverage.find((c) => c.field === 'fit')!.share).toBeGreaterThan(
      other.coverage.find((c) => c.field === 'fit')!.share,
    );
  });

  it('counts what is outstanding in garments, which is what somebody faces', () => {
    const report = readShapeGaps([
      makeItem({ category: 'tshirt' }),
      makeItem({ category: 'polo' }),
      makeItem({ category: 'jeans', fit: 'fitted', rise: 'mid' }),
    ]);
    expect(report.coverage.find((entry) => entry.field === 'fit')!.outstanding).toBe(2);
  });
});

describe('the headline', () => {
  it('counts rather than reaching for an adjective', () => {
    const report = readShapeGaps([
      makeItem({ category: 'tshirt', name: 'Tee' }),
      makeItem({ category: 'jeans', name: 'Jeans' }),
    ]);
    expect(report.headline).toContain('2 garments');
    expect(report.headline).toMatch(/proportion|waistline|pattern/);
  });

  it('reads as a sentence for a wardrobe with one thing left', () => {
    const report = readShapeGaps([
      makeItem({ category: 'tshirt' }),
      makeItem({ category: 'jeans', fit: 'fitted', rise: 'mid' }),
    ]);
    expect(report.headline).toContain('1 garment has');
  });
});

describe('shapeProgress', () => {
  it('runs from nothing answered to everything answered', () => {
    const blank = [makeItem({ category: 'tshirt' }), makeItem({ category: 'jeans' })];
    const full = [
      makeItem({ category: 'tshirt', fit: 'relaxed', length: 'regular' }),
      makeItem({ category: 'jeans', fit: 'fitted', rise: 'high' }),
    ];
    expect(shapeProgress(blank)).toBe(0);
    expect(shapeProgress(full)).toBe(1);
  });

  it('is settled for a wardrobe with nothing to answer', () => {
    expect(shapeProgress([makeItem({ category: 'sneakers' })])).toBe(1);
    expect(shapeProgress([])).toBe(1);
  });

  it('moves further for answering what you actually wear', () => {
    const worn = [
      makeItem({ id: 'a', category: 'tshirt', wearCount: 50, fit: 'relaxed', length: 'regular' }),
      makeItem({ id: 'b', category: 'polo', wearCount: 1 }),
    ];
    const rare = [
      makeItem({ id: 'a', category: 'tshirt', wearCount: 50 }),
      makeItem({ id: 'b', category: 'polo', wearCount: 1, fit: 'relaxed', length: 'regular' }),
    ];
    expect(shapeProgress(worn)).toBeGreaterThan(shapeProgress(rare));
  });
});
