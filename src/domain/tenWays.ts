import type { ClothingItem, Formality, OutfitRequest } from '@/types';

import { scoreOutfit } from './fitScore';
import { buildOutfitLocally } from './outfitEngine';
import { slotOf } from './taxonomy';

/**
 * One garment, worn ten ways.
 *
 * The app is a very good ten seconds in the morning and a thin reason to open
 * at any other time, which is the whole of its retention problem. The format
 * that answers it is not a prettier home screen: it is the one piece of styling
 * content that reliably outperforms everything else — take a thing somebody
 * already owns and show them ten outfits they did not know were in the
 * wardrobe.
 *
 * Every wardrobe app could build this and none of them can build it *from your
 * own clothes*, which is the only version worth looking at twice. Nothing here
 * is a mood board; every piece in every look is something already photographed
 * and hanging up.
 *
 * The hard part is that ten builds of the same engine give ten of the same
 * outfit. Two things pull them apart, and both are already in the engine:
 *
 * - **Ask ten different questions.** A jumper for a cold Tuesday and a jumper
 *   for dinner are genuinely different outfits, so the contexts below vary the
 *   occasion and the weather rather than the random seed.
 * - **Remember what has been used.** Everything worn in an earlier look is put
 *   to rest for the later ones — a penalty rather than a ban, so a wardrobe of
 *   fifteen pieces still produces ten looks instead of running dry at four.
 */

export interface Way {
  /** What the context asked for, so each look can say what it is FOR. */
  label: string;
  itemIds: string[];
  score: number;
  verdict: string;
  /** The pieces carrying it, other than the hero. */
  note: string;
}

/**
 * The questions asked, in order.
 *
 * Deliberately about occasions and weather rather than style words: "dressed
 * up" and "a cold day" are things somebody recognises from their own week, and
 * they move the engine along the two axes that actually change what it picks.
 */
const CONTEXTS: { label: string; formality: Formality; temperature: number }[] = [
  { label: 'Everyday', formality: 'casual', temperature: 18 },
  { label: 'Dressed up', formality: 'business-casual', temperature: 18 },
  { label: 'Weekend', formality: 'very-casual', temperature: 21 },
  { label: 'Cold day', formality: 'casual', temperature: 3 },
  { label: 'Warm day', formality: 'casual', temperature: 27 },
  { label: 'Smart', formality: 'smart-casual', temperature: 16 },
  { label: 'Out for dinner', formality: 'smart-casual', temperature: 14 },
  { label: 'Working from home', formality: 'very-casual', temperature: 20 },
  { label: 'A proper occasion', formality: 'formal', temperature: 17 },
  { label: 'Cool evening', formality: 'casual', temperature: 10 },
];

const BASE: OutfitRequest = {
  prompt: 'Ways to wear this',
  includeItemIds: [],
  excludeItemIds: [],
  // What is in the wash this week has nothing to do with how a garment can be
  // worn, and filtering by it would make the same piece show four looks on
  // Sunday and nine on Monday.
  cleanOnly: false,
};

export function tenWays(
  hero: ClothingItem,
  closet: ClothingItem[],
  count = CONTEXTS.length,
): Way[] {
  const pool = closet.filter((item) => !item.archived);
  const index = new Map(pool.map((item) => [item.id, item]));
  if (!index.has(hero.id)) return [];

  const ways: Way[] = [];
  const seen = new Set<string>();
  /** Everything already used, so the next look reaches for something else. */
  const resting = new Set<string>();

  for (const context of CONTEXTS.slice(0, count)) {
    const built = buildOutfitLocally({
      request: {
        ...BASE,
        includeItemIds: [hero.id],
        formality: context.formality,
        temperature: context.temperature,
      },
      closet: pool,
      // The hero is the point of the exercise and is never rested.
      restingItemIds: [...resting].filter((id) => id !== hero.id),
      season: undefined,
    });

    const worn = built.itemIds
      .map((id) => index.get(id))
      .filter((item): item is ClothingItem => Boolean(item));

    // A look that is not a whole outfit is not a way to wear anything.
    if (worn.length < 2) continue;

    const key = built.itemIds.slice().sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const report = scoreOutfit(worn);
    // A way to wear something has to be a whole outfit.
    if (!report.complete) continue;
    ways.push({
      label: context.label,
      itemIds: built.itemIds,
      score: report.score,
      verdict: report.verdict,
      note: describe(worn, hero),
    });

    built.itemIds.forEach((id) => resting.add(id));
  }

  return ways;
}

/**
 * What is carrying the look, other than the thing it is about.
 *
 * Named rather than counted. "With the indigo jeans and brown boots" is a
 * sentence somebody can picture; "4 pieces" is a fact about a list.
 */
function describe(worn: ClothingItem[], hero: ClothingItem): string {
  const rank: Record<string, number> = {
    fullbody: 0,
    bottom: 1,
    top: 2,
    outerwear: 3,
    midlayer: 4,
    footwear: 5,
    headwear: 6,
    accessory: 7,
  };

  const others = worn
    .filter((item) => item.id !== hero.id)
    .sort((a, b) => (rank[slotOf(a.category)] ?? 9) - (rank[slotOf(b.category)] ?? 9))
    .slice(0, 2)
    .map((item) => item.name.toLowerCase());

  if (others.length === 0) return 'On its own.';
  if (others.length === 1) return `With ${others[0]}.`;
  return `With ${others[0]} and ${others[1]}.`;
}

/**
 * Whether a garment has enough around it to be worth the screen.
 *
 * Four looks is a feature; two is an apology. Checked before the button is
 * offered rather than after it is pressed, so nothing opens onto a shrug.
 */
export const MIN_WAYS = 3;
