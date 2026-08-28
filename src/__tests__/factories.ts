import { hexForColorName } from '@/domain/color';
import type { Category, ClothingItem, Formality, Season, Style } from '@/types';

let counter = 0;

/** Minimal-ceremony item builder so tests state only what they care about. */
export function makeItem(overrides: Partial<ClothingItem> & { category: Category }): ClothingItem {
  counter += 1;
  const color = overrides.primaryColor ?? 'black';

  const defaults: Omit<ClothingItem, 'category'> = {
    id: `item-${counter}`,

    name: `Item ${counter}`,
    primaryColor: color,
    primaryColorHex: hexForColorName(color),
    secondaryColors: [],
    pattern: 'solid',
    formality: 'casual' as Formality,
    seasons: ['spring', 'summer', 'fall', 'winter'] as Season[],
    styles: ['casual'] as Style[],
    favorite: false,
    laundry: 'clean',
    wearCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    detection: { source: 'seed', editedByUser: false },
  };

  return { ...defaults, ...overrides };
}

/** A closet with one of everything the outfit engine needs. */
export function basicCloset(): ClothingItem[] {
  return [
    makeItem({ id: 'tee', category: 'tshirt', name: 'White tee', primaryColor: 'white' }),
    makeItem({ id: 'shirt', category: 'shirt', name: 'Blue shirt', primaryColor: 'light blue' }),
    makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans', primaryColor: 'denim' }),
    makeItem({ id: 'chinos', category: 'chinos', name: 'Stone chinos', primaryColor: 'tan' }),
    makeItem({ id: 'sneakers', category: 'sneakers', name: 'White sneakers', primaryColor: 'white' }),
    makeItem({ id: 'boots', category: 'boots', name: 'Brown boots', primaryColor: 'brown' }),
    makeItem({ id: 'coat', category: 'coat', name: 'Charcoal coat', primaryColor: 'charcoal' }),
    makeItem({ id: 'sweater', category: 'sweater', name: 'Oatmeal knit', primaryColor: 'beige' }),
    makeItem({ id: 'watch', category: 'watch', name: 'Steel watch', primaryColor: 'grey' }),
  ];
}

export const emptyRequest = {
  prompt: '',
  includeItemIds: [] as string[],
  excludeItemIds: [] as string[],
  cleanOnly: false,
};
