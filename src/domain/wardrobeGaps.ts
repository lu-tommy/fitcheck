import type { ClothingItem } from '@/types';

import { hasFit, hasLength, hasRise, slotOf } from './taxonomy';

/**
 * The to-do list the Fit Score wrote for itself.
 *
 * Seven rules judge an outfit, and three of them cannot run without facts the
 * wardrobe does not hold yet — how a garment fits, where it ends, where it
 * sits. The score is honest about that: it says "say how the indigo jeans fit
 * and the proportions can be judged" instead of scoring against a guess.
 *
 * Which leaves somebody holding a request and no way to act on it. A rule that
 * reports what it is missing and then offers no route to supplying it is worse
 * than one that stayed quiet, because it turns every outfit into a reminder of
 * a chore with no beginning.
 *
 * So: which garments to ask about, in what order, and how close each rule is to
 * being able to run at all.
 *
 * **Nothing here guesses the answers.** A garment's cut was briefly a candidate
 * for inference — the silhouette module already measures how a mask narrows at
 * the waist, and a boxy tee laid flat really does differ from a tapered one.
 * It does not survive contact with where cut-outs now come from: the parser
 * reads a garment being WORN, so the outline is the shape of the person inside
 * it and the difference between fitted and oversized is drape rather than
 * width. Guessing from that would put wrong facts in a closet and quietly
 * corrupt the very rules this exists to unblock. The answer is to make asking
 * cheap, not to stop asking.
 */

export type ShapeField = 'fit' | 'length' | 'rise' | 'patternScale';

export const SHAPE_FIELD_LABEL: Record<ShapeField, string> = {
  fit: 'How it fits',
  length: 'Where it ends',
  rise: 'Where it sits',
  patternScale: 'How big the print is',
};

/** Which rule each fact unblocks, so the ask can say what it buys. */
export const FIELD_UNLOCKS: Record<ShapeField, string> = {
  fit: 'proportion',
  length: 'the waistline',
  rise: 'the waistline',
  patternScale: 'pattern mixing',
};

export interface ShapeGap {
  item: ClothingItem;
  missing: ShapeField[];
  /** How much answering is worth, for ordering. Never shown as a number. */
  weight: number;
}

export interface FieldCoverage {
  field: ShapeField;
  /** Weighted share of the garments this question applies to that answered it. */
  share: number;
  /** How many garments still owe an answer. */
  outstanding: number;
}

export interface ShapeGapReport {
  /** Worth asking about, most useful first. */
  queue: ShapeGap[];
  coverage: FieldCoverage[];
  /** One line, factual, for the top of a card. */
  headline: string;
}

/**
 * How much a garment's answer is worth.
 *
 * Not every gap is equal, and a queue that ignores that asks somebody about a
 * scarf they wore once in 2024 before the jeans they live in. Three things
 * decide it: whether the garment sets the outfit's proportions at all, how much
 * it is actually worn, and whether they have already said they like it.
 */
const SLOT_WEIGHT: Record<string, number> = {
  top: 1,
  bottom: 1,
  fullbody: 1,
  midlayer: 0.7,
  outerwear: 0.7,
  footwear: 0.3,
  headwear: 0.2,
  accessory: 0.2,
};

export function gapWeight(item: ClothingItem): number {
  const base = SLOT_WEIGHT[slotOf(item.category)] ?? 0.2;
  // Logarithmic, so a piece worn forty times outranks one worn four without
  // burying everything else beneath it.
  const worn = 1 + Math.log1p(Math.max(0, item.wearCount));
  return base * worn * (item.favorite ? 1.3 : 1);
}

/** The questions this garment can answer and has not. */
export function missingFields(item: ClothingItem): ShapeField[] {
  const missing: ShapeField[] = [];
  if (hasFit(item.category) && !item.fit) missing.push('fit');
  if (hasLength(item.category) && !item.length) missing.push('length');
  if (hasRise(item.category) && !item.rise) missing.push('rise');
  // Only a garment with a print on it has a print size.
  if (item.pattern !== 'solid' && !item.patternScale) missing.push('patternScale');
  return missing;
}

/** Which garments a question even applies to — a hat is never asked its rise. */
function applies(item: ClothingItem, field: ShapeField): boolean {
  if (field === 'fit') return hasFit(item.category);
  if (field === 'length') return hasLength(item.category);
  if (field === 'rise') return hasRise(item.category);
  return item.pattern !== 'solid';
}

const FIELDS: ShapeField[] = ['fit', 'length', 'rise', 'patternScale'];

export function readShapeGaps(items: ClothingItem[]): ShapeGapReport {
  const live = items.filter((item) => !item.archived);

  const queue: ShapeGap[] = live
    .map((item) => ({ item, missing: missingFields(item), weight: gapWeight(item) }))
    .filter((entry) => entry.missing.length > 0)
    .sort((a, b) => b.weight - a.weight || a.item.name.localeCompare(b.item.name));

  const coverage: FieldCoverage[] = FIELDS.map((field) => {
    const relevant = live.filter((item) => applies(item, field));
    const total = relevant.reduce((sum, item) => sum + gapWeight(item), 0);
    const answered = relevant
      .filter((item) => !missingFields(item).includes(field))
      .reduce((sum, item) => sum + gapWeight(item), 0);
    return {
      field,
      // A question nobody in the wardrobe can answer is fully covered rather
      // than zero: there is nothing outstanding, so nothing to nag about.
      share: total > 0 ? answered / total : 1,
      outstanding: relevant.filter((item) => missingFields(item).includes(field)).length,
    };
  });

  return { queue, coverage, headline: headlineFor(queue, coverage) };
}

/**
 * What to say at the top.
 *
 * Counts, never adjectives. "Almost there" tells nobody whether to spend the
 * next two minutes on it; "the four you wear most are first" does.
 */
function headlineFor(queue: ShapeGap[], coverage: FieldCoverage[]): string {
  if (queue.length === 0) {
    return 'Every garment has answered. Nothing is holding the score back.';
  }

  const weakest = coverage
    .filter((entry) => entry.outstanding > 0)
    .sort((a, b) => a.share - b.share)[0];

  const unlocks = weakest ? FIELD_UNLOCKS[weakest.field] : 'the score';
  const many = queue.length === 1 ? '1 garment has' : `${queue.length} garments have`;

  return `${many} something left to say. Answering them lets the score judge ${unlocks}; the ones you wear most come first.`;
}

/**
 * How far through the wardrobe somebody is, as a share.
 *
 * Weighted the same way the queue is ordered, so answering the jeans you live
 * in moves it further than answering a scarf — which is true, and is the whole
 * reason the queue is ordered at all.
 */
export function shapeProgress(items: ClothingItem[]): number {
  const live = items.filter((item) => !item.archived);
  let total = 0;
  let done = 0;
  live.forEach((item) => {
    const asked = FIELDS.filter((field) => applies(item, field));
    if (asked.length === 0) return;
    const weight = gapWeight(item);
    const missing = missingFields(item);
    total += weight * asked.length;
    done += weight * (asked.length - missing.length);
  });
  return total > 0 ? done / total : 1;
}
