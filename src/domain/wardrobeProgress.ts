import type { Category, Slot } from '@/types';
import { slotOf } from '@/domain/taxonomy';

/**
 * What the work of photographing clothes is actually buying.
 *
 * Cataloguing a wardrobe is the tedious part and the reason people give these
 * apps up. The honest antidote is not a badge — it is showing that the tenth
 * photo is worth more than the ninth, which is true, because outfits multiply.
 *
 * Everything here is arithmetic anyone can check. It counts COMBINATIONS, and
 * says "combinations" rather than "outfits": whether a particular pairing looks
 * good is the outfit engine's job and it is not going to be flattered here.
 */

export interface WardrobeCounts {
  top: number;
  bottom: number;
  footwear: number;
  fullbody: number;
  outerwear: number;
  midlayer: number;
  headwear: number;
  accessory: number;
}

export const EMPTY_COUNTS: WardrobeCounts = {
  top: 0,
  bottom: 0,
  footwear: 0,
  fullbody: 0,
  outerwear: 0,
  midlayer: 0,
  headwear: 0,
  accessory: 0,
};

export function countBySlot(categories: Category[]): WardrobeCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const category of categories) {
    const slot = slotOf(category) as keyof WardrobeCounts;
    if (slot in counts) counts[slot] += 1;
  }
  return counts;
}

/**
 * A wearable combination is a top with a bottom, or a one-piece — and shoes if
 * there are any. Shoes multiply rather than gate: a closet with no shoes in it
 * yet still combines, and saying otherwise would show a demoralising zero to
 * someone who has just photographed six jumpers.
 */
export function combinations(c: WardrobeCounts): number {
  const bodies = c.top * c.bottom + c.fullbody;
  return bodies * Math.max(1, c.footwear);
}

export interface NextBest {
  slot: Slot;
  /** How many combinations one more piece in that slot would add. */
  gain: number;
}

/**
 * The single most valuable next photograph. This is the honest version of a
 * "complete your profile" nudge: it is whichever slot multiplies what is
 * already there by the most, which early on is always the empty one.
 */
export function nextBestSlot(c: WardrobeCounts): NextBest | null {
  const now = combinations(c);
  const candidates: Slot[] = ['top', 'bottom', 'footwear', 'fullbody'];
  let best: NextBest | null = null;
  for (const slot of candidates) {
    const next = combinations({ ...c, [slot]: c[slot as keyof WardrobeCounts] + 1 });
    const gain = next - now;
    if (gain <= 0) continue;
    if (!best || gain > best.gain) best = { slot, gain };
  }
  return best;
}

/**
 * One sentence for the add screen. Deliberately plain: it reports a number and
 * what would raise it, and it never congratulates anyone.
 */
export function progressLine(c: WardrobeCounts): string {
  const pieces =
    c.top + c.bottom + c.footwear + c.fullbody + c.outerwear + c.midlayer + c.headwear + c.accessory;
  if (pieces === 0) return '';
  const total = combinations(c);
  if (total === 0) {
    const next = nextBestSlot(c);
    if (!next) return `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
    return `${pieces} ${pieces === 1 ? 'piece' : 'pieces'} — add ${SLOT_WORD[next.slot]} and they start combining`;
  }
  return `${pieces} ${pieces === 1 ? 'piece' : 'pieces'} · ${total} ${
    total === 1 ? 'combination' : 'combinations'
  }`;
}

const SLOT_WORD: Record<Slot, string> = {
  top: 'a top',
  bottom: 'a bottom',
  footwear: 'shoes',
  fullbody: 'a dress',
  outerwear: 'a coat',
  midlayer: 'a jumper',
  headwear: 'a hat',
  accessory: 'an accessory',
};

export { SLOT_WORD };
