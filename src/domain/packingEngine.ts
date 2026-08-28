import type { ClothingItem, PackingRequest, Slot } from '@/types';

import { categoryMeta, slotOf } from './taxonomy';

export interface LocalPackingResult {
  summary: string;
  itemIds: string[];
  dayPlans: { day: number; label: string; itemIds: string[] }[];
  notes: string;
}

/**
 * Rule-of-thumb packing used when Claude is unavailable: enough tops to avoid
 * repeats, bottoms and shoes that stretch across several days, and one layer
 * for the coldest evening.
 */
export function buildPackingLocally(
  request: PackingRequest,
  closet: ClothingItem[],
): LocalPackingResult {
  const available = closet.filter((item) => item.laundry !== 'dirty');

  const pickBySlot = (slot: Slot, count: number): ClothingItem[] =>
    available
      .filter((item) => slotOf(item.category) === slot)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.wearCount - b.wearCount)
      .slice(0, count);

  const days = Math.max(1, request.days);
  const tops = pickBySlot('top', Math.min(days, Math.ceil(days * 0.8) + 1));
  const bottoms = pickBySlot('bottom', Math.min(3, Math.ceil(days / 3) + 1));
  const shoes = pickBySlot('footwear', days > 3 ? 2 : 1);
  const layers = pickBySlot('midlayer', 1);
  const outerwear = pickBySlot('outerwear', 1);
  const accessories = pickBySlot('accessory', 2);

  const packed = [...tops, ...bottoms, ...shoes, ...layers, ...outerwear, ...accessories];

  const dayPlans = Array.from({ length: days }, (_, index) => {
    const top = tops[index % Math.max(1, tops.length)];
    const bottom = bottoms[index % Math.max(1, bottoms.length)];
    const shoe = shoes[index % Math.max(1, shoes.length)];
    return {
      day: index + 1,
      label: request.activities[index % Math.max(1, request.activities.length)] ?? `Day ${index + 1}`,
      itemIds: [top?.id, bottom?.id, shoe?.id].filter((id): id is string => Boolean(id)),
    };
  });

  const gaps: string[] = [];
  if (!bottoms.length) gaps.push('no bottoms available');
  if (!shoes.length) gaps.push('no shoes available');
  if (!outerwear.length && !layers.length) gaps.push('nothing to layer with for cool evenings');

  const warmth = packed.reduce((total, item) => total + categoryMeta(item.category).warmth, 0);

  return {
    summary: `${packed.length} pieces for ${days} ${days === 1 ? 'day' : 'days'} in ${request.destination}, built to re-wear bottoms and shoes across the trip.`,
    itemIds: packed.map((item) => item.id),
    dayPlans,
    notes: gaps.length
      ? `Gaps in your closet: ${gaps.join(', ')}.`
      : warmth < days
        ? 'Light on warm layers — worth checking the forecast before you go.'
        : 'Nothing obviously missing.',
  };
}
