import type {
  Category,
  ClothingItem,
  Metal,
  GeneratedOutfit,
  OutfitRequest,
  Season,
  Slot,
  Style,
  Units,
  WeatherSnapshot,
} from '@/types';

import { analyzeHarmony, hexForColorName } from './color';
import { AFFINITY_WEIGHT } from './taste';
import {
  ACCESSORY_FOCAL_BUDGET,
  accessoryFocalWeight,
  accessoryPosition,
  categoryMeta,
  formalityScore,
  slotOf,
} from './taxonomy';
import { currentSeason } from '@/lib/date';
import { formatTemperatureLong, titleCase } from '@/lib/format';

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
  /**
   * What the wearer has actually reached for, −1 to 1 per item.
   *
   * A nudge and nothing more — see AFFINITY_WEIGHT and the note at the top of
   * domain/taste. It must never be able to outvote the weather, the occasion or
   * the laundry, because those are facts and this is an inference drawn from a
   * few taps.
   */
  affinity?: Map<string, number>;
  /**
   * Today, as YYYY-MM-DD, for judging how recently a piece was worn.
   *
   * Passed in rather than read from the clock so the engine stays pure and a
   * test can sit on any date it likes. Absent, nothing is treated as recent.
   */
  today?: string;
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
  /*
   * Nothing is needed above twenty. This used to be twenty-four, which is fine
   * for separates — a shirt and trousers already carry two — and wrong for
   * anything light: a dress and a pair of shoes carry nothing at all, so the
   * arithmetic said a twenty-degree wedding was a point short and a chunky
   * oatmeal jumper went on over a black silk wrap dress.
   */
  if (temperatureC >= 20) return 0;
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

/**
 * The least an accessory can score and still be worth putting on.
 *
 * Every garment starts at fifty, so this is "mildly wrong for the occasion or
 * the weather, and no worse". Below it the piece is being worn because there
 * was room rather than because it belongs.
 */
const ACCESSORY_FLOOR = 45;

function scoreItem(item: ClothingItem, context: EngineContext, temperature: number): number {
  const { request } = context;
  let score = 50;

  /*
   * Seasonality — but the thermometer outranks the calendar at the extremes.
   *
   * The season came from the clock and moved the score by ten points, which is
   * nothing next to the rest of the scorer. On a thirty-one degree day in
   * September that produced a long-sleeved top and fleece joggers, because both
   * are autumn garments and autumn is what the calendar said. Nobody has ever
   * dressed for the month over the weather.
   *
   * In the mild middle the calendar genuinely knows better — sixteen degrees in
   * March and sixteen in October ask for different things — so it only takes
   * over when the temperature has stopped being ambiguous.
   */
  const decisive = decisiveSeason(temperature);
  const season = decisive ?? context.season ?? currentSeason();
  if (item.seasons.includes(season)) score += 10;
  else if (item.seasons.length > 0) score -= decisive ? 30 : 8;

  /*
   * Formality proximity — one step away is fine, three steps is not.
   *
   * There is a default now, and it matters more than it looks. With no occasion
   * stated this term was skipped ENTIRELY, so nothing anywhere preferred
   * everyday clothes to formal ones — and the outfit for an ordinary Tuesday
   * came back as dress trousers and heeled pumps. Internally consistent, thanks
   * to the clash penalty, and absurd. Somebody who has not said where they are
   * going is going about their day.
   *
   * The pull is the same strength either way. It was gentler for the inferred
   * case at first, on the reasoning that a blazer on a Tuesday is a choice
   * somebody might make — but half a step of slack was enough to put fleece
   * joggers under a pair of suede boots for an ordinary day out, and "I did not
   * say where I am going" much more often means going out than staying in.
   */
  const target = request.formality ?? 'casual';
  const distance = Math.abs(formalityScore(item.formality) - formalityScore(target));
  score += Math.max(-24, 12 - distance * 8);

  // Style match.
  const wantedStyle = request.style ? [request.style] : (context.preferredStyles ?? []);
  if (wantedStyle.length) {
    score += item.styles.some((style) => wantedStyle.includes(style)) ? 12 : -6;
  }

  // Warmth suitability for the individual piece.
  const warmth = categoryMeta(item.category).warmth;
  const slot = slotOf(item.category);
  if (temperature >= 24 && warmth >= 2) score -= 25;
  // Fleece joggers are not a two-warmth garment and were sailing through.
  if (temperature >= 27 && warmth >= 1) score -= 22;
  if (temperature <= 6 && warmth === 0 && slot !== 'accessory') score -= 8;

  /*
   * A wool scarf is not a mild preference in June.
   *
   * Accessories were exempt from the warm-weather rule and only judged above
   * 24°C, so a burgundy wool scarf came out for a nineteen-degree trip to the
   * gym. It is the one accessory nobody wears for the look alone.
   */
  if (slot === 'accessory' && warmth >= 2 && temperature >= 15) score -= 40;

  /*
   * Sunglasses are worn for the sun, and the engine had no idea.
   *
   * They were offered for dinner at fourteen degrees in the evening — which is
   * the sort of detail that makes somebody stop trusting the whole screen, the
   * way one wrong word in a paragraph does.
   */
  if (item.category === 'sunglasses' && temperature < 18) score -= 60;

  /*
   * Shoes are where the weather is felt first, and the old rule barely noticed.
   * Heeled pumps came out at minus two degrees, and sandals were one bad day
   * away from doing the same.
   */
  if (slot === 'footwear') {
    if (temperature <= 4 && warmth === 0) score -= 45;
    if (temperature <= 12 && item.category === 'sandals') score -= 120;
    if (temperature >= 26 && warmth >= 2) score -= 45;
  }

  // Colour preferences.
  const colorText = [item.primaryColor, ...item.secondaryColors].join(' ').toLowerCase();
  if (request.colorPreference) {
    const wanted = request.colorPreference.toLowerCase();
    if (colorText.includes(wanted)) score += 18;
  }
  if (context.avoidColors?.some((color) => colorText.includes(color.toLowerCase()))) score -= 30;

  // What they have actually reached for, when there is enough to go on.
  const affinity = context.affinity?.get(item.id);
  if (affinity) score += affinity * AFFINITY_WEIGHT;

  // Nudge towards favourites.
  if (item.favorite) score += 8;

  /*
   * How much a garment has been worn used to be a straight PENALTY, capped at
   * twelve, and it quietly inverted the whole wardrobe. A white tee worn
   * forty-two times and marked a favourite scored -12 +8 = -4; a purple satin
   * shirt bought once and regretted scored -0.6. The regretted shirt started
   * three and a half points ahead of the favourite, which is more than the
   * seasonality bonus and enough to decide almost every slot — so the app
   * systematically dressed somebody in the clothes they had proved they do not
   * wear. On a real forty-piece wardrobe that one shirt appeared in seven of
   * ten outfits.
   *
   * Wear count is EVIDENCE, not a debt. It says the garment works. What stops
   * the same three pieces every day is not pretending the favourites are worn
   * out — it is remembering when they were last on, which is a different fact
   * and the one that was missing.
   */
  score += Math.min(4, Math.log1p(Math.max(0, item.wearCount)) * 1.1);
  score -= recencyPenalty(item, context.today);

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

/**
 * How recently it was on, which is the honest way to get variety.
 *
 * Yesterday's shirt is the one thing somebody genuinely does not want offered
 * again this morning, and it has nothing to do with whether they like it. Big
 * enough to lose a slot to any fresh alternative, small enough that a wardrobe
 * with one jumper still gets the jumper.
 */
/**
 * The season the weather is actually insisting on, or null while it is mild.
 *
 * Deliberately narrow. Between about seven and twenty-four degrees the month is
 * the better guide — a mild March day and a mild October day want different
 * clothes and the thermometer cannot tell them apart.
 */
function decisiveSeason(temperature: number): Season | null {
  if (temperature >= 25) return 'summer';
  if (temperature <= 6) return 'winter';
  return null;
}

function recencyPenalty(item: ClothingItem, today?: string): number {
  if (!today || !item.lastWornAt) return 0;
  const worn = Date.parse(item.lastWornAt);
  const now = Date.parse(`${today}T12:00:00`);
  if (Number.isNaN(worn) || Number.isNaN(now)) return 0;

  const days = Math.floor((now - worn) / 86_400_000);
  if (days < 0) return 0;
  if (days <= 1) return 45;
  if (days <= 3) return 18;
  if (days <= 7) return 6;
  return 0;
}

function bestBySlot(candidates: ScoredItem[], slot: Slot): ScoredItem | undefined {
  return candidates
    .filter((entry) => slotOf(entry.item.category) === slot)
    .sort((a, b) => b.score - a.score)[0];
}

/**
 * Bonus for a candidate that harmonises with what has already been chosen.
 *
 * Clamped, because colour is a tie-breaker between comparable garments and not
 * a reason to choose one garment over another. Unclamped it ranged from about
 * -20 to +13 — wider than a whole step of formality — and it was deciding
 * slots: grey sits against navy with more contrast than black does, so a pair
 * of fleece joggers beat a pair of jeans for an ordinary day out on the
 * strength of a lightness spread. The garment being right for where somebody is
 * going is a fact about the occasion; this is a nuance about two hexes.
 */
function harmonyBonus(candidate: ClothingItem, chosen: ClothingItem[]): number {
  if (chosen.length === 0) return 0;
  const hexes = [...chosen, candidate].map(
    (item) => item.primaryColorHex || hexForColorName(item.primaryColor),
  );
  const report = analyzeHarmony(hexes);
  return Math.max(-4, Math.min(4, (report.score - 60) / 5));
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

/** Every option for a slot, best first — the ranked list pickForSlot tops. */
function slotAlternativesFor(
  slot: Slot,
  candidates: ScoredItem[],
  chosen: ClothingItem[],
  used: Set<string>,
): ClothingItem[] {
  return candidates
    .filter((entry) => slotOf(entry.item.category) === slot && !used.has(entry.item.id))
    .map((entry) => ({
      ...entry,
      score:
        entry.score + harmonyBonus(entry.item, chosen) + formalityClashPenalty(entry.item, chosen),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
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
  /*
   * A dress replaces a top AND a bottom, so it is compared against both.
   *
   * It used to have to beat the best top by fifteen points on its own, which is
   * a hurdle nothing clears: a formal dress lost a wedding to an Oxford shirt
   * by five and a half. Comparing like with like — one garment against the pair
   * it stands in for — is both fairer and the actual question, and it needs no
   * margin on top: any margin is a thumb on the scale against dresses, and the
   * formality term already keeps one off an ordinary Tuesday.
   */
  const bestBottom = bestBySlot(scored, 'bottom');
  const separates =
    bestTop && bestBottom
      ? (bestTop.score + bestBottom.score) / 2
      : (bestTop?.score ?? bestBottom?.score ?? -Infinity);
  const useFullbody =
    Boolean(forcedFullbody) ||
    (bestFullbody != null && (bestTop == null || bestFullbody.score > separates));

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

  /**
   * Add a layer, working down the options rather than taking one or giving up.
   *
   * It used to consider only the best candidate and abandon the slot if that
   * one was unsuitable — so a rule that turned down a wool coat sent somebody
   * out at minus two degrees with no coat at all, which is very much worse than
   * whatever the rule was protecting them from. Skipping a candidate has to
   * mean trying the next one.
   */
  const takeLayer = (slot: Slot) => {
    const options = slotAlternativesFor(slot, scored, chosen, used);

    for (const candidate of options) {
      if (layerWouldClash(candidate, chosen, temperature)) continue;
      /*
       * A layer is optional, so it must never be the reason a wrong garment
       * gets worn. Top, bottom and shoes fall back to whatever exists — better
       * the wrong shoes than none — but nobody needs a blazer to go running.
       */
      if (context.avoidCategories?.includes(candidate.category)) continue;

      /*
       * And do not reach for a jumper to close a one-point gap in mild weather.
       * Above sixteen degrees a layer has to be roughly the size of the
       * shortfall, or it is not the answer to it.
       */
      const gap = needed - warmthOf(chosen);
      if (temperature >= 17 && categoryMeta(candidate.category).warmth > gap) continue;

      take(candidate);
      return;
    }
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

  /*
   * How much jewellery the occasion can carry.
   *
   * Three focal points is the rule for an outfit somebody is dressing FOR. It
   * is not the rule for the gym, and the budget did not know the difference —
   * so a trip to the gym came back with a wool scarf, gold hoops, a signet ring
   * and a leather belt. Nobody accessorises to run.
   *
   * Read off what is already on the body rather than off the request, because
   * the register of the actual clothes is the more reliable statement of what
   * this is: somebody in joggers is not at a wedding whatever they typed.
   */
  const register = chosen.filter((item) => REGISTER_SLOTS.includes(slotOf(item.category)));
  /*
   * What was ASKED for, where anything was, and otherwise the dressiest thing
   * on the body.
   *
   * Reading it off the least dressy garment turned out to be too harsh: one
   * pair of joggers in an otherwise ordinary outfit capped the whole thing at a
   * single focal point, so a favourite gold chain never came out. What somebody
   * typed is the better statement of what this is — "the gym" caps it whatever
   * they are wearing — and with nothing typed, the dressiest piece is the one
   * saying what the outfit is aiming at.
   */
  const dressiness = request.formality
    ? formalityScore(request.formality)
    : register.length
      ? Math.max(...register.map((item) => formalityScore(item.formality)))
      : 1;
  // Only the very-casual end is capped. Casual daywear genuinely carries three
  // focal points — sunglasses, a chain, a watch and a belt is what a great many
  // people wear to do the shopping — and the problem this fixes was the gym.
  const budget = dressiness <= 0 ? 1 : ACCESSORY_FOCAL_BUDGET;

  let focal = chosen
    .filter((item) => slotOf(item.category) === 'accessory')
    .reduce((total, item) => total + accessoryFocalWeight(item.category), 0);

  /*
   * Picked one at a time rather than in one sorted pass, so that each choice
   * can see the ones before it.
   *
   * The scorer marks an outfit down for wearing one gold thing and one silver
   * thing, and the builder had no idea — so it assembled exactly that
   * combination and then the card explained why it was wrong. An engine and a
   * critic that disagree is worse than either alone: it reads as the app
   * arguing with itself.
   */
  const remaining = scored.filter(
    (entry) => slotOf(entry.item.category) === 'accessory' && !used.has(entry.item.id),
  );

  for (;;) {
    const metalsOn = new Set(
      chosen.map((item) => item.metal).filter((metal): metal is Metal => Boolean(metal)),
    );

    const next = remaining
      .filter((entry) => !used.has(entry.item.id))
      .filter((entry) => !takenPositions.has(accessoryPosition(entry.item.category)))
      .filter((entry) => focal + accessoryFocalWeight(entry.item.category) <= budget)
      /*
       * An accessory has to be worth wearing, not merely affordable.
       *
       * The loop took the best remaining thing that fit the budget, which is
       * not the same test — so a pair of sunglasses carrying a sixty-point
       * penalty for a fourteen-degree evening was still the best thing left for
       * the eyes, and went to dinner. A budget is a ceiling, never a quota.
       */
      .filter((entry) => entry.score >= ACCESSORY_FLOOR)
      .map((entry) => ({
        entry,
        // Matching what is already on wins ties and a little more; it never
        // outweighs the piece being right for the occasion.
        score:
          entry.score +
          (entry.item.metal && metalsOn.size > 0 && metalsOn.has(entry.item.metal) ? 14 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!next) break;
    takenPositions.add(accessoryPosition(next.entry.item.category));
    focal += accessoryFocalWeight(next.entry.item.category);
    take(next.entry.item);
  }

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

/**
 * What to call it.
 *
 * This used to return "Everyday navy" — a category label with a colour stuck on
 * the end, which is a fine thing to file under and a poor thing to lead a home
 * screen with. The engine already knows the hero piece, what is underneath it
 * and what the weather is doing; that is enough for a name that describes THIS
 * outfit rather than the class of outfits it belongs to. Still deterministic:
 * the same closet and the same day give the same name, so nothing shifts under
 * a re-render.
 */
function localName(
  chosen: ClothingItem[],
  request: OutfitRequest,
  temperature: number,
): string {
  if (request.occasion) return `${request.occasion} look`;

  const hero = chosen.find((item) => ['top', 'fullbody'].includes(slotOf(item.category)));
  const bottom = chosen.find((item) => slotOf(item.category) === 'bottom');
  const layer = chosen.find((item) =>
    ['outerwear', 'midlayer'].includes(slotOf(item.category)),
  );

  if (!hero) return 'Something for today';
  const colour = titleCase(hero.primaryColor);

  if (temperature <= 4) return `${colour}, wrapped up`;
  if (temperature >= 27) return `${colour}, and not much of it`;
  if (layer) return `${colour} under the ${layer.primaryColor.toLowerCase()}`;
  if (bottom && bottom.primaryColor.toLowerCase() !== hero.primaryColor.toLowerCase()) {
    return `${colour} over ${bottom.primaryColor.toLowerCase()}`;
  }
  return `${colour}, head to toe`;
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
