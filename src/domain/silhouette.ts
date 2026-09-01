import type { Category, Slot } from '@/types';

/**
 * Guessing what a garment IS from the shape the camera saw.
 *
 * This runs on the cut-out the background removal already produced, so the
 * alpha channel is a clean garment-shaped mask when the photo was taken against
 * a plain background — the same condition the cut-out itself states.
 *
 * It deliberately guesses the SLOT and not the exact category. A silhouette can
 * separate a pair of trousers from a jumper from a shoe; nothing in an outline
 * distinguishes a t-shirt from a polo from a blouse, and pretending otherwise
 * would put a wrong word in someone's closet and make them check every single
 * item. Slot is the honest unit, and it is also the useful one: it cuts the
 * category picker from 42 options to about six.
 *
 * Everything here is arithmetic on a mask, so it runs instantly, works offline,
 * and can be read and argued with — like the rest of src/domain. When the shape
 * does not clearly look like anything it returns null and the picker stays as it
 * was, because a wrong guess costs more than no guess.
 */

/** A garment mask reduced to the numbers the rules below actually use. */
export interface Silhouette {
  /** Bounding-box height / width. Tall trousers > 1, a shoe on its side < 1. */
  aspect: number;
  /** Opaque pixels as a share of the bounding box. A belt coils; a coat fills. */
  fill: number;
  /** Mean mask width across the top / middle / bottom fifths, 0..1 of bbox. */
  topWidth: number;
  midWidth: number;
  bottomWidth: number;
  /** Where the widest row sits, 0 at the top of the garment and 1 at the hem. */
  widestAt: number;
  /**
   * Two separated runs of mask across most of the lower half — the gap between
   * two trouser legs. The single most decisive feature there is.
   */
  legGap: boolean;
  /** Share of the whole frame the garment covers. Jewellery is tiny. */
  coverage: number;
}

export interface CategoryGuess {
  slot: Slot;
  /** The most ordinary member of that slot, offered as a starting point. */
  category: Category;
  /** 0..1. Below CONFIDENT the caller should not preselect anything. */
  confidence: number;
  /** Plain words, so the UI can say why and the user can disagree with it. */
  because: string;
}

/** Below this the guess is not worth showing; the picker stays untouched. */
export const CONFIDENT = 0.6;

/**
 * The least surprising thing in each slot. Offered as a starting point, never
 * asserted: "jeans" is a better first guess than "chinos" only because more
 * wardrobes contain them.
 */
const DEFAULT_FOR_SLOT: Record<Slot, Category> = {
  headwear: 'cap',
  top: 'tshirt',
  midlayer: 'sweater',
  outerwear: 'jacket',
  fullbody: 'dress',
  bottom: 'jeans',
  footwear: 'sneakers',
  accessory: 'other',
};

function guess(slot: Slot, confidence: number, because: string): CategoryGuess {
  return { slot, category: DEFAULT_FOR_SLOT[slot], confidence, because };
}

export function guessFromSilhouette(s: Silhouette): CategoryGuess | null {
  // Something tiny in a big frame is jewellery, a watch, a ring — not a coat.
  if (s.coverage < 0.04) {
    return guess('accessory', 0.72, 'it covers very little of the photo');
  }

  // A belt, a tie or a scarf is a ribbon. Two shapes of that: laid out straight,
  // where it is extremely long in one direction and fills its own box; or coiled,
  // where the box is squarer but mostly empty. Filling the box does NOT rule it
  // out — a strap drawn straight has fill 1.0, which is why this is decided on
  // how extreme the aspect is and is checked before the footwear rule below.
  const ribbon = s.aspect > 3.2 || s.aspect < 0.3;
  const coiled = s.fill < 0.28 && (s.aspect > 2.6 || s.aspect < 0.38);
  if (ribbon || coiled) {
    return guess('accessory', 0.68, 'it is a long thin strap rather than a garment');
  }

  // Trousers: the gap between the legs is unmistakable, and nothing else in a
  // wardrobe splits into two long runs at the bottom.
  if (s.legGap && s.aspect > 1.05) {
    return guess('bottom', 0.88, 'the lower half splits into two legs');
  }

  // Shoes photographed from the side are wider than they are tall. Tops and
  // bottoms essentially never are.
  if (s.aspect >= 0.3 && s.aspect < 0.78 && s.fill > 0.34) {
    return guess('footwear', 0.76, 'it is wider than it is tall');
  }

  // A dress or a jumpsuit is one long mass that does not split, and it is
  // taller than any top.
  if (!s.legGap && s.aspect > 1.55 && s.bottomWidth >= s.topWidth * 0.75) {
    return guess('fullbody', 0.7, 'it is one long piece with no split at the hem');
  }

  // A top laid flat is widest across the shoulders and sleeves, near the top,
  // and roughly as tall as it is wide.
  if (s.widestAt < 0.45 && s.aspect > 0.85 && s.aspect < 1.6 && s.topWidth > s.bottomWidth) {
    return guess('top', 0.66, 'it is widest across the shoulders');
  }

  // A skirt or a pair of shorts: short, and wider at the hem than the waist.
  if (s.aspect < 1.15 && s.bottomWidth > s.topWidth * 1.12) {
    return guess('bottom', 0.64, 'it is short and widest at the hem');
  }

  // Anything else — a crumpled jumper, an odd angle, a busy background that
  // defeated the cut-out. Say nothing.
  return null;
}

/**
 * Reduce a mask to a Silhouette. `alpha` is one byte per pixel, row-major;
 * anything above `threshold` counts as garment.
 */
export function describeSilhouette(
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 16,
): Silhouette | null {
  if (width <= 0 || height <= 0 || alpha.length < width * height) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (alpha[row + x] <= threshold) continue;
      opaque += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0 || opaque === 0) return null;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;

  // Width of the mask on each row, as a share of the bounding box width.
  const rowWidth: number[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    const row = y * width;
    let count = 0;
    for (let x = minX; x <= maxX; x += 1) if (alpha[row + x] > threshold) count += 1;
    rowWidth.push(count / boxW);
  }

  const band = (from: number, to: number) => {
    const a = Math.floor(rowWidth.length * from);
    const b = Math.max(a + 1, Math.floor(rowWidth.length * to));
    let sum = 0;
    for (let i = a; i < b && i < rowWidth.length; i += 1) sum += rowWidth[i];
    return sum / Math.max(1, Math.min(b, rowWidth.length) - a);
  };

  let widestIndex = 0;
  for (let i = 1; i < rowWidth.length; i += 1) {
    if (rowWidth[i] > rowWidth[widestIndex]) widestIndex = i;
  }

  return {
    aspect: boxH / boxW,
    fill: opaque / (boxW * boxH),
    topWidth: band(0, 0.2),
    midWidth: band(0.4, 0.6),
    bottomWidth: band(0.8, 1),
    widestAt: rowWidth.length > 1 ? widestIndex / (rowWidth.length - 1) : 0,
    legGap: hasLegGap(alpha, width, threshold, minX, maxX, minY, maxY),
    coverage: opaque / (width * height),
  };
}

/**
 * True when most rows in the lower half contain two separated runs of mask.
 * One row proves nothing — a sleeve crossing the frame does that — so this
 * asks for the gap to persist down the leg.
 */
function hasLegGap(
  alpha: Uint8Array | Uint8ClampedArray,
  width: number,
  threshold: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxH < 8 || boxW < 8) return false;
  const from = minY + Math.floor(boxH * 0.55);
  let rowsWithGap = 0;
  let rowsChecked = 0;
  for (let y = from; y <= maxY; y += 1) {
    const row = y * width;
    let runs = 0;
    let inRun = false;
    let widest = 0;
    let current = 0;
    for (let x = minX; x <= maxX; x += 1) {
      const on = alpha[row + x] > threshold;
      if (on && !inRun) {
        runs += 1;
        current = 1;
        inRun = true;
      } else if (on) {
        current += 1;
      } else if (inRun) {
        widest = Math.max(widest, current);
        inRun = false;
      }
    }
    widest = Math.max(widest, current);
    if (widest === 0) continue;
    rowsChecked += 1;
    // Two runs, and neither so narrow that it is just a frayed edge.
    if (runs === 2 && widest >= boxW * 0.12) rowsWithGap += 1;
  }
  return rowsChecked >= 6 && rowsWithGap / rowsChecked > 0.55;
}
