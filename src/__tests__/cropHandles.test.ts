import { describe, expect, it } from 'vitest';

import { clampPan, draw, resize } from '@/components/closet/MultiCrop';
import {
  CROP_ASPECT,
  MIN_BOX,
  cropFrame,
  isDrawnBox,
  rotateBox,
  rotatedExtent,
} from '@/lib/crop';

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

/**
 * The minimum used to be 3% of the SOURCE PHOTO, and it doubled as the test for
 * "was that a drag or a tap?". That made it a minimum garment size by accident:
 * a ring, a pair of earrings or a watch face is smaller than 3% of a photo, so
 * a box drawn carefully around one was deleted the instant the finger lifted.
 * Zooming could not help, because the threshold never looked at the screen.
 */
describe('isDrawnBox', () => {
  // A 1200px-wide photo fitted to a 400px-wide phone frame.
  const fitted = { w: 400, h: 500 };

  it('keeps a box that is small on the photo but real on the screen', () => {
    // 4% of the frame — a ring on a table — is 16 screen pixels. A real box.
    const ring = { id: 'r', x: 0.4, y: 0.4, width: 0.04, height: 0.04 };
    expect(isDrawnBox(ring, fitted.w, fitted.h)).toBe(true);
  });

  it('still discards the speck a stray tap leaves behind', () => {
    const speck = { id: 's', x: 0.5, y: 0.5, width: 0.004, height: 0.004 };
    expect(isDrawnBox(speck, fitted.w, fitted.h)).toBe(false);
  });

  it('lets zooming in rescue a box that was too small to draw', () => {
    const earring = { id: 'e', x: 0.5, y: 0.5, width: 0.01, height: 0.01 };
    // Fitted, that is 4 screen pixels — indistinguishable from a tap.
    expect(isDrawnBox(earring, fitted.w, fitted.h)).toBe(false);
    // Zoomed to 6x it is 24, which is a deliberate gesture. This is the whole
    // point of pinch-zoom, and the old rule ignored it entirely.
    expect(isDrawnBox(earring, fitted.w * 6, fitted.h * 6)).toBe(true);
  });

  it('reads a box drawn up and to the left, which has negative sides', () => {
    const backwards = { id: 'b', x: 0.6, y: 0.6, width: -0.2, height: -0.2 };
    expect(isDrawnBox(backwards, fitted.w, fitted.h)).toBe(true);
  });

  it('leaves MIN_BOX as nothing but a floor against inversion', () => {
    // Small enough that no real garment box ever meets it from above.
    expect(MIN_BOX).toBeLessThan(0.01);
  });
});

/**
 * Panning used to bank slack: dragging past the edge kept accumulating into
 * `pan` while `place` clamped what was drawn, so pushing back the other way did
 * nothing for an inch and the photo felt stuck rather than bounded.
 */
describe('clampPan', () => {
  it('holds pan inside the slack the photo actually has', () => {
    // A 1200px photo in a 400px frame has 800px of overhang, 400 each side.
    expect(clampPan(400, 1200, 5000)).toBe(400);
    expect(clampPan(400, 1200, -5000)).toBe(-400);
  });

  it('leaves a pan that is already inside alone', () => {
    expect(clampPan(400, 1200, 120)).toBe(120);
  });

  it('pins a photo that fits, because there is nowhere to go', () => {
    expect(clampPan(400, 300, 90)).toBe(0);
    expect(clampPan(400, 0, 90)).toBe(0);
  });
});

/**
 * Turning the photo.
 *
 * The crop is exactly the box that was drawn, and it is an axis-aligned box —
 * which is the one thing careful handles cannot fix. A jumper photographed at a
 * tilt does not fit in an upright rectangle, so framing it meant drawing a
 * bigger box and taking the wall back in. The photo has to turn.
 */
describe('rotatedExtent', () => {
  it('swaps the sides on a quarter turn', () => {
    expect(rotatedExtent(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedExtent(400, 300, -90)).toEqual({ width: 300, height: 400 });
  });

  it('leaves a photo alone when nothing turns', () => {
    expect(rotatedExtent(400, 300, 0)).toEqual({ width: 400, height: 300 });
    expect(rotatedExtent(400, 300, 180)).toEqual({ width: 400, height: 300 });
  });

  it('grows to hold the corners a straighten opens up', () => {
    const tilted = rotatedExtent(400, 300, 10);
    expect(tilted.width).toBeGreaterThan(400);
    expect(tilted.height).toBeGreaterThan(300);
    // But only by a little — this is a straighten, not a quarter turn.
    expect(tilted.width).toBeLessThan(460);
  });
});

describe('rotateBox', () => {
  const square = { id: 'b', x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

  it('carries a centred box through a quarter turn unchanged', () => {
    const turned = rotateBox(square, 90, 400, 400);
    expect(turned.x).toBeCloseTo(0.25, 3);
    expect(turned.y).toBeCloseTo(0.25, 3);
    expect(turned.width).toBeCloseTo(0.5, 3);
    expect(turned.height).toBeCloseTo(0.5, 3);
  });

  it('takes a corner box to the corner a quarter turn puts it in', () => {
    // Top-left of an upright photo becomes top-right after a clockwise turn.
    const corner = { id: 'b', x: 0, y: 0, width: 0.25, height: 0.25 };
    const turned = rotateBox(corner, 90, 400, 400);
    expect(turned.x).toBeCloseTo(0.75, 3);
    expect(turned.y).toBeCloseTo(0, 3);
  });

  it('follows the photo changing shape, not just the box', () => {
    // A box filling the left half of a 400x200 photo fills the top half of the
    // 200x400 one it becomes.
    const half = { id: 'b', x: 0, y: 0, width: 0.5, height: 1 };
    const turned = rotateBox(half, 90, 400, 200);
    expect(turned.height).toBeCloseTo(0.5, 3);
    expect(turned.width).toBeCloseTo(1, 3);
  });

  /*
   * The invariant that actually matters, and the reason a straighten is safe:
   * everything inside the box before the turn is inside it afterwards. The box
   * may come out a little generous — a tilted rectangle does not fit inside an
   * upright one — and that is the right way round. A box that clipped the
   * garment is the bug this guards, and it would be invisible until somebody
   * looked at a hem that had lost its corner.
   */
  it('still contains everything it contained before the turn', () => {
    const box = { id: 'b', x: 0.1, y: 0.15, width: 0.6, height: 0.2 };
    const width = 400;
    const height = 300;
    const degrees = 8;
    const radians = (degrees * Math.PI) / 180;
    const turned = rotateBox(box, degrees, width, height);
    const target = rotatedExtent(width, height, degrees);

    [0, 0.5, 1].forEach((fx) => {
      [0, 0.5, 1].forEach((fy) => {
        const px = (box.x + box.width * fx) * width - width / 2;
        const py = (box.y + box.height * fy) * height - height / 2;
        const rx =
          (px * Math.cos(radians) - py * Math.sin(radians) + target.width / 2) / target.width;
        const ry =
          (px * Math.sin(radians) + py * Math.cos(radians) + target.height / 2) / target.height;
        expect(rx).toBeGreaterThanOrEqual(turned.x - 1e-6);
        expect(rx).toBeLessThanOrEqual(turned.x + turned.width + 1e-6);
        expect(ry).toBeGreaterThanOrEqual(turned.y - 1e-6);
        expect(ry).toBeLessThanOrEqual(turned.y + turned.height + 1e-6);
      });
    });
  });

  /*
   * In FRACTIONS a straightened box can come out smaller, because the canvas
   * grew to hold the opened corners and grew faster than the box did. In pixels
   * it never does, and pixels are what the crop reads.
   */
  it('never loses area in pixels, however the canvas changes shape', () => {
    const box = { id: 'b', x: 0.2, y: 0.3, width: 0.5, height: 0.2 };
    const width = 400;
    const height = 300;
    const before = box.width * width * (box.height * height);

    const turned = rotateBox(box, 8, width, height);
    const target = rotatedExtent(width, height, 8);
    const after = turned.width * target.width * (turned.height * target.height);

    expect(after).toBeGreaterThanOrEqual(before - 1);
  });

  it('never lets a turned box leave the photograph', () => {
    [90, -90, 12, -12, 180].forEach((degrees) => {
      const edge = { id: 'b', x: 0.8, y: 0.8, width: 0.2, height: 0.2 };
      const turned = rotateBox(edge, degrees, 400, 300);
      expect(turned.x).toBeGreaterThanOrEqual(0);
      expect(turned.y).toBeGreaterThanOrEqual(0);
      expect(turned.x + turned.width).toBeLessThanOrEqual(1.0001);
      expect(turned.y + turned.height).toBeLessThanOrEqual(1.0001);
    });
  });

  it('comes back to where it started after four quarter turns', () => {
    let box = { id: 'b', x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    let width = 400;
    let height = 300;
    for (let i = 0; i < 4; i += 1) {
      box = rotateBox(box, 90, width, height);
      [width, height] = [height, width];
    }
    expect(box.x).toBeCloseTo(0.1, 3);
    expect(box.y).toBeCloseTo(0.2, 3);
    expect(box.width).toBeCloseTo(0.3, 3);
    expect(box.height).toBeCloseTo(0.4, 3);
  });
});
