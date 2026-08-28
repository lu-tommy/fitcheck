import { computeStats } from '@/domain/stats';
import type { Outfit, WearLog } from '@/types';

import { makeItem } from './factories';

const closet = [
  makeItem({ id: 'a', category: 'tshirt', primaryColor: 'white', wearCount: 10, purchasePrice: 20 }),
  makeItem({ id: 'b', category: 'tshirt', primaryColor: 'white', wearCount: 0, purchasePrice: 200 }),
  makeItem({ id: 'c', category: 'jeans', primaryColor: 'denim', wearCount: 5, favorite: true }),
  makeItem({ id: 'd', category: 'boots', primaryColor: 'brown', wearCount: 0, laundry: 'dirty' }),
];

const outfits: Outfit[] = [
  {
    id: 'o1',
    name: 'Weekend',
    itemIds: ['a', 'c'],
    favorite: false,
    source: 'manual',
    timesWorn: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const wearLogs: WearLog[] = [
  { id: 'w1', outfitId: 'o1', itemIds: ['a', 'c'], date: '2026-02-01', createdAt: '' },
  { id: 'w2', outfitId: 'o1', itemIds: ['a'], date: '2026-02-01', createdAt: '' },
  { id: 'w3', outfitId: 'o1', itemIds: ['c'], date: '2026-02-02', createdAt: '' },
];

describe('computeStats', () => {
  const stats = computeStats(closet, outfits, wearLogs);

  it('totals items, outfits and wears', () => {
    expect(stats.totalItems).toBe(4);
    expect(stats.totalOutfits).toBe(1);
    expect(stats.totalWears).toBe(15);
  });

  it('averages wears per piece', () => {
    expect(stats.averageWears).toBeCloseTo(3.75);
  });

  it('finds the pieces that have never been worn', () => {
    expect(stats.neverWorn.map((item) => item.id).sort()).toEqual(['b', 'd']);
  });

  it('ranks most and least worn', () => {
    expect(stats.mostWorn[0].id).toBe('a');
    expect(stats.leastWorn[0].wearCount).toBe(0);
  });

  it('groups colours by frequency', () => {
    expect(stats.colorShares[0]).toMatchObject({ color: 'white', count: 2 });
    expect(stats.colorShares[0].share).toBeCloseTo(0.5);
  });

  it('groups categories into slots', () => {
    const tops = stats.slotShares.find((entry) => entry.slot === 'top');
    expect(tops?.count).toBe(2);
  });

  it('counts favourites and clean pieces', () => {
    expect(stats.favoriteCount).toBe(1);
    expect(stats.cleanCount).toBe(3);
  });

  it('ranks cost per wear cheapest first and treats zero wears as one', () => {
    expect(stats.costPerWear.map((entry) => entry.item.id)).toEqual(['a', 'b']);
    expect(stats.costPerWear[0].costPerWear).toBeCloseTo(2);
    expect(stats.costPerWear[1].costPerWear).toBeCloseTo(200);
  });

  it('finds the busiest day', () => {
    expect(stats.busiestDay).toEqual({ date: '2026-02-01', count: 2 });
  });

  it('handles an empty wardrobe without dividing by zero', () => {
    const empty = computeStats([], [], []);
    expect(empty.averageWears).toBe(0);
    expect(empty.busiestDay).toBeNull();
  });
});
