import { describe, expect, it } from 'vitest';

import { scoreOutfit } from '@/domain/fitScore';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import { readWardrobeReport } from '@/domain/wardrobeReport';
import { tenWays } from '@/domain/tenWays';
import { readShapeGaps } from '@/domain/wardrobeGaps';
import { readTaste } from '@/domain/taste';
import { readIntent } from '@/domain/intent';
import { CATEGORIES, slotOf } from '@/domain/taxonomy';
import type { ClothingItem, OutfitRequest } from '@/types';

import { makeItem } from './factories';

/**
 * The wardrobes nobody designs for.
 *
 * Everything so far has been tested against closets that make sense: a good
 * spread of formality, a few of each thing, sensible data. Real ones are not
 * like that. They have a thousand items or four, three identical black tees, a
 * garment whose name is empty because a photo import failed, a price of NaN
 * from a paste that went wrong, and nothing at all that suits a wedding.
 *
 * None of that should produce a crash, and — more importantly — none of it
 * should produce a confident wrong answer, which is the failure people actually
 * notice.
 */

const request: OutfitRequest = {
  prompt: 'Something for today',
  includeItemIds: [],
  excludeItemIds: [],
  cleanOnly: false,
};

const dress = (closet: ClothingItem[], over: Partial<OutfitRequest> = {}) =>
  buildOutfitLocally({ request: { ...request, ...over }, closet, today: '2026-06-01' });

/* ------------------------------------------------------------ degenerate -- */

describe('data that should never have got in, and did', () => {
  it('survives a garment with nothing filled in', () => {
    const broken: ClothingItem = {
      ...makeItem({ category: 'tshirt' }),
      id: 'broken',
      name: '',
      primaryColor: '',
      primaryColorHex: '',
      secondaryColors: [],
      seasons: [],
      styles: [],
    };
    const closet = [broken, makeItem({ category: 'jeans' }), makeItem({ category: 'sneakers' })];
    expect(() => dress(closet)).not.toThrow();
    expect(() => scoreOutfit(closet)).not.toThrow();
    expect(() => readWardrobeReport(closet)).not.toThrow();
  });

  it('survives numbers that are not numbers', () => {
    const closet = [
      makeItem({ id: 'a', category: 'tshirt', wearCount: Number.NaN }),
      makeItem({ id: 'b', category: 'jeans', wearCount: -40 }),
      makeItem({ id: 'c', category: 'sneakers', wearCount: Number.POSITIVE_INFINITY }),
    ];
    const outfit = dress(closet);
    expect(outfit.itemIds.length).toBeGreaterThan(0);
    // A NaN anywhere in the scorer silently poisons every comparison after it.
    outfit.itemIds.forEach((id) => expect(typeof id).toBe('string'));
    expect(() => readShapeGaps(closet)).not.toThrow();
  });

  it('survives a date that is not a date', () => {
    const closet = [
      makeItem({ id: 'a', category: 'tshirt', lastWornAt: 'not a date' }),
      makeItem({ id: 'b', category: 'jeans', lastWornAt: '' }),
      makeItem({ id: 'c', category: 'sneakers' }),
    ];
    expect(dress(closet).itemIds).toContain('a');
  });

  it('does not wear the same garment twice because it is in the list twice', () => {
    const twin = makeItem({ id: 'twin', category: 'tshirt' });
    const closet = [twin, { ...twin }, makeItem({ category: 'jeans' }), makeItem({ category: 'sneakers' })];
    const outfit = dress(closet);
    expect(new Set(outfit.itemIds).size, 'the same id twice').toBe(outfit.itemIds.length);
  });

  it('copes with a name nobody meant to type', () => {
    const closet = [
      makeItem({ id: 'a', category: 'tshirt', name: '🧥'.repeat(400) }),
      makeItem({ id: 'b', category: 'jeans', name: '   ' }),
      makeItem({ id: 'c', category: 'sneakers' }),
    ];
    const outfit = dress(closet);
    expect(outfit.name.length, 'an outfit named by a runaway string').toBeLessThan(200);
    expect(() => scoreOutfit(closet)).not.toThrow();
  });
});

/* --------------------------------------------------------- contradictions -- */

describe('requests that contradict themselves', () => {
  const closet = [
    makeItem({ id: 'tee', category: 'tshirt' }),
    makeItem({ id: 'jeans', category: 'jeans' }),
    makeItem({ id: 'shoes', category: 'sneakers' }),
  ];

  it('does not wear a garment that is both required and forbidden', () => {
    const outfit = dress(closet, { includeItemIds: ['tee'], excludeItemIds: ['tee'] });
    expect(outfit.itemIds, 'worn and excluded at once').not.toContain('tee');
  });

  it('ignores a required garment that no longer exists', () => {
    expect(() => dress(closet, { includeItemIds: ['deleted'] })).not.toThrow();
    expect(dress(closet, { includeItemIds: ['deleted'] }).itemIds).not.toContain('deleted');
  });

  it('comes back empty and says why when everything is excluded', () => {
    const outfit = dress(closet, { excludeItemIds: ['tee', 'jeans', 'shoes'] });
    expect(outfit.itemIds).toEqual([]);
    expect(outfit.warnings ?? [], 'nothing to wear, and nothing said').not.toEqual([]);
  });
});

/* ------------------------------------------------------------- the sky -- */

describe('temperatures nobody has clothes for', () => {
  const closet = [
    makeItem({ id: 'tee', category: 'tshirt', seasons: ['summer'] }),
    makeItem({ id: 'coat', category: 'parka', seasons: ['winter'] }),
    makeItem({ id: 'jeans', category: 'jeans' }),
    makeItem({ id: 'shoes', category: 'sneakers' }),
  ];

  it('still dresses somebody at minus forty', () => {
    const outfit = dress(closet, { temperature: -40 });
    expect(outfit.itemIds).toContain('coat');
    expect(outfit.itemIds.length).toBeGreaterThan(2);
  });

  it('still dresses somebody at fifty', () => {
    const outfit = dress(closet, { temperature: 50 });
    expect(outfit.itemIds).not.toContain('coat');
    expect(outfit.itemIds.length).toBeGreaterThan(1);
  });
});

/* ------------------------------------------------------------ big closets -- */

describe('a wardrobe far bigger than anybody has', () => {
  const huge: ClothingItem[] = [];
  CATEGORIES.forEach((meta, index) => {
    for (let n = 0; n < 20; n += 1) {
      huge.push(
        makeItem({
          id: `${meta.category}-${n}`,
          category: meta.category,
          name: `${meta.label} ${n}`,
          wearCount: (index * 7 + n) % 40,
        }),
      );
    }
  });

  it('is a thousand pieces', () => {
    expect(huge.length).toBeGreaterThan(1000);
  });

  it('builds an outfit without anybody noticing the wait', () => {
    const started = Date.now();
    const outfit = buildOutfitLocally({ request, closet: huge });
    expect(Date.now() - started, 'slow on a big wardrobe').toBeLessThan(300);
    expect(outfit.itemIds.length).toBeGreaterThan(2);
  });

  it('scores the whole wardrobe without locking the screen', () => {
    const started = Date.now();
    readWardrobeReport(huge);
    expect(Date.now() - started, 'the stats screen would hang').toBeLessThan(2500);
  });

  it('builds ten ways without locking the screen', () => {
    const started = Date.now();
    tenWays(huge[0], huge);
    expect(Date.now() - started, 'the ways screen would hang').toBeLessThan(1500);
  });

  it('reads the shape queue without locking the screen', () => {
    const started = Date.now();
    readShapeGaps(huge);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('reads taste from a long history without locking the screen', () => {
    const signals = huge.slice(0, 400).map((item, index) => ({
      id: `s${index}`,
      itemId: item.id,
      kind: 'chosen' as const,
      date: '2026-05-01',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }));
    const started = Date.now();
    readTaste(signals, huge, [], '2026-06-01');
    expect(Date.now() - started).toBeLessThan(500);
  });
});

/* ------------------------------------------------------- lopsided closets -- */

describe('closets that are all one thing', () => {
  it('does not pretend a wardrobe of hats is an outfit', () => {
    const hats = Array.from({ length: 10 }, (_, n) =>
      makeItem({ id: `hat-${n}`, category: 'hat', name: `Hat ${n}` }),
    );
    const outfit = dress(hats);
    expect(outfit.warnings ?? [], 'ten hats and no comment').not.toEqual([]);
  });

  it('wears one of ten identical tees, not several', () => {
    const closet = [
      ...Array.from({ length: 10 }, (_, n) =>
        makeItem({ id: `tee-${n}`, category: 'tshirt', name: 'Black tee' }),
      ),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'shoes', category: 'sneakers' }),
    ];
    const outfit = dress(closet);
    const tops = outfit.itemIds.filter((id) => id.startsWith('tee-'));
    expect(tops).toHaveLength(1);
  });
});

/**
 * The thing a wardrobe app is uniquely placed to know, and was refusing to say.
 *
 * Asked to dress for a wedding out of a casual wardrobe, it produced a white
 * t-shirt with charcoal dress trousers and trainers, scored it 48 out of 100,
 * called it "something in here is fighting" — and presented it as the answer,
 * with the real problem in a warning underneath. It did the same for a job
 * interview and for a funeral, and gave all three the identical outfit.
 *
 * An engine that only uses what you own has to be willing to say you do not own
 * something. Otherwise the promise quietly becomes "wear the wrong thing".
 */
describe('when the wardrobe genuinely cannot do it', () => {
  const casualOnly: ClothingItem[] = [
    makeItem({ id: 'tank', category: 'tank', name: 'Black tank top', formality: 'very-casual', wearCount: 20 }),
    makeItem({ id: 'tee', category: 'tshirt', name: 'White tee', formality: 'casual', wearCount: 30 }),
    makeItem({ id: 'hoodie', category: 'hoodie', name: 'Grey hoodie', formality: 'very-casual', wearCount: 25 }),
    makeItem({ id: 'trousers', category: 'dress-pants', name: 'Charcoal dress trousers', formality: 'formal', wearCount: 2 }),
    makeItem({ id: 'jeans', category: 'jeans', name: 'Blue jeans', formality: 'casual', wearCount: 40 }),
    makeItem({ id: 'trainers', category: 'sneakers', name: 'White trainers', formality: 'casual', wearCount: 50 }),
  ];

  const forWedding = () =>
    buildOutfitLocally({
      request: {
        ...request,
        occasion: 'a wedding',
        formality: 'formal',
        cleanOnly: true,
      },
      closet: casualOnly,
      preferCategories: ['shirt', 'blouse', 'dress-pants', 'loafers', 'dress-shoes'],
    });

  it('refuses to put a t-shirt and trainers on somebody for a wedding', () => {
    const worn = forWedding().itemIds;
    expect(worn, 'a t-shirt at a wedding').not.toContain('tee');
    expect(worn, 'a tank top at a wedding').not.toContain('tank');
    expect(worn, 'trainers at a wedding').not.toContain('trainers');
  });

  it('still wears what does work', () => {
    expect(forWedding().itemIds, 'threw the good trousers out too').toContain('trousers');
  });

  it('names what is missing, and what would fill it', () => {
    const missing = forWedding().missing ?? [];
    expect(missing.map((entry) => entry.slot).sort()).toEqual(['footwear', 'top']);

    const top = missing.find((entry) => entry.slot === 'top')!;
    expect(top.categories).toContain('shirt');
    expect(top.suggestion, 'no shopping list').toMatch(/shirt/i);
    expect(top.because, 'does not say what came closest').toContain('white tee');
  });

  it('writes it in English rather than in category labels', () => {
    (forWedding().missing ?? []).forEach((entry) => {
      // "a shorts or joggers" is what a sentence with an article in it produces
      // when the labels are a mix of singular and plural.
      expect(entry.suggestion).not.toMatch(/\ba (shorts|joggers|trainers|loafers|flats)\b/i);
      expect(entry.suggestion).not.toMatch(/\ba dress shoes\b/i);
    });
  });

  /*
   * Only where an occasion was actually named. Somebody who has not said where
   * they are going is going about their day, and "better the wrong shoes than
   * none" still holds for an ordinary Tuesday.
   */
  it('dresses an ordinary day out of whatever is there, without complaint', () => {
    const outfit = buildOutfitLocally({ request, closet: casualOnly });
    expect(outfit.missing, 'refused to dress somebody who asked for nothing').toBeUndefined();
    expect(outfit.itemIds.length).toBeGreaterThanOrEqual(3);
  });

  it('says what to buy for the gym when there is nothing to run in', () => {
    // The real rule, rather than a hand-written stand-in: what the gym rules
    // out is exactly the thing being tested.
    const gym = readIntent("I'm going to the gym")!;
    const outfit = buildOutfitLocally({
      request: { ...request, occasion: gym.occasion, formality: gym.formality },
      closet: casualOnly,
      preferCategories: gym.prefer,
      avoidCategories: gym.avoid,
    });
    const bottom = (outfit.missing ?? []).find((entry) => entry.slot === 'bottom');
    expect(bottom, 'wore dress trousers to the gym').toBeDefined();
    expect(bottom!.categories).toContain('joggers');
  });

  it('never declines a piece the wearer asked for by name', () => {
    const outfit = buildOutfitLocally({
      request: {
        ...request,
        occasion: 'a wedding',
        formality: 'formal',
        includeItemIds: ['tee'],
      },
      closet: casualOnly,
    });
    expect(outfit.itemIds, 'overruled a deliberate choice').toContain('tee');
  });
});
