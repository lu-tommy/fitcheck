import type {
  Category,
  ClothingItem,
  GeneratedOutfit,
  OutfitRequest,
  Season,
  Slot,
  Style,
  Units,
  WeatherSnapshot,
} from '@/types';

import { analyzeHarmony, hexForColorName } from './color';
import {
  ACCESSORY_FOCAL_BUDGET,
  accessoryFocalWeight,
  accessoryPosition,
  categoryMeta,
  formalityScore,
  slotOf,
} from './taxonomy';
import { currentSeason } from '@/lib/date';
import { formatTemperatureLong } from '@/lib/format';

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
  /**
   * How temperatures are written in the explanation. The engine reasons in
   * Celsius throughout — this only decides what the reader sees, so someone
   * who set Fahrenheit is never told it is 18 degrees outside.
   */
  units?: Units;
  /** Garments that suit the occasion, read from what the wearer typed. */
  preferCategories?: Category[];
  /**
   * Garments that would be wrong for it. A heavy penalty rather than a ban:
   * wearing the only shoes you own to the gym beats being sent out barefoot,
   * and the explanation says when it had to settle.
   */
  avoidCategories?: Category[];
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

  if (context.preferCategories?.includes(item.category)) score += 60;
  if (context.avoidCategories?.includes(item.category)) score -= 400;

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

/**
 * How badly a candidate clashes with what is already on the body.
 *
 * scoreItem judges every piece on its own against the REQUEST, so nothing ever
 * compared the chosen top to the chosen trousers: a very-casual tank and a pair
 * of formal dress trousers are four steps apart on the same scale and the
 * engine happily put them together, which is exactly what a person notices
 * first and trusts least.
 *
 * Only the pieces that set the register are considered — a top, a bottom, or a
 * one-piece. A smart-casual belt or watch with a casual outfit is normal
 * dressing, not a mistake, so accessories and layers are left out of it.
 *
 * The scale is deliberately forgiving, because most real dressing is mixed: an
 * Oxford shirt with jeans is two steps apart and is simply an outfit. Three
 * steps is a stretch worth discouraging. Four — a very-casual tank with formal
 * dress trousers — is the thing you would notice across a room, and it costs
 * more than any other bonus in the scorer can win back.
 */
const REGISTER_SLOTS: Slot[] = ['top', 'bottom', 'fullbody'];
const CLASH_COST = [0, 0, 0, 25, 70];

export function formalityClashPenalty(
  candidate: ClothingItem,
  chosen: ClothingItem[],
): number {
  if (!REGISTER_SLOTS.includes(slotOf(candidate.category))) return 0;
  const anchors = chosen.filter((item) => REGISTER_SLOTS.includes(slotOf(item.category)));
  if (!anchors.length) return 0;
  const here = formalityScore(candidate.formality);
  const worst = Math.max(
    ...anchors.map((item) => Math.abs(here - formalityScore(item.formality))),
  );
  const cost = CLASH_COST[Math.min(worst, CLASH_COST.length - 1)] ?? 0;
  // Return a plain zero rather than -0: negative zero compares unequal to 0
  // under Object.is, which is the sort of thing that survives into a test and
  // then into a bug report.
  return cost === 0 ? 0 : -cost;
}

function pickForSlot(
  slot: Slot,
  candidates: ScoredItem[],
  chosen: ClothingItem[],
  used: Set<string>,
): ClothingItem | undefined {
  const options = candidates
    .filter((entry) => slotOf(entry.item.category) === slot && !used.has(entry.item.id))
    .map((entry) => ({
      ...entry,
      score:
        entry.score +
        harmonyBonus(entry.item, chosen) +
        formalityClashPenalty(entry.item, chosen),
    }))
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
    if (!candidate) return;
    if (layerWouldClash(candidate, chosen, temperature)) return;
    /*
     * A layer is optional, so it must never be the reason a wrong garment gets
     * worn. Top, bottom and shoes fall back to whatever exists — better the
     * wrong shoes than none — but nobody needs a blazer to go running, and
     * being a degree cold beats being dressed for the wrong thing entirely.
     */
    if (context.avoidCategories?.includes(candidate.category)) return;
    take(candidate);
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

  /*
   * Accessories: one per position, up to three focal points in total.
   *
   * Position is what competes physically — a watch and a belt and sunglasses
   * all go on at once, but only one thing goes round a wrist. Attention is what
   * competes visually, and it is not the same question: see
   * ACCESSORY_FOCAL_WEIGHT for why counting objects got both halves wrong.
   */
  const takenPositions = new Set(
    chosen
      .filter((item) => slotOf(item.category) === 'accessory')
      .map((item) => accessoryPosition(item.category)),
  );

  // A headband is competing with the hat, not with the other accessories.
  // Nothing else in the wardrobe crosses slots like this, so it is stated here
  // rather than folded into the position table, which would then be lying.
  if (chosen.some((item) => slotOf(item.category) === 'headwear')) takenPositions.add('head');

  let focal = chosen
    .filter((item) => slotOf(item.category) === 'accessory')
    .reduce((total, item) => total + accessoryFocalWeight(item.category), 0);

  scored
    .filter((entry) => slotOf(entry.item.category) === 'accessory' && !used.has(entry.item.id))
    .sort((a, b) => b.score - a.score)
    .forEach((entry) => {
      const position = accessoryPosition(entry.item.category);
      if (takenPositions.has(position)) return;
      // Skipping one that will not fit leaves the budget open for a quieter
      // piece further down, which is how a belt survives a statement necklace.
      const weight = accessoryFocalWeight(entry.item.category);
      if (focal + weight > ACCESSORY_FOCAL_BUDGET) return;
      takenPositions.add(position);
      focal += weight;
      take(entry.item);
    });

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
        why: `Swap in for ${describeShift(alternative.item, current)} take.`,
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
    warnings: missingSlotWarnings(chosen, context.avoidCategories),
  };
}

/**
 * What actually changes if you swap this in.
 *
 * Three alternatives all reading "a different take" is filler that tells the
 * wearer nothing — it has to name the axis that moves: how dressed up it is,
 * how warm, or failing both, the colour.
 */
function describeShift(candidate: ClothingItem, current?: ClothingItem): string {
  if (!current) return 'a different';

  const formalityDelta = formalityScore(candidate.formality) - formalityScore(current.formality);
  if (formalityDelta > 0) return 'a sharper';
  if (formalityDelta < 0) return 'a more relaxed';

  const warmthDelta = categoryMeta(candidate.category).warmth - categoryMeta(current.category).warmth;
  if (warmthDelta > 0) return 'a warmer';
  if (warmthDelta < 0) return 'a lighter';

  if (candidate.primaryColor.toLowerCase() !== current.primaryColor.toLowerCase()) {
    return `a ${candidate.primaryColor.toLowerCase()}`;
  }
  return 'a different';
}

function missingSlotWarnings(
  chosen: ClothingItem[],
  avoidCategories?: Category[],
): string[] | undefined {
  const slots = new Set(chosen.map((item) => slotOf(item.category)));
  const warnings: string[] = [];
  const hasFullbody = slots.has('fullbody');
  if (!hasFullbody && !slots.has('top')) warnings.push('No suitable top was available.');
  if (!hasFullbody && !slots.has('bottom')) warnings.push('No suitable bottom was available.');
  if (!slots.has('footwear')) warnings.push('No suitable shoes were available.');

  // Being honest about a compromise is the whole promise: it only ever uses
  // clothes you own, so sometimes the right thing is not in the wardrobe.
  const compromises = chosen.filter((item) => avoidCategories?.includes(item.category));
  if (compromises.length) {
    warnings.push(
      `You do not own anything better suited than ${compromises
        .map((item) => item.name.toLowerCase())
        .join(' and ')} for this.`,
    );
  }

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
  const reading = formatTemperatureLong(temperature, context.units ?? 'metric');
  const weatherNote =
    neededWarmth === 0
      ? `At ${reading} the priority is staying cool, so nothing heavy.`
      : layers.length
        ? `${layers.map((item) => item.name).join(' and ')} covers the ${reading}.`
        : `Light enough for ${reading} — add a layer if you will be out after dark.`;

  const formalityNote = context.request.formality
    ? ` Pitched at ${context.request.formality.replace('-', ' ')}.`
    : '';

  return `${opener} ${weatherNote}${formalityNote}`;
}


/**
 * The other things she could wear in one slot, best first.
 *
 * Includes what is currently on, so stepping forwards and backwards through the
 * list is a simple index move and always lands somewhere sensible.
 */
export function slotAlternatives(
  context: EngineContext,
  currentIds: string[],
  slotItemId: string,
): ClothingItem[] {
  const index = new Map(context.closet.map((item) => [item.id, item]));
  const current = index.get(slotItemId);
  if (!current) return [];

  const slot = slotOf(current.category);
  const position = accessoryPosition(current.category);
  const otherSlots = currentIds.filter((id) => id !== slotItemId);
  const temperature = context.weather?.temperature ?? context.request.temperature ?? 18;

  return context.closet
    .filter((item) => slotOf(item.category) === slot)
    // Within accessories, only things worn in the same place are alternatives.
    .filter((item) => slot !== 'accessory' || accessoryPosition(item.category) === position)
    .filter((item) => !item.archived)
    .filter((item) => !otherSlots.includes(item.id))
    .filter((item) => (context.request.cleanOnly ? item.laundry === 'clean' : true))
    .filter((item) => !context.request.excludeItemIds.includes(item.id))
    .map((item) => ({ item, score: scoreItem(item, context, temperature) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * Step one slot forwards or backwards and leave the rest of the outfit alone.
 *
 * Rerolling everything to change the shoes throws away the four pieces she
 * liked. The list wraps, so there is always somewhere to go and never a dead
 * arrow — and with only one garment in a slot it simply stays put.
 */
export function cycleSlot(
  context: EngineContext,
  currentIds: string[],
  slotItemId: string,
  direction: 1 | -1,
): string[] {
  const options = slotAlternatives(context, currentIds, slotItemId);
  if (options.length < 2) return currentIds;

  const at = options.findIndex((item) => item.id === slotItemId);
  const next = options[(at + direction + options.length) % options.length];

  return currentIds.map((id) => (id === slotItemId ? next.id : id));
}
