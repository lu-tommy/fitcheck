'use client';

import { hexToHsl, normalizeHex } from '@/domain/color';
import { swatches } from '@/lib/palette';

/**
 * Photo handling: everything a phone camera hands us is far larger than a
 * wardrobe grid needs, so images are downscaled before they ever reach
 * IndexedDB. A 4 MB HEIC-sized JPEG becomes roughly 150 KB, which is the
 * difference between a closet of 200 pieces fitting in the browser's quota and
 * not.
 */

export const MAX_DIMENSION = 1400;
export const JPEG_QUALITY = 0.82;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  /** Dominant garment colour, as a hex string. */
  dominantHex: string;
  /** Nearest name from the swatch list — what the item editor pre-fills. */
  dominantName: string;
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  // createImageBitmap handles EXIF orientation, which <img> decoding does not.
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export async function processPhoto(file: Blob): Promise<ProcessedImage> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process images');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const hasAlpha = file.type === 'image/png';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, hasAlpha ? 'image/png' : 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('Could not read that image');

  const { hex, name } = dominantColor(context, width, height);
  return { blob, width, height, dominantHex: hex, dominantName: name };
}

/**
 * Find the garment's colour in a photo.
 *
 * Two passes. The first reads the outer ring of the frame, which is almost
 * always backdrop — a wall, a floor, a bedsheet. The second bins the middle of
 * the frame and throws away anything that matches that backdrop, so a pair of
 * shoes photographed on a duvet does not come back the colour of the duvet.
 *
 * If discarding the backdrop leaves almost nothing, the garment probably fills
 * the frame and *is* that colour, so the filter is dropped rather than trusted.
 */
export function dominantColor(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): { hex: string; name: string } {
  const backdrop = edgeColor(context, width, height);

  const inset = 0.18;
  const x = Math.floor(width * inset);
  const y = Math.floor(height * inset);
  const w = Math.max(1, Math.floor(width * (1 - inset * 2)));
  const h = Math.max(1, Math.floor(height * (1 - inset * 2)));
  const { data } = context.getImageData(x, y, w, h);

  const collect = (skipBackdrop: boolean) => {
    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    let sampled = 0;

    for (let i = 0; i < data.length; i += 4 * 7) {
      if (data[i + 3] < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 2;
      const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      // Blown-out highlights and deep shadow describe the lighting, not the cloth.
      if (lightness > 235 && saturation < 0.12) continue;
      if (lightness < 18) continue;

      if (skipBackdrop && backdrop && distance(r, g, b, backdrop) < BACKDROP_TOLERANCE) continue;

      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
      sampled += 1;
    }
    return { buckets, sampled };
  };

  const filtered = collect(true);
  const total = collect(false);

  // Under a twentieth of the frame left means the "backdrop" was the garment.
  const chosen =
    filtered.sampled > Math.max(24, total.sampled * 0.05) ? filtered : total;

  if (!chosen.sampled) return { hex: swatches.grey, name: 'grey' };

  const best = [...chosen.buckets.values()].sort((a, b) => b.count - a.count)[0];
  const hex = rgbToHex(
    Math.round(best.r / best.count),
    Math.round(best.g / best.count),
    Math.round(best.b / best.count),
  );
  return { hex, name: nearestSwatchName(hex) };
}

/** How far a colour can sit from the backdrop and still count as backdrop. */
const BACKDROP_TOLERANCE = 46;

function distance(r: number, g: number, b: number, to: [number, number, number]): number {
  return Math.sqrt((r - to[0]) ** 2 + (g - to[1]) ** 2 + (b - to[2]) ** 2);
}

/** The median colour of the frame's outer ring — a good guess at the backdrop. */
function edgeColor(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): [number, number, number] | null {
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.05));
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];

  const scan = (sx: number, sy: number, sw: number, sh: number) => {
    if (sw <= 0 || sh <= 0) return;
    const { data } = context.getImageData(sx, sy, sw, sh);
    for (let i = 0; i < data.length; i += 4 * 5) {
      if (data[i + 3] < 200) continue;
      reds.push(data[i]);
      greens.push(data[i + 1]);
      blues.push(data[i + 2]);
    }
  };

  scan(0, 0, width, band);
  scan(0, height - band, width, band);
  scan(0, band, band, Math.max(0, height - band * 2));
  scan(width - band, band, band, Math.max(0, height - band * 2));

  if (!reds.length) return null;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  return [median(reds), median(greens), median(blues)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Nearest named colour, compared in HSL so that "navy" wins over "black" for a
 * dark blue — RGB distance gets that wrong often enough to be noticeable.
 */
export function nearestSwatchName(hex: string): string {
  const target = hexToHsl(normalizeHex(hex));
  let bestName = 'grey';
  let bestScore = Number.POSITIVE_INFINITY;

  Object.entries(swatches).forEach(([name, value]) => {
    if (name === 'multicolor') return;
    const candidate = hexToHsl(value);
    const hueGap = target.s < 12 || candidate.s < 12 ? 0 : hueDistance(target.h, candidate.h);
    const score =
      (hueGap / 180) * 2.2 +
      Math.abs(target.s - candidate.s) / 100 +
      (Math.abs(target.l - candidate.l) / 100) * 1.6;
    if (score < bestScore) {
      bestScore = score;
      bestName = name;
    }
  });

  return bestName;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Read a canvas back out as a PNG so transparency survives. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export the image'))),
      'image/png',
    );
  });
}
