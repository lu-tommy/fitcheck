import { describe, expect, it } from 'vitest';

import { readIntent } from '@/domain/intent';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import { CATEGORIES, slotOf } from '@/domain/taxonomy';
import { demoWardrobe } from '@/domain/seed';
import type { ClothingItem, WeatherSnapshot } from '@/types';

import { REAL_WARDROBE } from './fixtures/realWardrobe';

/**
 * Finding the holes, rather than checking the parts that were built on purpose.
 *
 * The outfit audit reads ten scenarios and asks whether they look right. That
 * catches bad answers and is blind to missing questions — a category nothing
 * can ever pick, a sentence nobody parsed, a kind of weather the engine has
 * never heard of. Those do not fail a test; they simply never come up.
 *
 * So this walks the whole surface instead: every category the app offers, every
 * occasion a person might type, every kind of day the sky can produce. It is
 * written to FAIL where there is a hole, so that the holes are in the report
 * rather than in somebody's morning.
 */

function weather(temperature: number, over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    temperature,
    feelsLike: temperature,
    high: temperature + 2,
    low: temperature - 3,
    code: 1,
    condition: 'Clear',
    precipitationChance: 5,
    windSpeed: 8,
    units: 'metric',
    locationLabel: 'Home',
    fetchedAt: '2026-06-01T08:00:00.000Z',
    ...over,
  };
}

/* ------------------------------------------------------ category coverage -- */

describe('every category the app offers', () => {
  /*
   * A category somebody can file a garment under and that no screen ever draws
   * is a promise the app does not keep: the piece goes in, and comes back as a
   * grey block for ever.
   */
  it('has a silhouette to draw when there is no photograph', async () => {
    const { demoPhoto } = await import('@/lib/demoImages');
    // demoPhoto needs a DOM; what is testable here is that the SHAPE table
    // covers every category, which is the part that goes stale.
    expect(typeof demoPhoto).toBe('function');

    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile('src/lib/demoImages.ts', 'utf8'),
    );
    const table = source.slice(source.indexOf('const SHAPE_OF'), source.indexOf('/** What gets drawn'));
    const missing = CATEGORIES.filter((meta) => {
      const key = /^[a-z]+$/.test(meta.category) ? meta.category : `'${meta.category}'`;
      return !table.includes(`${key}:`);
    });
    expect(missing.map((m) => m.category), 'categories with no silhouette').toEqual([]);
  });

  /*
   * The demo wardrobe is the first thing a new user sees, and it is also the
   * only place every drawing is exercised. A category it never includes is a
   * drawing nobody has ever looked at.
   */
  it('is exercised by the demo wardrobe, or is knowingly left out', () => {
    const demo = new Set(demoWardrobe().map((item) => item.category));
    const missing = CATEGORIES.map((meta) => meta.category)
      // "Other" is the box for a thing the list has no word for. A demo piece
      // filed under it would be teaching the wrong lesson.
      .filter((c) => c !== 'other')
      .filter((c) => !demo.has(c));
    expect(missing, 'categories never drawn in the demo').toEqual([]);
  });

  /*
   * Every slot the engine can fill has to be fillable. A category whose slot no
   * outfit ever reaches is a garment somebody can add and never see again.
   */
  it('can actually be chosen for an outfit', () => {
    const unreachable: string[] = [];

    CATEGORIES.forEach((meta) => {
      const closet: ClothingItem[] = [
        ...REAL_WARDROBE,
        {
          ...REAL_WARDROBE[0],
          id: 'probe',
          name: 'Probe piece',
          category: meta.category,
          favorite: true,
          wearCount: 200,
        },
      ];
      const built = buildOutfitLocally({
        request: {
          prompt: 'x',
          includeItemIds: ['probe'],
          excludeItemIds: [],
          cleanOnly: false,
        },
        closet,
        weather: weather(12),
      });
      if (!built.itemIds.includes('probe')) unreachable.push(meta.category);
    });

    expect(unreachable, 'categories that cannot be worn even when forced').toEqual([]);
  });
});

/* ------------------------------------------------------ occasion coverage -- */

/**
 * The sentences a person actually types.
 *
 * Drawn from what these apps' own occasion pickers offer and from the days
 * people plan clothes around — not from what the parser happens to know, which
 * would make this test agree with itself.
 */
const THINGS_PEOPLE_DO = [
  "I'm going to work",
  'I have a job interview',
  "I'm going to the gym",
  "I'm going for a run",
  'I have a date tonight',
  'Dinner out with friends',
  "I'm going to a wedding",
  "I'm going to a funeral",
  "I'm going to a christening",
  "I'm going to a graduation",
  "I'm going to a party",
  "I'm going to a concert",
  "I'm going to a festival",
  "I'm going to the beach",
  "I'm going hiking",
  "I'm travelling today",
  "I'm going to school",
  "I'm going to church",
  "I'm staying home today",
  'Brunch with friends',
  'Running errands',
  "I'm doing the school run",
  'I have a big presentation',
  "I'm going to the pub",
  'Going out out',
  "I'm meeting the in-laws",
  "I'm going to a barbecue",
  "I'm going to the theatre",
  "I'm going to a client meeting",
  "I'm going to a baby shower",
];

describe('the sentences a person actually types', () => {
  it('reads every one of them', () => {
    const unread = THINGS_PEOPLE_DO.filter((line) => readIntent(line) === null);
    expect(unread, 'sentences the parser cannot read').toEqual([]);
  });

  it('does not read two different days as the same occasion', () => {
    const funeral = readIntent("I'm going to a funeral");
    const wedding = readIntent("I'm going to a wedding");
    expect(funeral, 'a funeral is not read at all').not.toBeNull();
    // Both are formal and they are not the same day.
    expect(funeral?.occasion, 'a funeral reads as a wedding').not.toBe(wedding?.occasion);
  });

  it('knows the gym is not a run', () => {
    const gym = readIntent("I'm going to the gym");
    expect(gym).not.toBeNull();
    expect(gym?.avoid ?? [], 'nothing is ruled out for the gym').not.toEqual([]);
  });
});

/* ------------------------------------------------------- weather coverage -- */

describe('the kinds of day the sky produces', () => {
  const dry = () => weather(12, { code: 1, condition: 'Clear', precipitationChance: 0 });
  const pouring = () =>
    weather(12, { code: 65, condition: 'Heavy rain', precipitationChance: 95 });

  const dress = (snapshot: WeatherSnapshot) =>
    buildOutfitLocally({
      request: {
        prompt: 'Something for today',
        includeItemIds: [],
        excludeItemIds: [],
        cleanOnly: false,
      },
      closet: RAIN_WARDROBE,
      weather: snapshot,
      today: '2026-06-01',
    });

  /*
   * The single most-asked question a wardrobe app answers is "what do I wear
   * today", and on a great many days the honest answer starts with "it is going
   * to rain". The forecast is fetched, stored, and shown on the home screen —
   * and the outfit engine reads exactly one field of it.
   */
  it('dresses differently when it is pouring', () => {
    const before = dress(dry()).itemIds.join(',');
    const after = dress(pouring()).itemIds.join(',');
    expect(after, 'the same outfit for a downpour as for a clear day').not.toBe(before);
  });

  it('reaches for the waterproof rather than the suede', () => {
    const wet = dress(pouring()).itemIds;
    expect(wet, 'no raincoat in the rain').toContain('raincoat');
    expect(wet, 'suede boots in a downpour').not.toContain('suede');
  });

  it('takes the umbrella', () => {
    expect(dress(pouring()).itemIds, 'no umbrella at 95% rain').toContain('umbrella');
  });

  it('leaves the umbrella at home when it is dry', () => {
    expect(dress(dry()).itemIds, 'an umbrella on a clear day').not.toContain('umbrella');
  });
});

/** A wardrobe with a real answer to rain in it, so the test is about the engine. */
const RAIN_WARDROBE: ClothingItem[] = [
  ...REAL_WARDROBE.filter((item) =>
    ['w1', 'w17', 'w18', 'w28', 'w29'].includes(item.id),
  ),
  { ...REAL_WARDROBE[0], id: 'raincoat', name: 'Yellow raincoat', category: 'raincoat', primaryColor: 'yellow', wearCount: 9 },
  { ...REAL_WARDROBE[0], id: 'suede', name: 'Brown suede boots', category: 'boots', material: 'Suede', primaryColor: 'brown', wearCount: 20 },
  { ...REAL_WARDROBE[0], id: 'wellies', name: 'Rain boots', category: 'rain-boots', primaryColor: 'green', wearCount: 5 },
  { ...REAL_WARDROBE[0], id: 'umbrella', name: 'Black umbrella', category: 'umbrella', primaryColor: 'black', wearCount: 12 },
];

/* --------------------------------------------------------- whole wardrobes -- */

describe('wardrobes that are not hers', () => {
  const dressFor = (closet: ClothingItem[], prompt: string, temperature = 16) => {
    const intent = readIntent(prompt);
    return buildOutfitLocally({
      request: {
        prompt,
        occasion: intent?.occasion,
        formality: intent?.formality,
        includeItemIds: [],
        excludeItemIds: [],
        cleanOnly: false,
      },
      closet,
      weather: weather(temperature),
      preferCategories: intent?.prefer,
      avoidCategories: intent?.avoid,
      preferredStyles: intent?.styles,
      today: '2026-06-01',
    });
  };

  /*
   * Somebody whose whole wardrobe is athletic. The engine must not be quietly
   * assuming a shirt-and-trousers wardrobe exists underneath every request.
   */
  const ATHLETIC: ClothingItem[] = [
    { ...REAL_WARDROBE[0], id: 'a1', name: 'Training tee', category: 'tshirt', formality: 'very-casual', styles: ['athletic'] },
    { ...REAL_WARDROBE[0], id: 'a2', name: 'Leggings', category: 'leggings', formality: 'very-casual', styles: ['athletic'] },
    { ...REAL_WARDROBE[0], id: 'a3', name: 'Running shoes', category: 'sneakers', formality: 'very-casual', styles: ['athletic'] },
    { ...REAL_WARDROBE[0], id: 'a4', name: 'Zip hoodie', category: 'hoodie', formality: 'very-casual', styles: ['athletic'] },
  ];

  it('dresses somebody who owns nothing but gym clothes', () => {
    const outfit = dressFor(ATHLETIC, "I'm going to the gym");
    const slots = new Set(outfit.itemIds.map((id) => {
      const item = ATHLETIC.find((entry) => entry.id === id)!;
      return slotOf(item.category);
    }));
    expect(slots.has('top') && slots.has('bottom') && slots.has('footwear')).toBe(true);
  });

  it('says so rather than improvising when asked for a wedding it cannot dress', () => {
    const outfit = dressFor(ATHLETIC, "I'm going to a wedding");
    expect(outfit.warnings ?? [], 'no warning that the wardrobe cannot do it').not.toEqual([]);
  });
});

describe('what it calls the day back to you', () => {
  /*
   * One rule serves several days that dress identically, and the label still
   * has to be the one the person used. Being told the app has built you "a run
   * look" when you typed "the gym" is a small thing that reads as not having
   * been listened to.
   */
  it('calls it what you called it', () => {
    expect(readIntent("I'm going to the gym")?.occasion).toBe('the gym');
    expect(readIntent("I'm going for a run")?.occasion).toBe('a run');
    expect(readIntent('I have a yoga class')?.occasion).toBe('yoga');
    expect(readIntent("I'm going to a funeral")?.occasion).toBe('a funeral');
  });

  it('does not dress somebody for the gym to run errands', () => {
    expect(readIntent('Running errands')?.occasion).not.toBe('a run');
    expect(readIntent("I'm doing the school run")?.occasion).not.toBe('a run');
  });

  it('asks for black at a funeral, and nowhere else', () => {
    expect(readIntent("I'm going to a funeral")?.colorPreference).toBe('black');
    expect(readIntent("I'm going to a wedding")?.colorPreference).toBeUndefined();
  });
});
