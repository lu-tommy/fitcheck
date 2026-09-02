import { describe, expect, it } from 'vitest';

import { MIN_WAYS, tenWays } from '@/domain/tenWays';
import type { ClothingItem } from '@/types';

import { makeItem } from './factories';

/**
 * One garment, worn ten ways.
 *
 * The whole difficulty is that ten builds of a deterministic engine give ten of
 * the same outfit, so most of these tests are about whether the looks are
 * actually DIFFERENT — and about the two ways that can go wrong: repeating
 * itself, or quietly dropping the garment the screen is about.
 */

const hero = () =>
  makeItem({ id: 'hero', category: 'sweater', name: 'Oatmeal knit', primaryColor: 'beige' });

function wardrobe(extra: ClothingItem[] = []): ClothingItem[] {
  return [
    hero(),
    makeItem({ id: 'tee', category: 'tshirt', name: 'White tee', primaryColor: 'white' }),
    makeItem({ id: 'shirt', category: 'shirt', name: 'Oxford shirt', primaryColor: 'light blue' }),
    makeItem({ id: 'tank', category: 'tank', name: 'Black tank', primaryColor: 'black' }),
    makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans', primaryColor: 'denim' }),
    makeItem({ id: 'chinos', category: 'chinos', name: 'Stone chinos', primaryColor: 'tan' }),
    makeItem({ id: 'trousers', category: 'dress-pants', name: 'Charcoal trousers', primaryColor: 'charcoal', formality: 'formal' }),
    makeItem({ id: 'shorts', category: 'shorts', name: 'Navy shorts', primaryColor: 'navy' }),
    makeItem({ id: 'sneakers', category: 'sneakers', name: 'White sneakers', primaryColor: 'white' }),
    makeItem({ id: 'boots', category: 'boots', name: 'Brown boots', primaryColor: 'brown' }),
    makeItem({ id: 'derbies', category: 'dress-shoes', name: 'Black derbies', primaryColor: 'black', formality: 'formal' }),
    makeItem({ id: 'coat', category: 'coat', name: 'Charcoal coat', primaryColor: 'charcoal' }),
    makeItem({ id: 'jacket', category: 'jacket', name: 'Olive jacket', primaryColor: 'olive' }),
    ...extra,
  ];
}

describe('tenWays', () => {
  it('always keeps the garment the screen is about', () => {
    const ways = tenWays(hero(), wardrobe());
    expect(ways.length).toBeGreaterThan(MIN_WAYS);
    ways.forEach((way) => expect(way.itemIds).toContain('hero'));
  });

  /*
   * The failure the whole design is arranged against: a deterministic engine
   * asked the same question ten times answers it the same way ten times.
   */
  it('does not repeat itself', () => {
    const ways = tenWays(hero(), wardrobe());
    const keys = ways.map((way) => way.itemIds.slice().sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reaches for something else each time rather than the same favourite', () => {
    const ways = tenWays(hero(), wardrobe());
    const bottoms = ways
      .map((way) => way.itemIds.find((id) => ['jeans', 'chinos', 'trousers', 'shorts'].includes(id)))
      .filter(Boolean);
    // Not one pair of trousers over and over.
    expect(new Set(bottoms).size).toBeGreaterThan(1);
  });

  it('says what each look is for, and what is carrying it', () => {
    const ways = tenWays(hero(), wardrobe());
    ways.forEach((way) => {
      expect(way.label).toMatch(/\S/);
      expect(way.note).toMatch(/\S/);
      expect(way.verdict).toMatch(/\S/);
      expect(way.score).toBeGreaterThanOrEqual(0);
      expect(way.score).toBeLessThanOrEqual(100);
    });
  });

  it('names the pieces rather than counting them', () => {
    const ways = tenWays(hero(), wardrobe());
    // Every note points at a real garment by name.
    const names = wardrobe().map((item) => item.name.toLowerCase());
    ways.forEach((way) => {
      expect(names.some((name) => way.note.toLowerCase().includes(name))).toBe(true);
    });
  });

  /*
   * A cold day and a warm day are genuinely different outfits, which is the
   * point of asking ten questions rather than shuffling one.
   */
  it('answers a cold day differently from a warm one', () => {
    const ways = tenWays(hero(), wardrobe());
    const cold = ways.find((way) => way.label === 'Cold day');
    const warm = ways.find((way) => way.label === 'Warm day');
    if (cold && warm) {
      expect(cold.itemIds.join()).not.toBe(warm.itemIds.join());
    }
    expect(cold ?? warm).toBeDefined();
  });

  it('runs out gracefully on a wardrobe with nothing to offer', () => {
    const thin = [
      hero(),
      makeItem({ id: 'jeans', category: 'jeans', name: 'Jeans' }),
      makeItem({ id: 'sneakers', category: 'sneakers', name: 'Sneakers' }),
    ];
    const ways = tenWays(hero(), thin);
    // Some looks, no duplicates, and never a crash.
    expect(ways.length).toBeGreaterThan(0);
    const keys = ways.map((way) => way.itemIds.slice().sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('says nothing about a garment that is not in the wardrobe', () => {
    expect(tenWays(makeItem({ id: 'ghost', category: 'sweater' }), wardrobe())).toEqual([]);
  });

  it('leaves archived pieces out of every look', () => {
    const closet = wardrobe().map((item) =>
      item.id === 'jeans' ? { ...item, archived: true } : item,
    );
    const ways = tenWays(hero(), closet);
    ways.forEach((way) => expect(way.itemIds).not.toContain('jeans'));
  });

  it('does not care what is in the wash', () => {
    const dirty = wardrobe().map((item) =>
      item.id === 'hero' ? item : { ...item, laundry: 'dirty' as const },
    );
    // How a garment CAN be worn has nothing to do with this week's laundry.
    expect(tenWays(hero(), dirty).length).toBeGreaterThan(MIN_WAYS);
  });

  it('can be asked for fewer', () => {
    expect(tenWays(hero(), wardrobe(), 3).length).toBeLessThanOrEqual(3);
  });
});
