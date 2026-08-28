import { hexForColorName } from '@/domain/color';
import { SLOT_LABEL_PLURAL, slotOf } from '@/domain/taxonomy';
import type { ClothingItem, Outfit, Slot, WearLog } from '@/types';

export interface ColorShare {
  color: string;
  hex: string;
  count: number;
  share: number;
}

export interface SlotShare {
  slot: Slot;
  label: string;
  count: number;
}

export interface WardrobeStats {
  totalItems: number;
  totalOutfits: number;
  totalWears: number;
  neverWorn: ClothingItem[];
  mostWorn: ClothingItem[];
  leastWorn: ClothingItem[];
  colorShares: ColorShare[];
  slotShares: SlotShare[];
  favoriteCount: number;
  cleanCount: number;
  /** Average wears per item — the honest measure of whether a wardrobe earns its space. */
  averageWears: number;
  /** Items with a price, ranked by cost per wear (cheapest first). */
  costPerWear: { item: ClothingItem; costPerWear: number }[];
  busiestDay: { date: string; count: number } | null;
}

export function computeStats(
  items: ClothingItem[],
  outfits: Outfit[],
  wearLogs: WearLog[],
): WardrobeStats {
  const totalWears = items.reduce((total, item) => total + item.wearCount, 0);

  const colorCounts = new Map<string, number>();
  items.forEach((item) => {
    const key = item.primaryColor.toLowerCase();
    colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
  });

  const colorShares: ColorShare[] = [...colorCounts.entries()]
    .map(([color, count]) => ({
      color,
      hex:
        items.find((item) => item.primaryColor.toLowerCase() === color)?.primaryColorHex ||
        hexForColorName(color),
      count,
      share: items.length ? count / items.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const slotCounts = new Map<Slot, number>();
  items.forEach((item) => {
    const slot = slotOf(item.category);
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);
  });

  const slotShares: SlotShare[] = [...slotCounts.entries()]
    .map(([slot, count]) => ({ slot, label: SLOT_LABEL_PLURAL[slot], count }))
    .sort((a, b) => b.count - a.count);

  const byWear = [...items].sort((a, b) => b.wearCount - a.wearCount);

  const dayCounts = new Map<string, number>();
  wearLogs.forEach((log) => {
    dayCounts.set(log.date, (dayCounts.get(log.date) ?? 0) + 1);
  });
  const busiest = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalItems: items.length,
    totalOutfits: outfits.length,
    totalWears,
    neverWorn: items.filter((item) => item.wearCount === 0),
    mostWorn: byWear.slice(0, 5),
    leastWorn: [...byWear].reverse().slice(0, 5),
    colorShares,
    slotShares,
    favoriteCount: items.filter((item) => item.favorite).length,
    cleanCount: items.filter((item) => item.laundry === 'clean').length,
    averageWears: items.length ? totalWears / items.length : 0,
    costPerWear: items
      .filter((item) => typeof item.purchasePrice === 'number' && item.purchasePrice > 0)
      .map((item) => ({
        item,
        costPerWear: (item.purchasePrice as number) / Math.max(1, item.wearCount),
      }))
      .sort((a, b) => a.costPerWear - b.costPerWear),
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : null,
  };
}
