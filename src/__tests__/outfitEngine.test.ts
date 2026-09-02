import { buildOutfitLocally } from '@/domain/outfitEngine';
import {
  ACCESSORY_FOCAL_BUDGET,
  accessoryFocalWeight,
  slotOf,
} from '@/domain/taxonomy';
import type { ClothingItem, WeatherSnapshot } from '@/types';

import { basicCloset, emptyRequest, makeItem } from './factories';

function slotsOf(itemIds: string[], closet: ClothingItem[]) {
  const index = new Map(closet.map((item) => [item.id, item]));
  return itemIds.map((id) => slotOf(index.get(id)!.category));
}

function weather(temperature: number): WeatherSnapshot {
  return {
    temperature,
    feelsLike: temperature,
    high: temperature + 2,
    low: temperature - 2,
    code: 0,
    condition: 'Clear',
    precipitationChance: 0,
    windSpeed: 5,
    units: 'metric',
    locationLabel: 'Test',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('buildOutfitLocally', () => {
  it('produces a wearable outfit: something on top, bottom and feet', () => {
    const closet = basicCloset();
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(18) });
    const slots = slotsOf(outfit.itemIds, closet);

    expect(slots).toContain('top');
    expect(slots).toContain('bottom');
    expect(slots).toContain('footwear');
    expect(outfit.warnings).toBeUndefined();
  });

  it('never uses two of an exclusive slot', () => {
    const closet = basicCloset();
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(18) });
    const slots = slotsOf(outfit.itemIds, closet);

    for (const slot of ['top', 'bottom', 'footwear', 'outerwear'] as const) {
      expect(slots.filter((entry) => entry === slot).length).toBeLessThanOrEqual(1);
    }
  });

  it('honours an explicit include', () => {
    const closet = basicCloset();
    const outfit = buildOutfitLocally({
      request: { ...emptyRequest, includeItemIds: ['boots'] },
      closet,
      weather: weather(18),
    });
    expect(outfit.itemIds).toContain('boots');
  });

  it('never returns an excluded piece', () => {
    const closet = basicCloset();
    const outfit = buildOutfitLocally({
      request: { ...emptyRequest, excludeItemIds: ['jeans', 'chinos'] },
      closet,
      weather: weather(18),
    });
    expect(outfit.itemIds).not.toContain('jeans');
    expect(outfit.itemIds).not.toContain('chinos');
  });

  it('skips dirty pieces when cleanOnly is set', () => {
    const closet = basicCloset().map((item) =>
      item.id === 'jeans' ? { ...item, laundry: 'dirty' as const } : item,
    );
    const outfit = buildOutfitLocally({
      request: { ...emptyRequest, cleanOnly: true },
      closet,
      weather: weather(18),
    });
    expect(outfit.itemIds).not.toContain('jeans');
  });

  it('layers up when it is cold', () => {
    const closet = basicCloset();
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(-2) });
    const slots = slotsOf(outfit.itemIds, closet);
    expect(slots.some((slot) => slot === 'outerwear' || slot === 'midlayer')).toBe(true);
  });

  it('leaves the heavy coat alone when it is hot', () => {
    const closet = basicCloset();
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(30) });
    expect(outfit.itemIds).not.toContain('coat');
  });

  it('lets a full-body piece stand in for a top and bottom', () => {
    const closet = [
      makeItem({ id: 'dress', category: 'dress', name: 'Black dress', formality: 'formal' }),
      makeItem({ id: 'heels', category: 'dress-shoes', name: 'Black heels', formality: 'formal' }),
    ];
    const outfit = buildOutfitLocally({
      request: { ...emptyRequest, includeItemIds: ['dress'] },
      closet,
      weather: weather(20),
    });
    const slots = slotsOf(outfit.itemIds, closet);
    expect(slots).toContain('fullbody');
    expect(slots).not.toContain('bottom');
  });

  it('says what is missing rather than pretending', () => {
    const closet = [makeItem({ id: 'tee', category: 'tshirt' })];
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(20) });
    expect(outfit.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('bottom'), expect.stringContaining('shoes')]),
    );
  });

  it('copes with an empty closet', () => {
    const outfit = buildOutfitLocally({ request: emptyRequest, closet: [], weather: weather(20) });
    expect(outfit.itemIds).toEqual([]);
  });

  /*
   * This test used to assert the opposite, and it was protecting a bug.
   *
   * Wear count was a straight penalty capped at twelve, so a white tee worn
   * forty-two times and marked a favourite scored -12 +8 = -4 while a purple
   * satin shirt bought once and regretted scored -0.6. The regretted shirt
   * started three and a half points ahead — more than the seasonality bonus,
   * and enough to decide almost every slot. Run over a real forty-piece
   * wardrobe, that one shirt appeared in seven outfits out of ten.
   *
   * An app whose entire promise is "wear what you own" was systematically
   * dressing somebody in the things they had proved they do not wear.
   */
  it('prefers the piece she actually wears, not the one she never does', () => {
    const closet = [
      makeItem({ id: 'loved', category: 'tshirt', wearCount: 40 }),
      makeItem({ id: 'regretted', category: 'tshirt', wearCount: 0 }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'sneakers', category: 'sneakers' }),
    ];
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(20) });
    expect(outfit.itemIds).toContain('loved');
    expect(outfit.itemIds).not.toContain('regretted');
  });

  /*
   * Variety comes from WHEN it was last on, which is a different fact and the
   * one that was missing. Yesterday's shirt is the one thing somebody does not
   * want offered again this morning, and that has nothing to do with whether
   * they like it.
   */
  it('rests what was worn yesterday, however much it is loved', () => {
    const closet = [
      makeItem({
        id: 'yesterday',
        category: 'tshirt',
        wearCount: 40,
        favorite: true,
        lastWornAt: '2026-05-31T18:00:00.000Z',
      }),
      makeItem({ id: 'other', category: 'tshirt', wearCount: 12 }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'sneakers', category: 'sneakers' }),
    ];
    const outfit = buildOutfitLocally({
      request: emptyRequest,
      closet,
      weather: weather(20),
      today: '2026-06-01',
    });
    expect(outfit.itemIds).toContain('other');
    expect(outfit.itemIds).not.toContain('yesterday');
  });

  it('offers it again once it has had a week off', () => {
    const closet = [
      makeItem({
        id: 'loved',
        category: 'tshirt',
        wearCount: 40,
        favorite: true,
        lastWornAt: '2026-05-01T18:00:00.000Z',
      }),
      makeItem({ id: 'other', category: 'tshirt', wearCount: 12 }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'sneakers', category: 'sneakers' }),
    ];
    const outfit = buildOutfitLocally({
      request: emptyRequest,
      closet,
      weather: weather(20),
      today: '2026-06-01',
    });
    expect(outfit.itemIds).toContain('loved');
  });

  /*
   * A wardrobe with one shirt still has to produce a shirt. The penalty is
   * large enough to lose a slot to any fresh alternative and no larger.
   */
  it('still wears the only shirt she owns, even if it was on yesterday', () => {
    const closet = [
      makeItem({ id: 'only', category: 'tshirt', lastWornAt: '2026-05-31T18:00:00.000Z' }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'sneakers', category: 'sneakers' }),
    ];
    const outfit = buildOutfitLocally({
      request: emptyRequest,
      closet,
      weather: weather(20),
      today: '2026-06-01',
    });
    expect(outfit.itemIds).toContain('only');
  });

  // Three focal points, not three objects — see ACCESSORY_FOCAL_WEIGHT, and
  // accessories.test.ts, which covers the positional rule in full.
  it('keeps accessories within the attention an outfit can carry', () => {
    const closet = [
      ...basicCloset(),
      makeItem({ id: 'belt', category: 'belt' }),
      makeItem({ id: 'necklace', category: 'necklace' }),
      makeItem({ id: 'sunglasses', category: 'sunglasses' }),
      makeItem({ id: 'ring', category: 'ring' }),
      makeItem({ id: 'bag', category: 'bag' }),
      makeItem({ id: 'earrings', category: 'earrings' }),
    ];
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(20) });
    const index = new Map(closet.map((item) => [item.id, item]));
    const spent = outfit.itemIds
      .map((id) => index.get(id)!)
      .filter((item) => slotOf(item.category) === 'accessory')
      .reduce((total, item) => total + accessoryFocalWeight(item.category), 0);
    expect(spent).toBeLessThanOrEqual(ACCESSORY_FOCAL_BUDGET);
  });
});
