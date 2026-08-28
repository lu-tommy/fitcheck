import {
  applyFilters,
  availableBrands,
  availableColors,
  countActiveFilters,
  EMPTY_FILTERS,
} from '@/domain/filters';

import { makeItem } from './factories';

const closet = [
  makeItem({
    id: 'a',
    category: 'tshirt',
    name: 'White tee',
    primaryColor: 'white',
    brand: 'Uniqlo',
    wearCount: 10,
    favorite: true,
    createdAt: '2026-01-03T00:00:00.000Z',
  }),
  makeItem({
    id: 'b',
    category: 'jeans',
    name: 'Indigo jeans',
    primaryColor: 'denim',
    brand: "Levi's",
    wearCount: 2,
    laundry: 'dirty',
    createdAt: '2026-01-02T00:00:00.000Z',
  }),
  makeItem({
    id: 'c',
    category: 'boots',
    name: 'Brown boots',
    primaryColor: 'brown',
    wearCount: 5,
    seasons: ['fall', 'winter'],
    styles: ['outdoor'],
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
];

describe('applyFilters', () => {
  it('returns everything by default, newest first', () => {
    const result = applyFilters(closet, EMPTY_FILTERS);
    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('searches name, brand and colour', () => {
    expect(applyFilters(closet, { ...EMPTY_FILTERS, query: 'levi' }).map((i) => i.id)).toEqual(['b']);
    expect(applyFilters(closet, { ...EMPTY_FILTERS, query: 'brown' }).map((i) => i.id)).toEqual(['c']);
    expect(applyFilters(closet, { ...EMPTY_FILTERS, query: 'tee' }).map((i) => i.id)).toEqual(['a']);
  });

  it('requires every search term to match', () => {
    expect(applyFilters(closet, { ...EMPTY_FILTERS, query: 'white tee' })).toHaveLength(1);
    expect(applyFilters(closet, { ...EMPTY_FILTERS, query: 'white boots' })).toHaveLength(0);
  });

  it('filters by slot', () => {
    expect(applyFilters(closet, { ...EMPTY_FILTERS, slots: ['footwear'] }).map((i) => i.id)).toEqual([
      'c',
    ]);
  });

  it('filters by favourites and cleanliness', () => {
    expect(applyFilters(closet, { ...EMPTY_FILTERS, favoritesOnly: true }).map((i) => i.id)).toEqual([
      'a',
    ]);
    expect(applyFilters(closet, { ...EMPTY_FILTERS, cleanOnly: true }).map((i) => i.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('filters by season and style', () => {
    expect(applyFilters(closet, { ...EMPTY_FILTERS, seasons: ['winter'] }).map((i) => i.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(applyFilters(closet, { ...EMPTY_FILTERS, styles: ['outdoor'] }).map((i) => i.id)).toEqual([
      'c',
    ]);
  });

  it('combines filters as AND', () => {
    const result = applyFilters(closet, {
      ...EMPTY_FILTERS,
      cleanOnly: true,
      slots: ['top'],
    });
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('sorts by wear count in both directions', () => {
    expect(applyFilters(closet, { ...EMPTY_FILTERS, sort: 'most-worn' })[0].id).toBe('a');
    expect(applyFilters(closet, { ...EMPTY_FILTERS, sort: 'least-worn' })[0].id).toBe('b');
  });
});

describe('countActiveFilters', () => {
  it('counts nothing when untouched', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('ignores the free-text query, which has its own affordance', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, query: 'blue' })).toBe(0);
  });

  it('adds up the rest', () => {
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        slots: ['top'],
        colors: ['white'],
        favoritesOnly: true,
      }),
    ).toBe(3);
  });
});

describe('facets', () => {
  it('lists colours most common first', () => {
    expect(availableColors(closet)[0]).toBe('white');
  });

  it('lists brands alphabetically, ignoring items without one', () => {
    expect(availableBrands(closet)).toEqual(["Levi's", 'Uniqlo']);
  });
});
