import { describe, expect, it } from 'vitest';

import {
  ATR_LABELS,
  GARMENT_CLASSES,
  PARSE_CONFIDENT,
  describeEmptyParse,
  garmentClassFor,
  labelMapFromMasks,
  regionMask,
  regionsFromLabelMap,
} from '@/domain/garmentClasses';

/**
 * Reading garments out of a segmentation mask.
 *
 * The model is 27 MB and cannot run in here, which is exactly why the
 * judgements live in a pure function: every decision that changes what somebody
 * sees — which classes are clothes, where the box goes, how far the label is
 * believed — is arithmetic over an array of class ids, and can be held to a
 * mask drawn by hand.
 */

const W = 100;
const H = 100;

/** A label map with rectangles painted into it, the way a real one arrives. */
function paint(rects: { classId: number; x: number; y: number; w: number; h: number }[]) {
  const labels = new Uint8Array(W * H);
  rects.forEach(({ classId, x, y, w, h }) => {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) labels[row * W + col] = classId;
    }
  });
  return labels;
}

const TOP = 4;
const PANTS = 6;
const LEFT_SHOE = 9;
const RIGHT_SHOE = 10;
const HAIR = 2;
const LEFT_ARM = 14;

describe('the class table', () => {
  it('names every class the model actually emits', () => {
    expect(ATR_LABELS).toHaveLength(18);
    GARMENT_CLASSES.forEach((entry) => {
      expect(ATR_LABELS[entry.id]).toBeDefined();
      entry.absorbs?.forEach((id) => expect(ATR_LABELS[id]).toBeDefined());
    });
  });

  it('treats a left shoe and a right shoe as one pair', () => {
    expect(garmentClassFor(LEFT_SHOE)?.id).toBe(garmentClassFor(RIGHT_SHOE)?.id);
    expect(garmentClassFor(RIGHT_SHOE)?.slot).toBe('footwear');
  });

  it('knows the person is not a garment', () => {
    // Background, hair, face, both arms, both legs.
    [0, 2, 11, 12, 13, 14, 15].forEach((id) => {
      expect(garmentClassFor(id)).toBeUndefined();
    });
  });

  /*
   * The model's per-class accuracy varies enormously — a belt is a thin strip
   * the colour of the trousers behind it. A screen that showed every guess with
   * equal confidence would be lying about most of them.
   */
  it('does not claim a belt is as certain as a pair of trousers', () => {
    const belt = GARMENT_CLASSES.find((entry) => entry.label === 'Belt')!;
    const pants = GARMENT_CLASSES.find((entry) => entry.label === 'Pants')!;
    expect(belt.reliability).toBeLessThan(PARSE_CONFIDENT);
    expect(pants.reliability).toBeGreaterThan(PARSE_CONFIDENT);
  });
});

describe('regionsFromLabelMap', () => {
  it('finds nothing in an empty map', () => {
    expect(regionsFromLabelMap(new Uint8Array(W * H), W, H)).toEqual([]);
  });

  it('refuses a map smaller than the size it was told', () => {
    expect(regionsFromLabelMap(new Uint8Array(10), W, H)).toEqual([]);
    expect(regionsFromLabelMap(new Uint8Array(W * H), 0, 0)).toEqual([]);
  });

  it('boxes a garment where it actually is', () => {
    const labels = paint([{ classId: TOP, x: 20, y: 10, w: 40, h: 30 }]);
    const [region] = regionsFromLabelMap(labels, W, H);

    expect(region.slot).toBe('top');
    expect(region.category).toBe('tshirt');
    // 0.20-0.60 across and 0.10-0.40 down, plus a few per cent of padding.
    expect(region.box.x).toBeCloseTo(0.184, 2);
    expect(region.box.y).toBeCloseTo(0.088, 2);
    expect(region.box.width).toBeCloseTo(0.432, 2);
    expect(region.box.height).toBeCloseTo(0.324, 2);
    expect(region.coverage).toBeCloseTo(0.12, 2);
  });

  it('never lets a box leave the photograph', () => {
    const labels = paint([{ classId: TOP, x: 0, y: 0, w: W, h: H }]);
    const [region] = regionsFromLabelMap(labels, W, H);
    expect(region.box.x).toBeGreaterThanOrEqual(0);
    expect(region.box.y).toBeGreaterThanOrEqual(0);
    expect(region.box.x + region.box.width).toBeLessThanOrEqual(1);
    expect(region.box.y + region.box.height).toBeLessThanOrEqual(1);
  });

  it('drops the person and keeps the clothes', () => {
    const labels = paint([
      { classId: HAIR, x: 40, y: 0, w: 20, h: 10 },
      { classId: LEFT_ARM, x: 10, y: 20, w: 10, h: 30 },
      { classId: TOP, x: 25, y: 15, w: 50, h: 35 },
      { classId: PANTS, x: 30, y: 50, w: 40, h: 40 },
    ]);
    const regions = regionsFromLabelMap(labels, W, H);
    expect(regions.map((entry) => entry.slot).sort()).toEqual(['bottom', 'top']);
  });

  it('returns one box for a pair of shoes, not two', () => {
    const labels = paint([
      { classId: LEFT_SHOE, x: 20, y: 85, w: 12, h: 10 },
      { classId: RIGHT_SHOE, x: 60, y: 85, w: 12, h: 10 },
    ]);
    const regions = regionsFromLabelMap(labels, W, H);

    expect(regions).toHaveLength(1);
    expect(regions[0].slot).toBe('footwear');
    // And the box reaches across both of them.
    expect(regions[0].box.x).toBeLessThan(0.21);
    expect(regions[0].box.x + regions[0].box.width).toBeGreaterThan(0.71);
  });

  it('reads the biggest garment first', () => {
    const labels = paint([
      { classId: LEFT_SHOE, x: 20, y: 85, w: 12, h: 10 },
      { classId: TOP, x: 25, y: 15, w: 50, h: 35 },
      { classId: PANTS, x: 30, y: 50, w: 40, h: 30 },
    ]);
    expect(regionsFromLabelMap(labels, W, H).map((entry) => entry.slot)).toEqual([
      'top',
      'bottom',
      'footwear',
    ]);
  });

  it('ignores a speck too small to be anything anybody owns', () => {
    const labels = paint([{ classId: TOP, x: 50, y: 50, w: 4, h: 4 }]);
    expect(regionsFromLabelMap(labels, W, H)).toEqual([]);
  });

  /*
   * The failure this is really guarding. One pixel the model dropped in a far
   * corner drags a min/max box across the whole photograph — and a box like
   * that is worse than none, because it looks deliberate.
   */
  it('is not dragged across the frame by a handful of stray pixels', () => {
    const labels = paint([{ classId: TOP, x: 30, y: 30, w: 40, h: 40 }]);
    labels[0] = TOP;
    labels[W * H - 1] = TOP;
    labels[W - 1] = TOP;

    const [region] = regionsFromLabelMap(labels, W, H);
    expect(region.box.x).toBeLessThan(0.32);
    expect(region.box.width).toBeLessThan(0.5);
  });

  it('trusts a clean mask more than a ragged one', () => {
    const solid = paint([{ classId: TOP, x: 20, y: 20, w: 40, h: 40 }]);
    const [clean] = regionsFromLabelMap(solid, W, H);

    // The same extent, but only every third pixel actually claimed.
    const ragged = new Uint8Array(W * H);
    for (let y = 20; y < 60; y += 1) {
      for (let x = 20; x < 60; x += 3) ragged[y * W + x] = TOP;
    }
    const [scattered] = regionsFromLabelMap(ragged, W, H);

    expect(clean.confidence).toBeGreaterThan(PARSE_CONFIDENT);
    expect(scattered.confidence).toBeLessThan(clean.confidence);
    expect(scattered.confidence).toBeLessThan(PARSE_CONFIDENT);
  });
});

describe('labelMapFromMasks', () => {
  it('folds one mask per class into a single map', () => {
    const top = new Uint8Array(W * H);
    const pants = new Uint8Array(W * H);
    for (let i = 0; i < 1200; i += 1) top[i] = 255;
    for (let i = 4000; i < 5200; i += 1) pants[i] = 255;

    const labels = labelMapFromMasks(
      [
        { classId: TOP, data: top },
        { classId: PANTS, data: pants },
      ],
      W,
      H,
    );
    expect(labels[0]).toBe(TOP);
    expect(labels[4000]).toBe(PANTS);
    expect(labels[3000]).toBe(0);
  });

  it('leaves the body out of the map entirely', () => {
    const hair = new Uint8Array(W * H).fill(255);
    const labels = labelMapFromMasks([{ classId: HAIR, data: hair }], W, H);
    expect(labels.every((value) => value === 0)).toBe(true);
  });

  it('reads a half-lit mask as absent rather than present', () => {
    const faint = new Uint8Array(W * H).fill(100);
    const labels = labelMapFromMasks([{ classId: TOP, data: faint }], W, H);
    expect(labels.every((value) => value === 0)).toBe(true);
  });
});

describe('describeEmptyParse', () => {
  it('says which of the two things went wrong, so it is not a dead end', () => {
    expect(describeEmptyParse(true)).toContain('person');
    expect(describeEmptyParse(false)).toContain('flat lay');
    expect(describeEmptyParse(true)).toContain('by hand');
    expect(describeEmptyParse(false)).toContain('by hand');
  });
});

/**
 * The parse already knows which pixels are the jumper and which are the arm
 * inside it. Keeping only the rectangle throws away the expensive half of the
 * work — and it is the half the flood-fill cut-out structurally cannot do,
 * because a fill seeded from the edge of a crop off a mirror selfie eats into
 * the arm rather than stopping at the sleeve.
 */
describe('regionMask', () => {
  it('returns the garment shape, cropped to its own box', () => {
    const labels = paint([{ classId: TOP, x: 20, y: 20, w: 40, h: 40 }]);
    const [region] = regionsFromLabelMap(labels, W, H);
    const mask = regionMask(labels, W, H, region)!;

    // The mask covers the padded box, and the garment sits inside it.
    expect(mask.width).toBeGreaterThanOrEqual(40);
    expect(mask.height).toBeGreaterThanOrEqual(40);
    expect(mask.data).toHaveLength(mask.width * mask.height);

    const opaque = mask.data.filter((value) => value > 0).length;
    expect(opaque).toBe(40 * 40);
  });

  it('leaves a hole where another garment crosses it', () => {
    // A belt across the middle of a pair of trousers.
    const labels = paint([
      { classId: PANTS, x: 20, y: 20, w: 40, h: 60 },
      { classId: 8, x: 20, y: 45, w: 40, h: 6 },
    ]);
    const pants = regionsFromLabelMap(labels, W, H).find((entry) => entry.slot === 'bottom')!;
    const mask = regionMask(labels, W, H, pants)!;

    // The trousers' own mask does not claim the belt's pixels.
    const opaque = mask.data.filter((value) => value > 0).length;
    expect(opaque).toBe(40 * 60 - 40 * 6);
  });

  it('says nothing rather than guessing on a map it cannot read', () => {
    const labels = paint([{ classId: TOP, x: 20, y: 20, w: 40, h: 40 }]);
    const [region] = regionsFromLabelMap(labels, W, H);
    expect(regionMask(new Uint8Array(4), W, H, region)).toBeNull();
    expect(regionMask(labels, 0, 0, region)).toBeNull();
  });
});
