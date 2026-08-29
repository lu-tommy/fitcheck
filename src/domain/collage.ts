import { SLOT_ORDER, slotOf } from './taxonomy';
import type { CollagePlacement, ClothingItem, Slot } from '@/types';

/**
 * Arranging an outfit as a flat lay.
 *
 * A stacked list is an accurate description of an outfit and a terrible picture
 * of one. This lays the pieces out the way they would fall on a bed: the big
 * garments carry the composition, shoes anchor the bottom corner, accessories
 * fill the gaps, and everything sits at a slight angle so it reads as cloth
 * rather than as a grid.
 *
 * Positions are fractions of the canvas, so the same layout renders at any size
 * — a thumbnail, a full screen, or a 2000px export.
 */

interface Spot {
  x: number;
  y: number;
  size: number;
  z: number;
  rotation: number;
}

/** Where each slot goes when the outfit is built around a top and a bottom. */
const TWO_PIECE: Partial<Record<Slot, Spot>> = {
  headwear: { x: 0.18, y: 0.13, size: 0.24, z: 4, rotation: -7 },
  top: { x: 0.39, y: 0.32, size: 0.46, z: 3, rotation: -3 },
  midlayer: { x: 0.76, y: 0.29, size: 0.42, z: 2, rotation: 5 },
  outerwear: { x: 0.77, y: 0.32, size: 0.48, z: 1, rotation: 6 },
  bottom: { x: 0.37, y: 0.74, size: 0.41, z: 3, rotation: 2 },
  footwear: { x: 0.76, y: 0.84, size: 0.3, z: 4, rotation: -6 },
};

/** A dress or a suit carries the middle; everything else works around it. */
const ONE_PIECE: Partial<Record<Slot, Spot>> = {
  headwear: { x: 0.18, y: 0.13, size: 0.24, z: 4, rotation: -7 },
  fullbody: { x: 0.45, y: 0.45, size: 0.56, z: 3, rotation: -2 },
  outerwear: { x: 0.81, y: 0.31, size: 0.42, z: 1, rotation: 7 },
  midlayer: { x: 0.81, y: 0.31, size: 0.38, z: 2, rotation: 7 },
  footwear: { x: 0.78, y: 0.85, size: 0.29, z: 4, rotation: -6 },
};

/** Gaps around the edge that accessories can drop into, in order of preference. */
const ACCESSORY_SPOTS: Spot[] = [
  { x: 0.85, y: 0.12, size: 0.19, z: 5, rotation: 9 },
  { x: 0.14, y: 0.48, size: 0.18, z: 5, rotation: -10 },
  { x: 0.15, y: 0.85, size: 0.18, z: 5, rotation: 8 },
  { x: 0.89, y: 0.57, size: 0.17, z: 5, rotation: -6 },
  { x: 0.52, y: 0.94, size: 0.16, z: 5, rotation: -4 },
];

/**
 * When there is no second big garment on the right, the top and bottom slide
 * back towards the middle so the composition is not lopsided.
 */
const CENTRED_SHIFT = 0.1;

export function autoLayout(items: ClothingItem[]): CollagePlacement[] {
  const bySlot = new Map<Slot, ClothingItem[]>();
  items.forEach((item) => {
    const slot = slotOf(item.category);
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), item]);
  });

  const hasFullbody = (bySlot.get('fullbody')?.length ?? 0) > 0;
  const table = hasFullbody ? ONE_PIECE : TWO_PIECE;
  const hasRightColumn =
    (bySlot.get('outerwear')?.length ?? 0) > 0 || (bySlot.get('midlayer')?.length ?? 0) > 0;

  const placements: CollagePlacement[] = [];
  let accessoryIndex = 0;

  SLOT_ORDER.forEach((slot) => {
    const slotItems = bySlot.get(slot);
    if (!slotItems?.length) return;

    slotItems.forEach((item, index) => {
      if (slot === 'accessory') {
        const spot = ACCESSORY_SPOTS[accessoryIndex % ACCESSORY_SPOTS.length];
        accessoryIndex += 1;
        placements.push({ itemId: item.id, ...spot });
        return;
      }

      const spot = table[slot];
      if (!spot) return;

      // A second piece in the same slot (two accessories aside, this is rare)
      // is nudged off the first rather than hidden underneath it.
      const offset = index * 0.06;
      const centred = !hasRightColumn && (slot === 'top' || slot === 'bottom');

      placements.push({
        itemId: item.id,
        x: clamp(spot.x + offset + (centred ? CENTRED_SHIFT : 0)),
        y: clamp(spot.y + offset),
        size: spot.size,
        z: spot.z + index,
        rotation: spot.rotation,
      });
    });
  });

  return placements;
}

function clamp(value: number): number {
  return Math.max(0.06, Math.min(0.94, value));
}

/**
 * The layout to draw: a saved one where it still matches the outfit, otherwise
 * a fresh automatic composition. A saved layout that has fallen out of sync —
 * a piece deleted, a piece swapped in — is repaired rather than discarded, so
 * hand-positioned pieces stay where they were put.
 */
export function resolveLayout(
  items: ClothingItem[],
  saved: CollagePlacement[] | undefined,
): CollagePlacement[] {
  const automatic = autoLayout(items);
  if (!saved?.length) return automatic;

  const savedById = new Map(saved.map((entry) => [entry.itemId, entry]));
  return automatic.map((fallback) => savedById.get(fallback.itemId) ?? fallback);
}
