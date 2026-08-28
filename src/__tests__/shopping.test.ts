import { assessPurchase, weakestSlots, type Candidate } from '@/domain/shopping';
import { hexForColorName } from '@/domain/color';
import type { ClothingItem } from '@/types';

import { makeItem } from './factories';

const candidate = (overrides: Partial<Candidate> & { category: Candidate['category'] }): Candidate => ({
  name: 'New thing',
  primaryColor: 'navy',
  primaryColorHex: hexForColorName(overrides.primaryColor ?? 'navy'),
  ...overrides,
});

/** A closet with tops, bottoms and shoes, so an outfit can actually complete. */
function workingCloset(): ClothingItem[] {
  return [
    makeItem({ id: 'tee', category: 'tshirt', name: 'White tee', primaryColor: 'white' }),
    makeItem({ id: 'shirt', category: 'shirt', name: 'Blue shirt', primaryColor: 'light blue' }),
    makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans', primaryColor: 'denim' }),
    makeItem({ id: 'chinos', category: 'chinos', name: 'Stone chinos', primaryColor: 'tan' }),
    makeItem({ id: 'sneakers', category: 'sneakers', name: 'White sneakers', primaryColor: 'white' }),
    makeItem({ id: 'boots', category: 'boots', name: 'Brown boots', primaryColor: 'brown' }),
  ];
}

describe('assessPurchase', () => {
  it('counts the outfits a new piece would complete', () => {
    const verdict = assessPurchase(candidate({ category: 'sweater', primaryColor: 'navy' }), workingCloset());
    expect(verdict.outfitsUnlocked).toBeGreaterThan(0);
    expect(verdict.detail).toMatch(/completes \d+/);
  });

  it('says so when nothing in the closet can finish the outfit', () => {
    // A top, with no bottoms and no shoes to go with it.
    const verdict = assessPurchase(
      candidate({ category: 'tshirt', primaryColor: 'red' }),
      [makeItem({ id: 'other-tee', category: 'tshirt' })],
    );
    expect(verdict.outfitsUnlocked).toBe(0);
    expect(verdict.headline).toBe('Nothing you own works with it');
  });

  it('spots something she already owns', () => {
    const closet = [
      ...workingCloset(),
      makeItem({ id: 'have-it', category: 'sweater', name: 'Navy jumper', primaryColor: 'navy' }),
    ];
    const verdict = assessPurchase(candidate({ category: 'sweater', primaryColor: 'navy' }), closet);
    expect(verdict.duplicates.map((item) => item.id)).toEqual(['have-it']);
    expect(verdict.headline).toBe('You already own this');
    expect(verdict.detail).toMatch(/already have navy jumper/i);
  });

  it('ranks pairings by how well the colours actually sit together', () => {
    const verdict = assessPurchase(candidate({ category: 'sweater', primaryColor: 'navy' }), workingCloset());
    expect(verdict.pairings.length).toBeGreaterThan(0);
    const scores = verdict.pairings.map((pairing) => pairing.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('never pairs a piece with something in its own slot', () => {
    const verdict = assessPurchase(candidate({ category: 'jeans', primaryColor: 'black' }), workingCloset());
    expect(verdict.pairings.map((pairing) => pairing.item.id)).not.toContain('chinos');
  });

  it('penalises a formality mismatch even when the colours work', () => {
    const closet = [
      ...workingCloset(),
      makeItem({ id: 'gym', category: 'joggers', name: 'Grey joggers', primaryColor: 'grey', formality: 'very-casual' }),
      makeItem({ id: 'dress-trousers', category: 'dress-pants', name: 'Grey trousers', primaryColor: 'grey', formality: 'formal' }),
    ];
    const verdict = assessPurchase(
      candidate({ category: 'blazer', primaryColor: 'grey', formality: 'formal' }),
      closet,
    );
    const score = (id: string) => verdict.pairings.find((p) => p.item.id === id)?.score ?? 0;
    expect(score('dress-trousers')).toBeGreaterThan(score('gym'));
  });

  it('rates a versatile neutral above a loud duplicate', () => {
    const closet = workingCloset();
    const neutral = assessPurchase(candidate({ category: 'sweater', primaryColor: 'grey' }), closet);
    const clashing = assessPurchase(
      candidate({ category: 'sweater', primaryColor: 'orange' }),
      closet,
    );
    expect(neutral.score).toBeGreaterThan(clashing.score);
  });

  it('estimates cost per wear when a price is given', () => {
    const verdict = assessPurchase(
      candidate({ category: 'coat', primaryColor: 'charcoal', price: 260 }),
      workingCloset(),
    );
    expect(verdict.costPerWearEstimate).toBeCloseTo(5, 0);
  });

  it('leaves cost per wear out when there is no price', () => {
    expect(assessPurchase(candidate({ category: 'coat' }), workingCloset()).costPerWearEstimate)
      .toBeUndefined();
  });

  it('ignores archived clothes', () => {
    const closet = [
      ...workingCloset(),
      makeItem({ id: 'gone', category: 'sweater', primaryColor: 'navy', archived: true }),
    ];
    expect(assessPurchase(candidate({ category: 'sweater', primaryColor: 'navy' }), closet).duplicates)
      .toEqual([]);
  });

  it('explains a pairing using the garment’s own colour name', () => {
    const closet = [
      ...workingCloset(),
      makeItem({ id: 'olive', category: 'jacket', name: 'Olive jacket', primaryColor: 'olive' }),
    ];
    const verdict = assessPurchase(candidate({ category: 'sweater', primaryColor: 'navy' }), closet);
    const olive = verdict.pairings.find((pairing) => pairing.item.id === 'olive');
    expect(olive?.why).toMatch(/olive/i);
    // The hue analyser calls olive "yellow"; useless to somebody holding it.
    expect(olive?.why).not.toMatch(/yellow/i);
  });

  it('separates pairings instead of scoring everything the same', () => {
    const closet = [
      makeItem({ id: 'loved', category: 'jeans', name: 'Everyday jeans', primaryColor: 'denim', wearCount: 40, favorite: true }),
      makeItem({ id: 'ignored', category: 'chinos', name: 'Unworn chinos', primaryColor: 'tan', wearCount: 0, seasons: ['summer'] }),
      makeItem({ id: 'shoes', category: 'sneakers', primaryColor: 'white' }),
    ];
    const verdict = assessPurchase(
      candidate({ category: 'sweater', primaryColor: 'navy', seasons: ['fall', 'winter'] }),
      closet,
    );
    const score = (id: string) => verdict.pairings.find((p) => p.item.id === id)?.score ?? 0;
    // What she actually wears should outrank what sits in the drawer.
    expect(score('loved')).toBeGreaterThan(score('ignored'));
    const spread = Math.max(...verdict.pairings.map((p) => p.score)) -
      Math.min(...verdict.pairings.map((p) => p.score));
    expect(spread).toBeGreaterThan(10);
  });

  it('copes with an empty closet without throwing', () => {
    const verdict = assessPurchase(candidate({ category: 'tshirt' }), []);
    expect(verdict.outfitsUnlocked).toBe(0);
    expect(verdict.pairings).toEqual([]);
  });
});

describe('weakestSlots', () => {
  it('names the thinnest part of the wardrobe first', () => {
    const closet = [
      makeItem({ id: 't1', category: 'tshirt' }),
      makeItem({ id: 't2', category: 'tshirt' }),
      makeItem({ id: 't3', category: 'polo' }),
      makeItem({ id: 'b1', category: 'jeans' }),
      makeItem({ id: 's1', category: 'sneakers' }),
    ];
    const weakest = weakestSlots(closet);
    expect(weakest[0].count).toBe(0);
    expect(weakest.find((entry) => entry.slot === 'top')?.count).toBe(3);
  });
});
