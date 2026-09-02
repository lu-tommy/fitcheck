import type { Category, Slot } from '@/types';

/**
 * Turning a segmentation mask into garments somebody can confirm.
 *
 * Cataloguing is where wardrobe apps lose their users — a minute or two a
 * garment, two or three hours for a real closet, and it is named again and
 * again as the single biggest reason people stop. Boxing pieces by hand is
 * faster than most apps manage and it is still the slow part.
 *
 * A human-parsing model gets one photograph and returns a labelled region for
 * every garment in it at once, which turns "draw five boxes and pick five
 * categories" into "confirm five chips". This module is the half of that with
 * no model in it: given a label map, which regions are garments, where each one
 * is, and how much the label should be believed.
 *
 * It is here in `domain/` rather than beside the loader on purpose. Everything
 * below is arithmetic over an array of class ids — it can be tested against a
 * mask drawn by hand, it holds the judgements that decide what somebody sees,
 * and it does not care whether the numbers came from a 27 MB model, a smaller
 * one later, or a fixture.
 */

/**
 * The eighteen classes the ATR-trained model emits, in its own words.
 *
 * Seven of them are the person wearing the clothes. That is not a shortcoming
 * of the model — being able to separate an arm from a sleeve is exactly why it
 * can cut a garment out of a mirror selfie, which is the photograph people
 * actually have and the one the flood-fill cutout cannot read at all.
 */
export const ATR_LABELS = [
  'Background',
  'Hat',
  'Hair',
  'Sunglasses',
  'Upper-clothes',
  'Skirt',
  'Pants',
  'Dress',
  'Belt',
  'Left-shoe',
  'Right-shoe',
  'Face',
  'Left-leg',
  'Right-leg',
  'Left-arm',
  'Right-arm',
  'Bag',
  'Scarf',
] as const;

export interface GarmentClass {
  id: number;
  /** What the model calls it. */
  label: string;
  slot: Slot;
  /**
   * The least surprising member of that slot, offered as a starting point and
   * never asserted — the same rule domain/silhouette follows. "Upper-clothes"
   * genuinely cannot tell a t-shirt from a polo from a blouse, and pretending
   * otherwise puts a wrong word in somebody's closet that they then have to
   * find and correct.
   */
  category: Category;
  /**
   * How much the label itself is worth, before anything about this particular
   * photo is taken into account.
   *
   * These are the model's own published per-class accuracies, rounded down.
   * They vary enormously — a belt is a thin strip that shares its colour with
   * the trousers behind it and lands around 35%, while a dress covers half the
   * frame — and a screen that showed all ten guesses with equal confidence
   * would be lying about seven of them.
   */
  reliability: number;
  /**
   * Classes folded into this one. A left shoe and a right shoe are a pair, and
   * a pair is one thing you own; two entries would mean two closet items and
   * two photographs of the same shoes.
   */
  absorbs?: number[];
}

export const GARMENT_CLASSES: GarmentClass[] = [
  { id: 1, label: 'Hat', slot: 'headwear', category: 'cap', reliability: 0.72 },
  { id: 3, label: 'Sunglasses', slot: 'accessory', category: 'sunglasses', reliability: 0.7 },
  { id: 4, label: 'Upper-clothes', slot: 'top', category: 'tshirt', reliability: 0.88 },
  { id: 5, label: 'Skirt', slot: 'bottom', category: 'skirt', reliability: 0.78 },
  { id: 6, label: 'Pants', slot: 'bottom', category: 'jeans', reliability: 0.86 },
  { id: 7, label: 'Dress', slot: 'fullbody', category: 'dress', reliability: 0.8 },
  { id: 8, label: 'Belt', slot: 'accessory', category: 'belt', reliability: 0.35 },
  { id: 9, label: 'Shoes', slot: 'footwear', category: 'sneakers', reliability: 0.82, absorbs: [10] },
  { id: 16, label: 'Bag', slot: 'accessory', category: 'bag', reliability: 0.74 },
  { id: 17, label: 'Scarf', slot: 'accessory', category: 'scarf', reliability: 0.63 },
];

const CLASS_INDEX = new Map<number, GarmentClass>();
GARMENT_CLASSES.forEach((entry) => {
  CLASS_INDEX.set(entry.id, entry);
  entry.absorbs?.forEach((id) => CLASS_INDEX.set(id, entry));
});

/** The class a pixel belongs to, once shoes have been folded into a pair. */
export function garmentClassFor(classId: number): GarmentClass | undefined {
  return CLASS_INDEX.get(classId);
}

/**
 * Below this the guess is offered but nothing is preselected — the same
 * threshold domain/silhouette uses, because it is the same promise: a wrong
 * word in a closet costs more than an empty field.
 */
export const PARSE_CONFIDENT = 0.6;

/**
 * The smallest share of the photo a region can cover and still be a garment.
 *
 * A belt across a waist is genuinely tiny, so this cannot be raised much; below
 * it, what is being measured is the ragged edge where the model was unsure,
 * not a thing anybody owns.
 */
const MIN_COVERAGE = 0.003;

/**
 * How far the box is grown past the mask, as a share of its own size.
 *
 * A segmentation edge sits just inside the garment — it is trained to be sure —
 * so a box drawn exactly on it shaves the hem, the shoulder seam and the
 * highlight along a sleeve. A few per cent puts them back without reaching for
 * the wall behind.
 */
const PADDING = 0.04;

/**
 * How much of a region's own bounding box its pixels fill.
 *
 * The number that separates a garment from a misfire. A jumper fills most of
 * its box; a scatter of pixels the model dropped across the whole frame fills
 * almost none of it, and would otherwise produce a confident box around the
 * entire photograph.
 */
const CLEAN_FILL = 0.5;

export interface GarmentRegion {
  classId: number;
  label: string;
  slot: Slot;
  category: Category;
  /** Fractions of the source image, 0–1 — the shape lib/crop already speaks. */
  box: { x: number; y: number; width: number; height: number };
  /** Share of the whole frame the mask covers. */
  coverage: number;
  /** 0–1. How much to trust the CATEGORY. The box is measured, not guessed. */
  confidence: number;
}

/**
 * Every garment in a label map, largest first.
 *
 * `labels` is one class id per pixel, row-major — the argmax the model already
 * computed. Body parts and background are simply not in GARMENT_CLASSES, so
 * they fall out here without needing to be named again.
 */
export function regionsFromLabelMap(
  labels: ArrayLike<number>,
  width: number,
  height: number,
): GarmentRegion[] {
  if (width <= 0 || height <= 0 || labels.length < width * height) return [];
  const total = width * height;

  /*
   * One histogram per axis per class, rather than a list of coordinates.
   *
   * The percentiles below need a distribution and not the points themselves,
   * and pixel coordinates are small bounded integers — so counting them is
   * exact, linear, and costs `width + height` numbers per class instead of two
   * entries for every pixel of every garment in the photograph.
   */
  const stats = new Map<number, { xs: Uint32Array; ys: Uint32Array; pixels: number }>();

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const found = garmentClassFor(labels[row + x]);
      if (!found) continue;
      let entry = stats.get(found.id);
      if (!entry) {
        entry = { xs: new Uint32Array(width), ys: new Uint32Array(height), pixels: 0 };
        stats.set(found.id, entry);
      }
      entry.xs[x] += 1;
      entry.ys[y] += 1;
      entry.pixels += 1;
    }
  }

  const regions: GarmentRegion[] = [];

  stats.forEach((entry, classId) => {
    const meta = garmentClassFor(classId)!;
    const pixels = entry.pixels;
    const coverage = pixels / total;
    if (coverage < MIN_COVERAGE) return;

    /*
     * Percentiles, not min and max.
     *
     * One stray pixel the model put in the far corner drags a min/max box
     * across the whole photograph, and a box like that is worse than no box:
     * it looks deliberate. Trimming the outer 2% of the mask costs a sliver of
     * a real garment and is immune to the handful of pixels that are always
     * wrong somewhere.
     */
    const left = percentile(entry.xs, pixels, 0.02);
    const right = percentile(entry.xs, pixels, 0.98);
    const top = percentile(entry.ys, pixels, 0.02);
    const bottom = percentile(entry.ys, pixels, 0.98);

    const boxWidth = Math.max(1, right - left + 1);
    const boxHeight = Math.max(1, bottom - top + 1);
    const fill = pixels / (boxWidth * boxHeight);

    const padX = boxWidth * PADDING;
    const padY = boxHeight * PADDING;
    const x = clamp01((left - padX) / width);
    const y = clamp01((top - padY) / height);

    regions.push({
      classId: meta.id,
      label: meta.label,
      slot: meta.slot,
      category: meta.category,
      box: {
        x,
        y,
        width: Math.min(1 - x, (boxWidth + padX * 2) / width),
        height: Math.min(1 - y, (boxHeight + padY * 2) / height),
      },
      coverage,
      /*
       * A ragged mask means the model was unsure where the thing was, which is
       * reason to doubt what it called the thing as well — and reason to doubt
       * the box, since a scatter of pixels spans far more of the frame than the
       * garment does.
       *
       * The exponent is what makes that bite. Straight proportion left a mask
       * filling barely a third of its own box still clearing the bar on the
       * strength of the class alone; falling off faster than linear leaves a
       * clean mask untouched and takes a ragged one below the line, which is
       * where it belongs.
       */
      confidence: round2(meta.reliability * Math.min(1, fill / CLEAN_FILL) ** 1.5),
    });
  });

  // Largest first: it is the order somebody reads a photograph in, and it puts
  // the piece they most likely opened the camera for at the top of the list.
  return regions.sort((a, b) => b.coverage - a.coverage);
}

/**
 * Build the label map the function above wants from one binary mask per class.
 *
 * This is the shape an image-segmentation pipeline hands back. The masks are
 * already disjoint — they come from a single argmax — but a later pixel wins
 * regardless, so a model that ever overlapped them could not corrupt the map
 * into something with no owner.
 */
export function labelMapFromMasks(
  masks: { classId: number; data: ArrayLike<number> }[],
  width: number,
  height: number,
): Uint8Array {
  const labels = new Uint8Array(width * height);
  masks.forEach(({ classId, data }) => {
    if (!garmentClassFor(classId)) return;
    const size = Math.min(labels.length, data.length);
    for (let i = 0; i < size; i += 1) {
      if (data[i] > 127) labels[i] = classId;
    }
  });
  return labels;
}

/**
 * What to say about a parse that found nothing.
 *
 * A screen that runs for four seconds and then shows an unchanged photo reads
 * as broken. Saying which of the two things happened — no clothes, or no person
 * — is the difference between a dead end and an instruction.
 */
export function describeEmptyParse(hadAnyMask: boolean): string {
  return hadAnyMask
    ? 'It found a person but nothing it could name as a garment. Draw the boxes by hand — that always works.'
    : 'Nothing garment-shaped in this one. It reads photos of somebody wearing clothes; for a flat lay on a bed, draw the boxes by hand.';
}

/* --------------------------------------------------------------- helpers -- */

/**
 * Where the nth percentile of a coordinate histogram falls.
 *
 * Walks the counts until the requested share of the mask is behind it, which is
 * the same answer sorting every coordinate would give and does not need the
 * coordinates to exist.
 */
function percentile(counts: Uint32Array, pixels: number, at: number): number {
  if (pixels <= 0) return 0;
  const target = Math.max(1, Math.round(pixels * at));
  let seen = 0;
  for (let i = 0; i < counts.length; i += 1) {
    seen += counts[i];
    if (seen >= target) return i;
  }
  return counts.length - 1;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
