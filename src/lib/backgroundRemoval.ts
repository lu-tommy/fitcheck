'use client';

import { canvasToPngBlob } from '@/lib/image';
import type { BackgroundRemovalMode } from '@/types';

/**
 * Background removal, as a strategy rather than a dependency.
 *
 * `local` is a flood fill inward from the frame edges. It is instant, private
 * and free, and it is honest about its limits: it works when the garment was
 * shot against a plain wall, floor or sheet, and it does not work against a
 * cluttered room. That constraint is stated in the UI rather than hidden.
 *
 * `api` posts to /api/cutout for anyone who wires up a cutout provider. The
 * well-known browser-side segmentation packages are all either non-commercial
 * licensed or a 40 MB model download, so neither is the default.
 */

export interface CutoutResult {
  blob: Blob;
  /** Share of the frame that was removed — used to warn on an obvious misfire. */
  removedFraction: number;
  /** False when the fill did not find a plain background worth trusting. */
  usable: boolean;
  /** Why it is not usable, in a word the UI can turn into a sentence. */
  reason?: CutoutProblem;
}

export type CutoutProblem = 'busy-background' | 'nothing-left';

/**
 * Whether a finished fill is worth using, kept apart from the canvas work so it
 * can be reasoned about and tested.
 *
 * The old rule rejected anything that removed under 4% or over 94% of the
 * frame, and the second half of that was wrong: a jumper photographed from
 * across a plain floor legitimately IS 1% of the picture, so removing 99% is
 * the fill working perfectly, not failing. That bail threw away precisely the
 * photos cropping was built to rescue. What matters is not how much went, but
 * whether a plausible garment is left behind.
 */
export function judgeCutout(
  removedFraction: number,
  remainingCoverage: number,
): { usable: boolean; reason?: CutoutProblem } {
  // Almost nothing went: the edges were a bedroom, not a wall.
  if (removedFraction < 0.04) return { usable: false, reason: 'busy-background' };
  // Almost nothing is left: the fill ate the garment too.
  if (remainingCoverage < 0.002) return { usable: false, reason: 'nothing-left' };
  return { usable: true };
}

export async function removeBackground(
  source: Blob,
  mode: BackgroundRemovalMode,
): Promise<CutoutResult | null> {
  if (mode === 'off') return null;
  if (mode === 'api') return removeViaApi(source);
  return removeByFloodFill(source);
}

async function removeViaApi(source: Blob): Promise<CutoutResult | null> {
  try {
    const body = new FormData();
    body.append('image', source);
    const response = await fetch('/api/cutout', { method: 'POST', body });
    if (!response.ok) return null;
    const blob = await response.blob();
    return { blob, removedFraction: 0, usable: true };
  } catch {
    return null;
  }
}

/** Colour distance that tolerates shading on a wall but not a different object. */
function within(
  data: Uint8ClampedArray,
  index: number,
  r: number,
  g: number,
  b: number,
  tolerance: number,
): boolean {
  const dr = data[index] - r;
  const dg = data[index + 1] - g;
  const db = data[index + 2] - b;
  return dr * dr + dg * dg + db * db <= tolerance * tolerance;
}

export async function removeByFloodFill(
  source: Blob,
  tolerance = 44,
): Promise<CutoutResult | null> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return null;
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { width, height } = canvas;
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;

  // The seed colour is the median of the frame border, so one dark corner or a
  // hanger hook does not drag the whole model off.
  const border: number[][] = [];
  const step = Math.max(1, Math.floor(width / 60));
  for (let x = 0; x < width; x += step) {
    border.push(pixelAt(data, width, x, 0));
    border.push(pixelAt(data, width, x, height - 1));
  }
  for (let y = 0; y < height; y += step) {
    border.push(pixelAt(data, width, 0, y));
    border.push(pixelAt(data, width, width - 1, y));
  }
  const seed = medianColor(border);

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (x: number, y: number) => {
    const pixel = y * width + x;
    if (visited[pixel]) return;
    if (!within(data, pixel * 4, seed[0], seed[1], seed[2], tolerance)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  // Feather: a pixel touching a kept pixel gets partial alpha, so the cut-out
  // does not have the jagged edge a hard mask leaves behind.
  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (!visited[pixel]) continue;
    const x = pixel % width;
    const y = (pixel - x) / width;
    let keptNeighbours = 0;
    if (x > 0 && !visited[pixel - 1]) keptNeighbours += 1;
    if (x < width - 1 && !visited[pixel + 1]) keptNeighbours += 1;
    if (y > 0 && !visited[pixel - width]) keptNeighbours += 1;
    if (y < height - 1 && !visited[pixel + width]) keptNeighbours += 1;
    data[pixel * 4 + 3] = keptNeighbours ? 90 : 0;
  }

  const removed = visited.reduce((total, value) => total + value, 0) / visited.length;
  const remaining = 1 - removed;

  // Always hand the result back, judged. Returning null threw away the one
  // thing the screen needed in order to explain itself, so a photo that
  // defeated the fill simply produced nothing and said nothing.
  const verdict = judgeCutout(removed, remaining);

  context.putImageData(image, 0, 0);
  return {
    blob: await canvasToPngBlob(canvas),
    removedFraction: removed,
    usable: verdict.usable,
    reason: verdict.reason,
  };
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]];
}

function medianColor(pixels: number[][]): number[] {
  const channel = (index: number) => {
    const values = pixels.map((pixel) => pixel[index]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? 0;
  };
  return [channel(0), channel(1), channel(2)];
}
