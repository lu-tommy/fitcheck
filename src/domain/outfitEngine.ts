import type {
  ClothingItem,
  GeneratedOutfit,
  OutfitRequest,
  Season,
  Slot,
  Style,
  WeatherSnapshot,
} from '@/types';

import { analyzeHarmony, hexForColorName } from './color';
import { categoryMeta, formalityScore, slotOf } from './taxonomy';
import { currentSeason } from '@/lib/date';

/**
 * Rule-based outfit builder.
 *
 * This is the fallback whenever Claude is unavailable — no key configured, no
 * network, or a failed call — so the product never dead-ends. It is also the
 * scoring model behind "why does this work", and it runs instantly.
 */

export interface EngineContext {
  request: OutfitRequest;
  closet: ClothingItem[];
  weather?: WeatherSnapshot | null;
  preferredStyles?: Style[];
  avoidColors?: string[];
  season?: Season;
  /**
   * Pieces worn in the last day or two, when planning several days at once.
   *
   * A soft penalty rather than an exclusion, deliberately: someone with one
   * pair of shoes should still get shoes every day. Excluding them outright
   * forces the planner to relax every constraint at once, and the first thing
   * it loses is the rule that actually matters — not repeating a top.
   */
  restingItemIds?: string[];
}

interface ScoredItem {
  item: ClothingItem;
  score: number;
}

/**
 * How much total warmth an outfit should carry at a given temperature.
 *
 * Deliberately conservative in the mild band: a shirt and trousers is the right
 * answer at 18°C, and an engine that reaches for a jumper there produces the
 * classic wardrobe-app mistake of layering wool over shorts.
 */
function targetWarmth(temperatureC: number): number {
  if (temperatureC >= 24) return 0;
  if (temperatureC >= 17) return 1;
  if (temperatureC >= 12) return 2;
  if (temperatureC >= 7) return 4;
  if (temperatureC >= 2) return 6;
  return 8;
}

/**
 * True when adding this layer would contradict what is already chosen — a wool
 * jumper on top of shorts. Warmth arithmetic alone cannot see this, because the
 * numbers add up perfectly well; it is the combination that reads as wrong.
 */
function layerWouldClash(
  candidate: ClothingItem,
  chosen: ClothingItem[],
  temperature: number,
): boolean {
  if (temperature < 14) return false;
  if (categoryMeta(candidate.category).warmth < 2) return false;
  return chosen.some((item) => {
    if (slotOf(item.category) !== 'bottom') return false;
    if (item.category === 'shorts') return true;
    return item.seasons.length === 1 && item.seasons[0] === 'summer';
  });
}

function scoreItem(item: ClothingItem, context: EngineContext, temperature: number): number {
  const { request } = context;
  let score = 50;

  // Seasonality.
  const season = context.season ?? currentSeason();
  if (item.seasons.includes(season)) score += 10;
  else if (item.seasons.length > 0) score -= 8;

  // Formality proximity — one step away is fine, three steps is not.
  if (request.formality) {
    const distance = Math.abs(formalityScore(item.formality) - formalityScore(request.formality));
    score += Math.max(-24, 12 - distance * 8);
  }

  // Style match.
  const wantedStyle = request.style ? [request.style] : (context.preferredStyles ?? []);
  if (wantedStyle.length) {
    score += item.styles.some((style) => wantedStyle.includes(style)) ? 12 : -6;
  }

  // Warmth suitability for the individual piece.
  const warmth = categoryMeta(item.category).warmth;
  if (temperature >= 24 && warmth >= 2) score -= 25;
  if (temperature <= 6 && warmth === 0 && slotOf(item.category) !== 'accessory') score -= 8;

  // Colour preferences.
  const colorText = [item.primaryColor, ...item.secondaryColors].join(' ').toLowerCase();
  if (request.colorPreference) {
    const wanted = request.colorPreference.toLowerCase();
    if (colorText.includes(wanted)) score += 18;
  }
  if (context.avoidColors?.some((color) => colorText.includes(color.toLowerCase()))) score -= 30;

  // Nudge towards favourites and away from the same three pieces every day.
  if (item.favorite) score += 8;
  score -= Math.min(12, item.wearCount * 0.6);

  // Laundry.
  if (item.laundry === 'dirty') score -= request.cleanOnly ? 1000 : 40;
  if (item.laundry === 'washing') score -= request.cleanOnly ? 1000 : 25;

  // Big enough to lose against any fresh alternative, small enough that a
  // resting piece still beats leaving the slot empty.
  if (context.restingItemIds?.includes(item.id)) score -= 150;

  if (request.includeItemIds.includes(item.id)) score += 500;
  if (request.excludeItemIds.includes(item.id)) score -= 1000;

  return score;
}

function bestBySlot(candidates: ScoredItem[], slot: Slot): ScoredItem | undefined {
  return candidates
    .filter((entry) => slotOf(entry.item.category) === slot)
    .sort((a, b) => b.score - a.score)[0];
}

/** Bonus for a candidate that harmonises with what has already been chosen. */
function harmonyBonus(candidate: ClothingItem, chosen: ClothingItem[]): number {
  if (chosen.length === 0) return 0;
  const hexes = [...chosen, candidate].map(
    (item) => item.primaryColorHex || hexForColorName(item.primaryColor),
  );
  const report = analyzeHarmony(hexes);
  return (report.score - 60) / 3;
}

function pickForSlot(
  slot: Slot,
  candidates: ScoredItem[],
  chosen: ClothingItem[],
  used: Set<string>,
): ClothingItem | undefined {
  const options = candidates
    .filter((entry) => slotOf(entry.item.category) === slot && !used.has(entry.item.id))
    .map((entry) => ({ ...entry, score: entry.score + harmonyBonus(entry.item, chosen) }))
    .sort((a, b) => b.score - a.score);
  return options[0]?.item;
}

export function buildOutfitLocally(context: EngineContext): GeneratedOutfit {
  const { request, closet, weather } = context;
  const temperature = weather?.temperature ?? request.temperature ?? 18;

  const pool = closet.filter((item) => !request.excludeItemIds.includes(item.id));
  const scored: ScoredItem[] = pool
    .map((item) => ({ item, score: scoreItem(item, context, temperature) }))
    .filter((entry) => entry.score > -500);

  const chosen: ClothingItem[] = [];
  const used = new Set<string>();

  const take = (item?: ClothingItem) => {
    if (!item || used.has(item.id)) return;
    chosen.push(item);
    used.add(item.id);
  };

  // A forced fullbody piece (or a strongly-scoring one) replaces top + bottom.
  const forced = request.includeItemIds
    .map((id) => pool.find((item) => item.id === id))
    .filter((item): item is ClothingItem => Boolean(item));
  const forcedFullbody = forced.find((item) => slotOf(item.category) === 'fullbody');
  const bestFullbody = bestBySlot(scored, 'fullbody');
  const bestTop = bestBySlot(scored, 'top');
  const useFullbody =
    Boolean(forcedFullbody) ||
    (bestFullbody != null && (bestTop == null || bestFullbody.score > bestTop.score + 15));

  forced.forEach(take);

  if (useFullbody) {
    take(forcedFullbody ?? bestFullbody?.item);
  } else {
    if (!chosen.some((item) => slotOf(item.category) === 'top')) {
      take(pickForSlot('top', scored, chosen, used));
    }
    if (!chosen.some((item) => slotOf(item.category) === 'bottom')) {
      take(pickForSlot('bottom', scored, chosen, used));
    }
  }

  if (!chosen.some((item) => slotOf(item.category) === 'footwear')) {
    take(pickForSlot('footwear', scored, chosen, used));
  }

  // Layer up until the outfit is warm enough for the forecast.
  const warmthOf = (items: ClothingItem[]) =>
    items.reduce((total, item) => total + categoryMeta(item.category).warmth, 0);
  const needed = targetWarmth(temperature);

  const takeLayer = (slot: Slot) => {
    const candidate = pickForSlot(slot, scored, chosen, used);
    if (candidate && !layerWouldClash(candidate, chosen, temperature)) take(candidate);
  };

  if (warmthOf(chosen) < needed && !chosen.some((item) => slotOf(item.category) === 'midlayer')) {
    takeLayer('midlayer');
  }
  if (warmthOf(chosen) < needed && !chosen.some((item) => slotOf(item.category) === 'outerwear')) {
    takeLayer('outerwear');
  }
  if (temperature <= 4 && !chosen.some((item) => slotOf(item.category) === 'headwear')) {
    take(pickForSlot('headwear', scored, chosen, used));
  }

  // One or two accessories, never more — the point is polish, not clutter.
  const accessories = scored
    .filter((entry) => slotOf(entry.item.category) === 'accessory' && !used.has(entry.item.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  accessories.forEach((entry) => take(entry.item));

  const harmony = analyzeHarmony(
    chosen.map((item) => item.primaryColorHex || hexForColorName(item.primaryColor)),
  );

  const alternatives = (['top', 'bottom', 'footwear'] as Slot[])
    .map((slot) => {
      const current = chosen.find((item) => slotOf(item.category) === slot);
      const alternative = scored
        .filter(
          (entry) => slotOf(entry.item.category) === slot && entry.item.id !== current?.id,
        )
        .sort((a, b) => b.score - a.score)[0];
      if (!alternative) return null;
      return {
        slot,
        itemId: alternative.item.id,
        why: `Swap in for a ${describeShift(alternative.item, current)} take.`,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, 3);

  return {
    name: localName(chosen, request, temperature),
    itemIds: chosen.map((item) => item.id),
    explanation: localExplanation(chosen, context, temperature, needed),
    colorNotes: harmony.summary,
    alternatives,
    warnings: missingSlotWarnings(chosen),
  };
}

function describeShift(candidate: ClothingItem, current?: ClothingItem): string {
  if (!current) return 'different';
  const delta = formalityScore(candidate.formality) - formalityScore(current.formality);
  if (delta > 0) return 'sharper';
  if (delta < 0) return 'more relaxed';
  return 'different';
}

function missingSlotWarnings(chosen: ClothingItem[]): string[] | undefined {
  const slots = new Set(chosen.map((item) => slotOf(item.category)));
  const warnings: string[] = [];
  const hasFullbody = slots.has('fullbody');
  if (!hasFullbody && !slots.has('top')) warnings.push('No suitable top was available.');
  if (!hasFullbody && !slots.has('bottom')) warnings.push('No suitable bottom was available.');
  if (!slots.has('footwear')) warnings.push('No suitable shoes were available.');
  return warnings.length ? warnings : undefined;
}

function localName(
  chosen: ClothingItem[],
  request: OutfitRequest,
  temperature: number,
): string {
  if (request.occasion) return `${request.occasion} look`;
  const hero = chosen.find((item) => ['top', 'fullbody'].includes(slotOf(item.category)));
  const descriptor = temperature <= 8 ? 'Cold-weather' : temperature >= 25 ? 'Warm-weather' : 'Everyday';
  return hero ? `${descriptor} ${hero.primaryColor}` : `${descriptor} look`;
}

function localExplanation(
  chosen: ClothingItem[],
  context: EngineContext,
  temperature: number,
  neededWarmth: number,
): string {
  const parts: string[] = [];
  const hero = chosen.find((item) => ['top', 'fullbody'].includes(slotOf(item.category)));
  const bottom = chosen.find((item) => slotOf(item.category) === 'bottom');
  const shoes = chosen.find((item) => slotOf(item.category) === 'footwear');

  if (hero && bottom) {
    parts.push(`${hero.name} with ${bottom.name.toLowerCase()}`);
  } else if (hero) {
    parts.push(hero.name);
  }
  if (shoes) parts.push(`finished with ${shoes.name.toLowerCase()}`);

  const opener = parts.length ? `${parts.join(', ')}.` : 'Built from what is clean and available.';

  const layers = chosen.filter((item) =>
    ['midlayer', 'outerwear'].includes(slotOf(item.category)),
  );
  const weatherNote =
    neededWarmth === 0
      ? `At ${Math.round(temperature)}°C the priority is staying cool, so nothing heavy.`
      : layers.length
        ? `${layers.map((item) => item.name).join(' and ')} covers the ${Math.round(temperature)}°C.`
        : `Light enough for ${Math.round(temperature)}°C — add a layer if you will be out after dark.`;

  const formalityNote = context.request.formality
    ? ` Pitched at ${context.request.formality.replace('-', ' ')}.`
    : '';

  return `${opener} ${weatherNote}${formalityNote}`;
}
