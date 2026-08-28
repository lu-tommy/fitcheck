import type { ClothingItem, Season, Slot, Style } from '@/types';

import { categoryLabel, slotOf } from './taxonomy';

export type ClosetSort = 'recent' | 'most-worn' | 'least-worn' | 'name';

export interface ClosetFilters {
  query: string;
  slots: Slot[];
  colors: string[];
  seasons: Season[];
  styles: Style[];
  brands: string[];
  favoritesOnly: boolean;
  cleanOnly: boolean;
  sort: ClosetSort;
}

export const EMPTY_FILTERS: ClosetFilters = {
  query: '',
  slots: [],
  colors: [],
  seasons: [],
  styles: [],
  brands: [],
  favoritesOnly: false,
  cleanOnly: false,
  sort: 'recent',
};

export function countActiveFilters(filters: ClosetFilters): number {
  return (
    filters.slots.length +
    filters.colors.length +
    filters.seasons.length +
    filters.styles.length +
    filters.brands.length +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.cleanOnly ? 1 : 0)
  );
}

function matchesQuery(item: ClothingItem, query: string): boolean {
  const haystack = [
    item.name,
    item.brand,
    item.primaryColor,
    item.material,
    categoryLabel(item.category),
    ...item.secondaryColors,
    ...item.styles,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function applyFilters(items: ClothingItem[], filters: ClosetFilters): ClothingItem[] {
  const filtered = items.filter((item) => {
    if (filters.query && !matchesQuery(item, filters.query)) return false;
    if (filters.slots.length && !filters.slots.includes(slotOf(item.category))) return false;
    if (
      filters.colors.length &&
      !filters.colors.some(
        (color) =>
          item.primaryColor.toLowerCase() === color.toLowerCase() ||
          item.secondaryColors.some((secondary) => secondary.toLowerCase() === color.toLowerCase()),
      )
    ) {
      return false;
    }
    if (filters.seasons.length && !filters.seasons.some((season) => item.seasons.includes(season))) {
      return false;
    }
    if (filters.styles.length && !filters.styles.some((style) => item.styles.includes(style))) {
      return false;
    }
    if (filters.brands.length && (!item.brand || !filters.brands.includes(item.brand))) return false;
    if (filters.favoritesOnly && !item.favorite) return false;
    if (filters.cleanOnly && item.laundry !== 'clean') return false;
    return true;
  });

  return sortItems(filtered, filters.sort);
}

export function sortItems(items: ClothingItem[], sort: ClosetSort): ClothingItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'most-worn':
      return sorted.sort((a, b) => b.wearCount - a.wearCount);
    case 'least-worn':
      return sorted.sort((a, b) => a.wearCount - b.wearCount);
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'recent':
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/** Distinct colour names present in the closet, most common first. */
export function availableColors(items: ClothingItem[]): string[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = item.primaryColor.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color);
}

export function availableBrands(items: ClothingItem[]): string[] {
  const brands = new Set<string>();
  items.forEach((item) => {
    if (item.brand) brands.add(item.brand);
  });
  return [...brands].sort((a, b) => a.localeCompare(b));
}
