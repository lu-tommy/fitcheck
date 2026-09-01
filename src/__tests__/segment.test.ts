import { describe, expect, it } from 'vitest';

import {
  kmeans,
  regionFor,
  rgbToLab,
  segmentRegion,
  type Scribble,
} from '@/domain/segment';

/** A painter's canvas: RGBA the segmenter can read, shapes a person can picture. */
function canvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (
    x0: number,
    y0: number,
    w: number,
    h: number,
    colour: (x: number, y: number) => [number, number, number],
  ) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const [r, g, b] = colour(x, y);
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  };
  const at = (alpha: Uint8Array, x: number, y: number) => alpha[y * width + x];
  return { data, paint, at, width, height };
}

/** A bathroom: tile, grout, skin and a curtain — no single background colour. */
const clutter = (x: number, y: number): [number, number, number] => {
  if ((x + y) % 23 < 3) return [126, 122, 118]; // grout
  if (x % 31 < 8) return [214, 176, 152]; // an arm
  if (y % 37 < 6) return [188, 190, 196]; // curtain
  return [206, 204, 200]; // tile
};

const BLUE: [number, number, number] = [46, 96, 168];

describe('rgbToLab', () => {
  it('anchors the lightness scale where CIELAB says it does', () => {
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 1);
    expect(rgbToLab(255, 255, 255)[0]).toBeCloseTo(100, 1);
  });

  it('separates hue from brightness, which is the whole reason for using it', () => {
    // The same blue, lit and shaded. In RGB these are 100 apart; in LAB the
    // difference is almost entirely lightness, and a and b barely move.
    const lit = rgbToLab(90, 150, 220);
    const shade = rgbToLab(40, 84, 138);
    expect(Math.abs(lit[1] - shade[1])).toBeLessThan(12);
    expect(Math.abs(lit[2] - shade[2])).toBeLessThan(12);
    expect(Math.abs(lit[0] - shade[0])).toBeGreaterThan(15);
  });
});

describe('kmeans', () => {
  it('finds the groups that are actually there', () => {
    const samples = new Float32Array([
      10, 0, 0, 11, 1, 1, 9, -1, 0,
      80, 20, 30, 81, 21, 29, 79, 19, 31,
    ]);
    const centroids = kmeans(samples, 6, 2);
    const lightness = [centroids[0], centroids[3]].sort((a, b) => a - b);
    expect(lightness[0]).toBeCloseTo(10, 0);
    expect(lightness[1]).toBeCloseTo(80, 0);
  });

  it('is deterministic, so the same photo segments the same way twice', () => {
    const samples = new Float32Array(
      Array.from({ length: 90 }, (_, i) => (i * 37) % 100),
    );
    expect(Array.from(kmeans(samples, 30, 4))).toEqual(Array.from(kmeans(samples, 30, 4)));
  });

  it('never invents more groups than it was given samples', () => {
    expect(kmeans(new Float32Array([5, 5, 5]), 1, 5).length).toBe(3);
  });
});

describe('regionFor', () => {
  it('samples a margin of context around the drawn box', () => {
    const region = regionFor({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 400, 400, 0.2);
    // 200px box, 20% margin = 40px each side.
    expect(region.x).toBe(60);
    expect(region.width).toBe(280);
    expect(region.inner).toEqual({ x: 40, y: 40, width: 200, height: 200 });
  });

  it('clamps at the frame, and the inner box moves with it', () => {
    const region = regionFor({ x: 0, y: 0, width: 0.5, height: 0.5 }, 400, 400, 0.2);
    expect(region.x).toBe(0);
    expect(region.y).toBe(0);
    expect(region.inner.x).toBe(0);
  });
});

describe('segmentRegion', () => {
  const inner = { x: 20, y: 20, width: 80, height: 80 };

  function bathroomWithTank() {
    const sheet = canvas(120, 120);
    sheet.paint(0, 0, 120, 120, clutter);
    sheet.paint(30, 30, 60, 60, () => BLUE);
    return sheet;
  }

  it('keeps the garment and drops the room it was photographed in', () => {
    const sheet = bathroomWithTank();
    const result = segmentRegion(sheet.data, 120, 120, inner);

    expect(result.confident).toBe(true);
    expect(sheet.at(result.alpha, 60, 60)).toBe(255); // middle of the tank
    expect(sheet.at(result.alpha, 24, 24)).toBe(0); // tile, inside the box
    expect(sheet.at(result.alpha, 5, 5)).toBe(0); // outside the box entirely
    // 60×60 of an 80×80 box.
    expect(result.coverage).toBeGreaterThan(0.5);
    expect(result.coverage).toBeLessThan(0.62);
  });

  it('never keeps anything outside the box, whatever colour it is', () => {
    const sheet = bathroomWithTank();
    // The same blue on a towel behind the person, outside what they drew.
    sheet.paint(0, 0, 16, 16, () => BLUE);
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(sheet.at(result.alpha, 8, 8)).toBe(0);
  });

  it('holds a garment together across strong shading', () => {
    const sheet = canvas(120, 120);
    sheet.paint(0, 0, 120, 120, clutter);
    // The same tank, lit hard from the left: a 90-unit ramp in every channel.
    sheet.paint(30, 30, 60, 60, (x) => {
      const t = (x - 30) / 60;
      return [46 + t * 90, 96 + t * 90, 168 + t * 80];
    });
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(sheet.at(result.alpha, 35, 60)).toBe(255); // shadowed edge
    expect(sheet.at(result.alpha, 85, 60)).toBe(255); // lit edge
  });

  it('treats a print as part of the garment, not a hole in it', () => {
    const sheet = bathroomWithTank();
    sheet.paint(50, 50, 20, 20, () => [240, 232, 40]); // a yellow logo
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(sheet.at(result.alpha, 60, 60)).toBe(255);
  });

  it('drops a stray patch that is not connected to the garment', () => {
    const sheet = bathroomWithTank();
    sheet.paint(22, 22, 8, 8, () => BLUE); // a blue speck in the corner of the box
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(sheet.at(result.alpha, 25, 25)).toBe(0);
    expect(sheet.at(result.alpha, 60, 60)).toBe(255);
  });

  it('lets a tap teach the model a colour it had written off', () => {
    const sheet = bathroomWithTank();
    // A grey hem along the bottom of the tank. It is well outside the core the
    // model samples as "probably garment", and grey reads as bathroom, so
    // colour alone throws it away.
    sheet.paint(30, 84, 60, 6, () => [150, 148, 144]);
    const placement = { imageWidth: 120, imageHeight: 120, regionX: 0, regionY: 0, scale: 1 };

    const before = segmentRegion(sheet.data, 120, 120, inner, { placement });
    expect(sheet.at(before.alpha, 40, 87)).toBe(0);

    // One tap, on the far side of the hem from where we then check.
    const scribbles: Scribble[] = [{ x: 70 / 120, y: 86 / 120, label: 'keep', radius: 0.025 }];
    const after = segmentRegion(sheet.data, 120, 120, inner, { placement, scribbles });
    expect(sheet.at(after.alpha, 40, 87)).toBe(255);
  });

  it('lets a tap remove something the colours wrongly kept', () => {
    const sheet = bathroomWithTank();
    const placement = { imageWidth: 120, imageHeight: 120, regionX: 0, regionY: 0, scale: 1 };
    const scribbles: Scribble[] = [{ x: 60 / 120, y: 60 / 120, label: 'drop', radius: 0.08 }];
    const after = segmentRegion(sheet.data, 120, 120, inner, { placement, scribbles });
    expect(sheet.at(after.alpha, 60, 60)).toBe(0);
  });

  it('places a tap by the region window, not by the fraction alone', () => {
    // The region is the right half of a 240-wide photo, analysed at half size.
    const sheet = bathroomWithTank();
    const placement = { imageWidth: 240, imageHeight: 240, regionX: 120, regionY: 120, scale: 1 };
    const scribbles: Scribble[] = [{ x: 180 / 240, y: 180 / 240, label: 'drop', radius: 0.08 }];
    const after = segmentRegion(sheet.data, 120, 120, inner, { placement, scribbles });
    // (180,180) in the photo is (60,60) in the region — the middle of the tank.
    expect(sheet.at(after.alpha, 60, 60)).toBe(0);
  });

  it('leaves the room showing through a neckline, and fills a print', () => {
    const sheet = bathroomWithTank();
    // The opening of a V-neck: enclosed by fabric on all sides, and tile.
    sheet.paint(52, 44, 16, 12, () => [206, 204, 200]);
    // A logo: also enclosed, also not fabric, but not the room either.
    sheet.paint(52, 68, 16, 12, () => [240, 232, 40]);

    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(sheet.at(result.alpha, 60, 50)).toBe(0);
    expect(sheet.at(result.alpha, 60, 74)).toBe(255);
  });

  it('keeps a pair, and only a pair', () => {
    // Two shoes in one box are two shapes and both are the item.
    const sheet = canvas(120, 120);
    sheet.paint(0, 0, 120, 120, clutter);
    sheet.paint(28, 45, 26, 26, () => BLUE);
    sheet.paint(66, 45, 26, 26, () => BLUE);
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(sheet.at(result.alpha, 41, 58)).toBe(255);
    expect(sheet.at(result.alpha, 79, 58)).toBe(255);
  });

  /*
   * The regression that cost the most to find. Taps used to be fed into k-means
   * as heavily weighted samples, which sounds harmless and is not: the model
   * has a fixed number of clusters, so pointing at a navy phone bought a navy
   * cluster by evicting the one that had been holding skin — the phone went and
   * an arm came back. A tap is now its own centroid, so it can only ever add.
   */
  it('a correction corrects, and does nothing else', () => {
    const sheet = bathroomWithTank();
    // Something navy held against the tank: close enough in colour to be kept,
    // and touching it, so connectivity keeps it too.
    sheet.paint(88, 32, 10, 22, () => [38, 62, 116]);

    const placement = { imageWidth: 120, imageHeight: 120, regionX: 0, regionY: 0, scale: 1 };
    const before = segmentRegion(sheet.data, 120, 120, inner, { placement });
    expect(sheet.at(before.alpha, 92, 42)).toBe(255);

    const scribbles: Scribble[] = [{ x: 92 / 120, y: 42 / 120, label: 'drop', radius: 0.04 }];
    const after = segmentRegion(sheet.data, 120, 120, inner, { placement, scribbles });

    expect(sheet.at(after.alpha, 92, 42)).toBe(0);
    // …and the garment is untouched, corner to corner.
    expect(sheet.at(after.alpha, 60, 60)).toBe(255);
    expect(sheet.at(after.alpha, 35, 35)).toBe(255);
    expect(sheet.at(after.alpha, 35, 85)).toBe(255);
    expect(sheet.at(after.alpha, 80, 85)).toBe(255);
  });

  it('admits defeat when the box is the same colour as the room', () => {
    const sheet = canvas(120, 120);
    sheet.paint(0, 0, 120, 120, clutter);
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(result.confident).toBe(false);
  });

  it('admits defeat when the box is nothing but garment', () => {
    const sheet = canvas(120, 120);
    sheet.paint(0, 0, 120, 120, () => BLUE);
    const result = segmentRegion(sheet.data, 120, 120, inner);
    expect(result.confident).toBe(false);
  });
});
