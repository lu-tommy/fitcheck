import { describe, expect, it } from 'vitest';

import { resize } from '@/components/closet/MultiCrop';
import { MIN_BOX } from '@/lib/crop';

/**
 * The box had exactly one handle, at the bottom-right, and it resized with the
 * top-left pinned. So a box whose top edge came out too high could not be
 * corrected at all — the only remedy was to delete it and draw it again, on a
 * phone, with a fingertip covering the thing being aimed at. Every edge and
 * corner moves now, and these say what each one is allowed to touch.
 */
const box = { id: 'b', x: 0.2, y: 0.2, width: 0.4, height: 0.4 };

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
    // The old single handle anchored the top-left; dragging the west edge left
    // has to leave the east edge exactly where it was.
    const west = resize(box, 'w', 0.05, 0.5);
    expect(west.x + west.width).toBeCloseTo(0.6);
  });

  it('clamps rather than turning the box inside out', () => {
    // Dragging the top edge past the bottom one. A box that flips renames its
    // own handles mid-drag, which is disorienting and loses the gesture.
    const flipped = resize(box, 'n', 0.5, 0.95);
    expect(flipped.height).toBeCloseTo(MIN_BOX);
    expect(flipped.y + flipped.height).toBeCloseTo(0.6);

    const inverted = resize(box, 'e', 0.05, 0.5);
    expect(inverted.width).toBeCloseTo(MIN_BOX);
    expect(inverted.x).toBeCloseTo(0.2);
  });
});
