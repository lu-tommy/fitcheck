import { describe, expect, it } from 'vitest';

import { draw, resize } from '@/components/closet/MultiCrop';
import { CROP_ASPECT, MIN_BOX, cropFrame } from '@/lib/crop';

const box = { id: 'b', x: 0.2, y: 0.2, width: 0.4, height: 0.4 };

/**
 * The crop used to pad the box by 6% and then GROW it until it matched the
 * tile's shape, taking whatever the photo happened to have there. A box placed
 * carefully around a tank top still came out with a bathroom in it, and no
 * amount of care with the box could beat the crop widening afterwards.
 */
describe('cropFrame', () => {
  it('reads exactly the box that was drawn, and not a pixel more', () => {
    const plan = cropFrame({ id: 'b', x: 0.25, y: 0.1, width: 0.5, height: 0.4 }, 1000, 1200);
    expect(plan.sx).toBe(250);
    expect(plan.sy).toBe(120);
    expect(plan.sw).toBe(500);
    expect(plan.sh).toBe(480);
  });

  it('needs no frame at all when the box is already tile-shaped', () => {
    // 400×500 of a 1000×1000 photo is exactly 4:5.
    const plan = cropFrame({ id: 'b', x: 0, y: 0, width: 0.4, height: 0.5 }, 1000, 1000);
    expect(plan.outWidth / plan.outHeight).toBeCloseTo(CROP_ASPECT, 2);
    expect(plan.left).toBeCloseTo(0);
    expect(plan.top).toBeCloseTo(0);
  });

  it('pads a wide box with flat colour rather than more photograph', () => {
    const plan = cropFrame({ id: 'b', x: 0.1, y: 0.4, width: 0.8, height: 0.2 }, 1000, 1000);
    // The region is untouched…
    expect(plan.sw).toBe(800);
    expect(plan.sh).toBe(200);
    // …and the height it is short by becomes frame, split evenly.
    expect(plan.outWidth / plan.outHeight).toBeCloseTo(CROP_ASPECT, 2);
    expect(plan.top).toBeGreaterThan(0);
    expect(plan.left).toBeCloseTo(0);
  });

  it('never scales past the source, however small the crop', () => {
    const plan = cropFrame({ id: 'b', x: 0.4, y: 0.4, width: 0.05, height: 0.05 }, 800, 800);
    expect(plan.scale).toBe(1);
  });
});

/**
 * The box had exactly one handle, at the bottom-right, resizing with the
 * top-left pinned — so a box whose top edge came out too high could not be
 * corrected at all, only deleted and drawn again.
 */
describe('resize', () => {
  it('moves only the edge that was grabbed', () => {
    const top = resize(box, 'n', 0.9, 0.1);
    expect(top.y).toBeCloseTo(0.1);
    expect(top.height).toBeCloseTo(0.5);
    // The horizontal edges did not move, despite the pointer being far right.
    expect(top.x).toBeCloseTo(0.2);
    expect(top.width).toBeCloseTo(0.4);
  });

  it('moves both edges of a corner', () => {
    const corner = resize(box, 'nw', 0.05, 0.1);
    expect(corner.x).toBeCloseTo(0.05);
    expect(corner.y).toBeCloseTo(0.1);
    expect(corner.width).toBeCloseTo(0.55);
    expect(corner.height).toBeCloseTo(0.5);
  });

  it('grows from the far edge, not from a fixed origin', () => {
    const west = resize(box, 'w', 0.05, 0.5);
    expect(west.x + west.width).toBeCloseTo(0.6);
  });

  it('clamps rather than turning the box inside out', () => {
    const flipped = resize(box, 'n', 0.5, 0.95);
    expect(flipped.height).toBeCloseTo(MIN_BOX);
    expect(flipped.y + flipped.height).toBeCloseTo(0.6);

    const inverted = resize(box, 'e', 0.05, 0.5);
    expect(inverted.width).toBeCloseTo(MIN_BOX);
    expect(inverted.x).toBeCloseTo(0.2);
  });

  it('slides back inside the photo instead of distorting to fit', () => {
    const out = resize(box, 'se', 1.4, 1.4);
    expect(out.x + out.width).toBeLessThanOrEqual(1);
    expect(out.y + out.height).toBeLessThanOrEqual(1);
  });

  describe('with a locked shape', () => {
    // A square box on a 2:1 photo is NOT square in fractions: it is half as
    // wide as it is tall. Every ratio has to go through the image's own shape.
    const square = 1 / 2;
    const small = { id: 'b', x: 0.2, y: 0.3, width: 0.2, height: 0.2 };

    it('holds the shape when an edge is dragged, growing about the centre', () => {
      const wide = resize(small, 'e', 0.4, 0.5, square);
      expect(wide.width / wide.height).toBeCloseTo(square, 3);
      // The east edge went where it was put; the west edge stayed.
      expect(wide.x).toBeCloseTo(0.2);
      expect(wide.x + wide.width).toBeCloseTo(0.4);
      // Height grew symmetrically, so the box did not drift up or down.
      expect(wide.y + wide.height / 2).toBeCloseTo(0.4, 3);
    });

    it('holds the shape from a corner, keeping the opposite corner still', () => {
      const corner = resize(small, 'se', 0.45, 0.5, square);
      expect(corner.width / corner.height).toBeCloseTo(square, 3);
      expect(corner.x).toBeCloseTo(0.2);
      expect(corner.y).toBeCloseTo(0.3);
    });

    it('would rather slide inside the photo than break the shape', () => {
      // Dragged so far that the locked height cannot fit below the box.
      const forced = resize(box, 'se', 0.95, 0.95, square);
      expect(forced.y + forced.height).toBeLessThanOrEqual(1);
      expect(forced.x).toBeGreaterThanOrEqual(0);
    });

    it('re-shapes an existing box about its centre', () => {
      const reshaped = resize(box, 'se', 1, 1, square, true);
      expect(reshaped.width / reshaped.height).toBeCloseTo(square, 3);
      expect(reshaped.x + reshaped.width / 2).toBeCloseTo(0.4, 3);
      expect(reshaped.y + reshaped.height / 2).toBeCloseTo(0.4, 3);
    });
  });
});

describe('draw', () => {
  it('follows the pointer when nothing is locked', () => {
    const free = draw(box, 0.1, 0.1, 0.5, 0.7);
    expect(free.width).toBeCloseTo(0.4);
    expect(free.height).toBeCloseTo(0.6);
  });

  it('holds the shape from the first moment, and follows the longer drag', () => {
    const locked = draw(box, 0.1, 0.1, 0.5, 0.2, 1 / 2);
    expect(locked.width / locked.height).toBeCloseTo(1 / 2, 3);
    // The horizontal drag was the longer one, so it set the size.
    expect(locked.width).toBeCloseTo(0.4);
  });

  it('draws up and to the left as happily as down and to the right', () => {
    const backwards = draw(box, 0.8, 0.8, 0.4, 0.6, 1 / 2);
    expect(backwards.width).toBeLessThan(0);
    expect(backwards.height).toBeLessThan(0);
    expect(backwards.width / backwards.height).toBeCloseTo(1 / 2, 3);
  });
});
