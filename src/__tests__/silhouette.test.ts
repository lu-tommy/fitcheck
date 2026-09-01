import { describe, expect, it } from 'vitest';

import {
  CONFIDENT,
  describeSilhouette,
  guessFromSilhouette,
} from '@/domain/silhouette';

/**
 * The rules are arithmetic on a mask, so they can be tested with drawn shapes
 * rather than photographs: a pair of trousers really is "two long runs with a
 * gap", and if the code cannot see that in a clean drawing it will not see it
 * in a photo either.
 */
const W = 200;
const H = 260;

function blank(): Uint8Array {
  return new Uint8Array(W * H);
}
function rect(a: Uint8Array, x0: number, y0: number, x1: number, y1: number) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x += 1) a[y * W + x] = 255;
  }
}
const read = (a: Uint8Array) => describeSilhouette(a, W, H)!;
const guessOf = (a: Uint8Array) => guessFromSilhouette(read(a));

describe('guessing a garment from its outline', () => {
  it('reads trousers from the gap between the legs', () => {
    const a = blank();
    rect(a, 60, 20, 140, 90);   // waist
    rect(a, 60, 90, 92, 240);   // left leg
    rect(a, 108, 90, 140, 240); // right leg
    const s = read(a);
    expect(s.legGap).toBe(true);
    const g = guessOf(a)!;
    expect(g.slot).toBe('bottom');
    expect(g.confidence).toBeGreaterThanOrEqual(CONFIDENT);
  });


  it('still reads narrow trousers as trousers, not a strap', () => {
    // Regression: a real upload of skinny trousers measured aspect 3.4, which
    // the "long and thin" accessory rule matched before the leg test ran.
    const a = blank();
    rect(a, 88, 12, 112, 70);   // narrow waist
    rect(a, 88, 70, 97, 250);   // left leg
    rect(a, 103, 70, 112, 250); // right leg
    const s = read(a);
    expect(s.aspect).toBeGreaterThan(3.2);
    expect(s.legGap).toBe(true);
    const g = guessOf(a)!;
    expect(g.slot).toBe('bottom');
  });

  it('does not mistake a plain rectangle for trousers', () => {
    const a = blank();
    rect(a, 60, 20, 140, 240);
    expect(read(a).legGap).toBe(false);
  });

  it('reads a shoe from being wider than it is tall', () => {
    const a = blank();
    rect(a, 30, 120, 175, 175);
    const g = guessOf(a)!;
    expect(g.slot).toBe('footwear');
  });

  it('reads a top from being widest across the shoulders', () => {
    const a = blank();
    rect(a, 20, 40, 180, 80);   // shoulders and sleeves
    rect(a, 62, 80, 138, 190);  // body
    const g = guessOf(a)!;
    expect(g.slot).toBe('top');
    expect(g.category).toBe('tshirt');
  });

  it('reads a dress as one long piece that does not split', () => {
    const a = blank();
    rect(a, 76, 10, 124, 120);  // bodice
    rect(a, 56, 120, 144, 250); // skirt, wider at the hem
    const s = read(a);
    expect(s.legGap).toBe(false);
    const g = guessOf(a)!;
    expect(g.slot).toBe('fullbody');
  });

  it('reads a belt as an accessory, not a garment', () => {
    const a = blank();
    rect(a, 10, 126, 190, 140); // a long thin strap
    const g = guessOf(a)!;
    expect(g.slot).toBe('accessory');
  });

  it('reads something tiny in the frame as an accessory', () => {
    const a = blank();
    rect(a, 95, 125, 115, 145); // a ring
    const g = guessOf(a)!;
    expect(g.slot).toBe('accessory');
    expect(g.because).toMatch(/covers very little/);
  });

  it('says nothing when the shape is ambiguous', () => {
    const a = blank();
    // A squarish blob: no leg gap, not wide, not tall, no shoulder flare.
    rect(a, 70, 90, 132, 168);
    expect(guessOf(a)).toBeNull();
  });

  it('says nothing when the mask is empty', () => {
    expect(describeSilhouette(blank(), W, H)).toBeNull();
  });

  it('refuses a mask that does not match its dimensions', () => {
    expect(describeSilhouette(new Uint8Array(10), W, H)).toBeNull();
  });

  it('every guess explains itself in plain words', () => {
    const a = blank();
    rect(a, 60, 20, 140, 90);
    rect(a, 60, 90, 92, 240);
    rect(a, 108, 90, 140, 240);
    const g = guessOf(a)!;
    expect(g.because.length).toBeGreaterThan(10);
    expect(g.because).not.toMatch(/[A-Z]{4,}/); // no jargon shouting
  });
});
