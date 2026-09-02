import type { ClothingItem, OutfitRequest } from '@/types';

import { scoreOutfit, type FitRule } from './fitScore';
import { buildOutfitLocally } from './outfitEngine';
import { slotOf } from './taxonomy';

/**
 * How the wardrobe scores, not just today's outfit.
 *
 * The Fit Score judges one outfit at a time, which answers "is this good" and
 * never "why is getting dressed hard on Tuesdays". Those are different
 * questions and the second one is the more useful: it is a fact about the
 * wardrobe rather than about a morning, and it is the only one somebody can
 * actually act on when they are next in a shop.
 *
 * So: dress the wardrobe against itself. Every plausible pairing of the pieces
 * that set an outfit's register, scored the same way the home screen scores
 * today, and then read backwards — which pairs come out best, which pieces lift
 * whatever they are put with, and which ones are simply harder to place.
 *
 * Two rules of tone, which are also rules of accuracy:
 *
 * - **A piece is never called bad.** "Harder to place" is the true statement:
 *   a garment scores low because of what is *around* it in this particular
 *   wardrobe, and the same jacket in a different closet would score fine. The
 *   report names the rule that keeps firing, so the reading is "nothing here
 *   anchors it" rather than "this was a mistake".
 * - **It says how many outfits it looked at.** A verdict on three samples is an
 *   anecdote. The count travels with the number so nobody has to guess.
 */

/**
 * How many pieces from each end are put through the mill.
 *
 * The pairing is quadratic, so this is the knob that keeps a hundred-piece
 * wardrobe from becoming ten thousand outfit builds. Twelve of each is a
 * hundred and forty-four, which runs in a blink and is comfortably enough for
 * every piece in the sample to appear often enough to say something about.
 */
const PER_SIDE = 12;

/** Below this many appearances the number is an anecdote, and is not shown. */
const MIN_APPEARANCES = 3;

export interface PairScore {
  itemIds: [string, string];
  score: number;
}

export interface ItemStanding {
  itemId: string;
  /** Mean score of the sampled outfits this piece appeared in. */
  average: number;
  /** How far that sits above or below the wardrobe's own average. */
  delta: number;
  appearances: number;
  /**
   * The deduction that fires around this piece notably more than it fires
   * elsewhere in the wardrobe. Absent when nothing stands out — see the note on
   * the baseline below for why "most common" was the wrong question.
   */
  commonReason?: string;
}

export interface WardrobeReport {
  /** Mean over every outfit sampled. */
  average: number;
  samples: number;
  best: PairScore[];
  lifting: ItemStanding[];
  harder: ItemStanding[];
  /** Set when the wardrobe is too small to say anything worth saying. */
  note?: string;
}

const REQUEST: OutfitRequest = {
  prompt: 'Anything',
  includeItemIds: [],
  excludeItemIds: [],
  // The laundry is a fact about this week, and this is a question about the
  // wardrobe. A jumper in the wash is still a jumper you own.
  cleanOnly: false,
};

export function readWardrobeReport(items: ClothingItem[]): WardrobeReport {
  const closet = items.filter((item) => !item.archived);
  const index = new Map(closet.map((item) => [item.id, item]));

  const tops = pick(closet, ['top']);
  const bottoms = pick(closet, ['bottom']);
  const onePiece = pick(closet, ['fullbody']);

  const pairs: [ClothingItem, ClothingItem | null][] = [];
  tops.forEach((top) => bottoms.forEach((bottom) => pairs.push([top, bottom])));
  // A dress is its own pairing: there is no bottom to put it with.
  onePiece.forEach((piece) => pairs.push([piece, null]));

  if (pairs.length < MIN_APPEARANCES) {
    return {
      average: 0,
      samples: 0,
      best: [],
      lifting: [],
      harder: [],
      note: 'Not enough to dress against itself yet — a few tops and a few bottoms and this fills in.',
    };
  }

  const samples: { itemIds: string[]; score: number; deductions: FitRule[] }[] = [];

  pairs.forEach(([first, second]) => {
    const include = second ? [first.id, second.id] : [first.id];
    const built = buildOutfitLocally({
      request: { ...REQUEST, includeItemIds: include },
      closet,
    });
    const worn = built.itemIds
      .map((id) => index.get(id))
      .filter((item): item is ClothingItem => Boolean(item));
    if (worn.length < 2) return;

    const report = scoreOutfit(worn);
    // An incomplete outfit scores nothing, and averaging that zero in would
    // report a wardrobe with no shoes in it as uniformly terrible rather than
    // as short of shoes.
    if (!report.complete) return;
    samples.push({
      itemIds: built.itemIds,
      score: report.score,
      deductions: report.deductions.map((note) => note.rule),
    });
  });

  if (samples.length === 0) {
    return {
      average: 0,
      samples: 0,
      best: [],
      lifting: [],
      harder: [],
      note: 'Nothing here makes a whole outfit yet. A top, a bottom and a pair of shoes is the minimum.',
    };
  }

  const average = mean(samples.map((sample) => sample.score));

  /*
   * How often each rule fires across the whole wardrobe.
   *
   * The baseline is what makes a reason a reason. A closet with no jackets and
   * no real jewellery loses the third-piece mark on EVERY outfit, so naming it
   * against one particular garment says nothing about that garment — it is a
   * fact about the wardrobe, and it was the first thing this reported before
   * the comparison went in. What earns a mention is a rule that fires more
   * around this piece than it does everywhere else.
   */
  const baseline = new Map<FitRule, number>();
  samples.forEach((sample) => {
    new Set(sample.deductions).forEach((rule) =>
      baseline.set(rule, (baseline.get(rule) ?? 0) + 1),
    );
  });

  /* Every piece that appeared, and how the outfits around it went. */
  const standing = new Map<string, { total: number; count: number; reasons: Map<FitRule, number> }>();
  samples.forEach((sample) => {
    sample.itemIds.forEach((id) => {
      const entry = standing.get(id) ?? { total: 0, count: 0, reasons: new Map() };
      entry.total += sample.score;
      entry.count += 1;
      new Set(sample.deductions).forEach((rule) =>
        entry.reasons.set(rule, (entry.reasons.get(rule) ?? 0) + 1),
      );
      standing.set(id, entry);
    });
  });

  const standings: ItemStanding[] = [...standing.entries()]
    .filter(([, entry]) => entry.count >= MIN_APPEARANCES)
    .map(([itemId, entry]) => {
      const itemAverage = entry.total / entry.count;

      const [rule, excess] = [...entry.reasons.entries()]
        .map(([name, hits]) => {
          const here = hits / entry.count;
          const everywhere = (baseline.get(name) ?? 0) / samples.length;
          return [name, here >= 0.6 ? here - everywhere : 0] as const;
        })
        .sort((a, b) => b[1] - a[1])[0] ?? [];

      return {
        itemId,
        average: Math.round(itemAverage),
        delta: Math.round(itemAverage - average),
        appearances: entry.count,
        // It has to fire around this piece most of the time AND meaningfully
        // more than it fires elsewhere. Otherwise there is no reason worth
        // giving, and the number stands on its own.
        commonReason: rule && excess >= 0.25 ? REASON[rule] : undefined,
      };
    });

  const bestPairs = samples
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((sample) => ({
      itemIds: [sample.itemIds[0], sample.itemIds[1]] as [string, string],
      score: sample.score,
    }))
    .slice(0, 5);

  return {
    average: Math.round(average),
    samples: samples.length,
    best: bestPairs,
    lifting: standings
      .filter((entry) => entry.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4),
    harder: standings
      .filter((entry) => entry.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 4),
  };
}

/**
 * Why a piece keeps scoring low, in words that blame the wardrobe rather than
 * the garment — which is also the accurate reading, since every one of these is
 * a statement about what the piece was put NEXT to.
 */
const REASON: Record<FitRule, string> = {
  anchor: 'usually because there is nothing neutral here to anchor it',
  volume: 'usually because what it gets paired with is the same shape',
  waistline: 'usually because it cuts the line in half with what it is worn over',
  pattern: 'usually because it lands next to another print of the same size',
  'third-piece': 'usually because the outfits round it stop at three pieces',
  matchy: 'usually because everything near it is the same colour',
  metals: 'usually because the jewellery around it does not repeat its metal',
  register: 'usually because it is dressier or plainer than what it goes with',
};

/** The most-worn pieces in a set of slots, capped so the pairing stays cheap. */
function pick(closet: ClothingItem[], slots: string[]): ClothingItem[] {
  return closet
    .filter((item) => slots.includes(slotOf(item.category)))
    .sort((a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name))
    .slice(0, PER_SIDE);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
