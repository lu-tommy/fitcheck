import { analyzeHarmony, hexForColorName, hexToHsl, hueDistance, isNeutral } from './color';
import { buildOutfitLocally } from './outfitEngine';
import { categoryMeta, formalityScore, slotOf } from './taxonomy';
import type { ClothingItem, Formality, Pattern, Season, Slot, Style } from '@/types';

/**
 * Should she buy it?
 *
 * The question a wardrobe app is uniquely able to answer and almost none of
 * them do: not "is this nice" but "does this go with what I already own, and
 * how many outfits does it actually unlock".
 *
 * Everything here runs on the same rules that build outfits — a candidate is
 * treated as a real garment, forced into the closet, and the engine is asked to
 * dress several different days around it. What comes back is countable.
 */

export interface Candidate {
  name: string;
  category: ClothingItem['category'];
  primaryColor: string;
  primaryColorHex: string;
  pattern?: Pattern;
  formality?: Formality;
  seasons?: Season[];
  styles?: Style[];
  price?: number;
}

export interface Pairing {
  item: ClothingItem;
  /** 0–100 colour harmony with the candidate. */
  score: number;
  why: string;
}

export interface ShoppingVerdict {
  /** Distinct wearable outfits the candidate makes possible. */
  outfitsUnlocked: number;
  /** Pieces it works with best, strongest first. */
  pairings: Pairing[];
  /** Things already in the closet that do much the same job. */
  duplicates: ClothingItem[];
  /** What is still missing before it can actually be worn. */
  missing: string[];
  /** 0–100. How hard this piece would work. */
  score: number;
  headline: string;
  detail: string;
  /** Cost per wear if worn once a week for a year, when a price is given. */
  costPerWearEstimate?: number;
}

/** Occasions the candidate is tried against, so the count means something. */
const TRIALS: { label: string; formality: Formality; temperature: number }[] = [
  { label: 'a normal day', formality: 'casual', temperature: 18 },
  { label: 'work', formality: 'business-casual', temperature: 18 },
  { label: 'dinner out', formality: 'smart-casual', temperature: 16 },
  { label: 'a cold day', formality: 'casual', temperature: 4 },
  { label: 'a hot day', formality: 'very-casual', temperature: 28 },
];

const CANDIDATE_ID = '__candidate__';

function asItem(candidate: Candidate): ClothingItem {
  const meta = categoryMeta(candidate.category);
  return {
    id: CANDIDATE_ID,
    name: candidate.name || `New ${meta.label.toLowerCase()}`,
    category: candidate.category,
    primaryColor: candidate.primaryColor,
    primaryColorHex: candidate.primaryColorHex || hexForColorName(candidate.primaryColor),
    secondaryColors: [],
    pattern: candidate.pattern ?? 'solid',
    formality: candidate.formality ?? meta.formality,
    seasons: candidate.seasons?.length ? candidate.seasons : ['spring', 'summer', 'fall', 'winter'],
    styles: candidate.styles?.length ? candidate.styles : ['casual'],
    favorite: false,
    laundry: 'clean',
    wearCount: 0,
    purchasePrice: candidate.price,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    detection: { source: 'manual', editedByUser: false },
  };
}

/** Would this outfit actually be wearable — something up top, down below, and shoes? */
function isComplete(items: ClothingItem[]): boolean {
  const slots = new Set(items.map((item) => slotOf(item.category)));
  const covered = slots.has('fullbody') || (slots.has('top') && slots.has('bottom'));
  return covered && slots.has('footwear');
}

export function assessPurchase(candidate: Candidate, closet: ClothingItem[]): ShoppingVerdict {
  const wanted = asItem(candidate);
  const live = closet.filter((item) => !item.archived);
  const pool = [...live, wanted];
  const byId = new Map(pool.map((item) => [item.id, item]));

  /* ------------------------------------------------------ outfits unlocked */

  const seen = new Set<string>();
  const missing = new Set<string>();

  TRIALS.forEach((trial) => {
    const built = buildOutfitLocally({
      request: {
        prompt: trial.label,
        formality: trial.formality,
        temperature: trial.temperature,
        includeItemIds: [CANDIDATE_ID],
        excludeItemIds: [],
        cleanOnly: false,
      },
      closet: pool,
      weather: null,
    });

    const items = built.itemIds
      .map((id) => byId.get(id))
      .filter((item): item is ClothingItem => Boolean(item));

    if (!items.some((item) => item.id === CANDIDATE_ID)) return;
    if (!isComplete(items)) {
      built.warnings?.forEach((warning) => missing.add(warning));
      return;
    }
    seen.add([...built.itemIds].sort().join('|'));
  });

  /* -------------------------------------------------------------- pairings */

  const mostWorn = Math.max(1, ...live.map((item) => item.wearCount));

  const pairings: Pairing[] = live
    .filter((item) => slotOf(item.category) !== slotOf(wanted.category))
    .map((item) => {
      const harmony = analyzeHarmony([wanted.primaryColorHex, item.primaryColorHex]).score;
      const formalityGap = Math.abs(
        formalityScore(item.formality) - formalityScore(wanted.formality),
      );
      const seasonOverlap = wanted.seasons.filter((season) => item.seasons.includes(season)).length;

      /*
       * Colour alone barely separates anything — against a neutral almost every
       * pair scores in the high eighties. What actually decides whether a
       * pairing is worth knowing about is whether she wears the other piece,
       * whether the two suit the same weather, and whether they belong at the
       * same kind of occasion.
       */
      const score = Math.round(
        harmony * 0.55 +
          (item.wearCount / mostWorn) * 100 * 0.2 +
          (seasonOverlap / 4) * 100 * 0.15 +
          (item.favorite ? 10 : 0) -
          formalityGap * 8,
      );

      return {
        item,
        score: Math.max(0, Math.min(100, score)),
        why: describePairing(wanted, item),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  /* ------------------------------------------------------------ duplicates */

  const duplicates = live.filter(
    (item) =>
      item.category === wanted.category &&
      item.primaryColor.toLowerCase() === wanted.primaryColor.toLowerCase(),
  );

  /* ----------------------------------------------------------------- score */

  const strongPairings = pairings.filter((pairing) => pairing.score >= 70).length;
  let score = Math.min(100, seen.size * 14 + strongPairings * 8);
  if (isNeutral(wanted.primaryColorHex)) score += 10;
  if (duplicates.length) score -= duplicates.length * 22;
  if (missing.size) score -= 12;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    outfitsUnlocked: seen.size,
    pairings,
    duplicates,
    missing: [...missing],
    score,
    headline: headlineFor(score, seen.size, duplicates),
    detail: detailFor(wanted, seen.size, pairings, duplicates, [...missing]),
    costPerWearEstimate: candidate.price ? candidate.price / 52 : undefined,
  };
}

/**
 * A short, specific line about one pairing.
 *
 * Uses the colour names already on the garments rather than re-deriving a hue,
 * because the analyser calls olive "yellow" — true of the hue, useless to
 * somebody holding an olive jacket.
 */
function describePairing(candidate: ClothingItem, item: ClothingItem): string {
  const a = candidate.primaryColor.toLowerCase();
  const b = item.primaryColor.toLowerCase();
  const candidateNeutral = isNeutral(candidate.primaryColorHex);
  const itemNeutral = isNeutral(item.primaryColorHex);

  if (candidateNeutral && itemNeutral) return `Two neutrals — ${a} and ${b} always work.`;
  if (candidateNeutral) return `The ${b} leads and the ${a} keeps it grounded.`;
  if (itemNeutral) return `The ${a} leads and the ${b} keeps it grounded.`;

  const gap = hueDistance(hexToHsl(candidate.primaryColorHex).h, hexToHsl(item.primaryColorHex).h);
  if (gap > 140) return `${titleFirst(a)} against ${b} — a deliberate contrast.`;
  if (gap < 40) return `${titleFirst(a)} and ${b} sit next to each other — soft and tonal.`;
  return `${titleFirst(a)} and ${b} compete a little; keep one of them small.`;
}

function titleFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function headlineFor(score: number, outfits: number, duplicates: ClothingItem[]): string {
  if (duplicates.length) return 'You already own this';
  if (score >= 75) return 'This would earn its place';
  if (score >= 45) return 'Useful, not essential';
  if (outfits === 0) return 'Nothing you own works with it';
  return 'It would not get much wear';
}

function detailFor(
  wanted: ClothingItem,
  outfits: number,
  pairings: Pairing[],
  duplicates: ClothingItem[],
  missing: string[],
): string {
  const parts: string[] = [];

  if (duplicates.length) {
    parts.push(
      `You already have ${listNames(duplicates)} — close enough that a second would mostly sit in the wardrobe.`,
    );
  }

  parts.push(
    outfits === 0
      ? 'It did not complete a single outfit from what you own.'
      : `It completes ${outfits} ${outfits === 1 ? 'outfit' : 'different outfits'} from clothes you already have.`,
  );

  const best = pairings.filter((pairing) => pairing.score >= 70).slice(0, 3);
  if (best.length) {
    parts.push(`Best with ${listNames(best.map((pairing) => pairing.item))}.`);
  } else if (pairings.length) {
    parts.push('Nothing you own is a natural match for the colour.');
  }

  if (missing.length) parts.push(missing.join(' '));

  return parts.join(' ');
}

function listNames(items: ClothingItem[]): string {
  const names = items.map((item) => item.name.toLowerCase());
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Slots the closet is thinnest in — what to look for rather than what to avoid. */
export function weakestSlots(closet: ClothingItem[]): { slot: Slot; count: number }[] {
  const live = closet.filter((item) => !item.archived);
  const counts = new Map<Slot, number>();
  (['top', 'bottom', 'footwear', 'outerwear', 'midlayer'] as Slot[]).forEach((slot) =>
    counts.set(slot, 0),
  );
  live.forEach((item) => {
    const slot = slotOf(item.category);
    if (counts.has(slot)) counts.set(slot, (counts.get(slot) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([slot, count]) => ({ slot, count }))
    .sort((a, b) => a.count - b.count);
}
