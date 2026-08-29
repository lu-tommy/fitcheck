import { buildOutfitLocally } from '@/domain/outfitEngine';
import { slotOf, MAX_ACCESSORIES } from '@/domain/taxonomy';
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

  it('prefers the less-worn of two equivalent pieces', () => {
    const closet = [
      makeItem({ id: 'worn', category: 'tshirt', wearCount: 40 }),
      makeItem({ id: 'fresh', category: 'tshirt', wearCount: 0 }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'sneakers', category: 'sneakers' }),
    ];
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(20) });
    expect(outfit.itemIds).toContain('fresh');
    expect(outfit.itemIds).not.toContain('worn');
  });

  // Three is the stylists' number, and one per position — see MAX_ACCESSORIES
  // and accessories.test.ts, which covers the positional rule in full.
  it('keeps accessories to a sensible number', () => {
    const closet = [
      ...basicCloset(),
      makeItem({ id: 'belt', category: 'belt' }),
      makeItem({ id: 'necklace', category: 'necklace' }),
      makeItem({ id: 'sunglasses', category: 'sunglasses' }),
      makeItem({ id: 'ring', category: 'ring' }),
    ];
    const outfit = buildOutfitLocally({ request: emptyRequest, closet, weather: weather(20) });
    const accessories = slotsOf(outfit.itemIds, closet).filter((slot) => slot === 'accessory');
    expect(accessories.length).toBeLessThanOrEqual(MAX_ACCESSORIES);
  });
});
