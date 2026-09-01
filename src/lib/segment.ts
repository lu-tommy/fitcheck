'use client';

import { contentBounds } from '@/domain/silhouette';
import {
  regionFor,
  segmentRegion,
  type Region,
  type Scribble,
  type SegmentResult,
} from '@/domain/segment';
import { canvasToPngBlob } from '@/lib/image';
import type { CropBox } from '@/lib/crop';

/**
 * The pixels half of box-prompted segmentation. `domain/segment` decides what
 * is garment; this reads the photo and writes the cut-out.
 *
 * Analysis runs at a fraction of the photo's size on purpose. The decision is
 * about colour, which survives downscaling intact, and it has to be cheap
 * enough to re-run between one tap and the next — a mask over 100k pixels lands
 * in a few tens of milliseconds, where a 12-megapixel one would not.
 */
const ANALYSIS_MAX = 320;

/** Enough air that the garment does not touch the tile edge. */
const TRIM_PADDING = 0.03;

export interface Analysis extends SegmentResult {
  region: Region;
  /** Analysis pixels per source pixel. */
  scale: number;
}

export interface RefineOptions {
  strictness?: number;
  scribbles?: Scribble[];
}

export async function analyseGarment(
  source: ImageBitmap,
  box: CropBox,
  options: RefineOptions = {},
): Promise<Analysis | null> {
  const full = regionFor(box, source.width, source.height);
  const scale = Math.min(1, ANALYSIS_MAX / Math.max(full.width, full.height));

  const width = Math.max(8, Math.round(full.width * scale));
  const height = Math.max(8, Math.round(full.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, full.x, full.y, full.width, full.height, 0, 0, width, height);

  const inner = {
    x: Math.round(full.inner.x * scale),
    y: Math.round(full.inner.y * scale),
    width: Math.max(1, Math.round(full.inner.width * scale)),
    height: Math.max(1, Math.round(full.inner.height * scale)),
  };

  const { data } = context.getImageData(0, 0, width, height);
  const result = segmentRegion(data, width, height, inner, {
    strictness: options.strictness,
    scribbles: options.scribbles,
    placement: {
      imageWidth: source.width,
      imageHeight: source.height,
      regionX: full.x,
      regionY: full.y,
      scale,
    },
  });

  return { ...result, region: full, scale };
}

/**
 * Paint the mask back onto the full-resolution photo and trim to the garment.
 *
 * Two details carry most of the quality. The mask is eroded by a pixel first,
 * because a mask drawn exactly on the boundary keeps a rim of wall that reads
 * as a halo once the garment sits on the app's own background. And it is scaled
 * up by the browser rather than by nearest neighbour, so the interpolation
 * gives a soft edge for free — hard alpha is what makes a cut-out look cut out.
 */
export async function renderGarment(
  source: ImageBitmap,
  analysis: Analysis,
  maxDimension = 1200,
): Promise<Blob | null> {
  const eroded = erode(analysis.alpha, analysis.width, analysis.height);
  const bounds = contentBounds(eroded, analysis.width, analysis.height);
  if (!bounds) return null;

  // The garment's bounds, back in source pixels, with a little air.
  const inverse = 1 / analysis.scale;
  const boxWidth = (bounds.maxX - bounds.minX + 1) * inverse;
  const boxHeight = (bounds.maxY - bounds.minY + 1) * inverse;
  const pad = Math.max(boxWidth, boxHeight) * TRIM_PADDING;

  const sx = analysis.region.x + bounds.minX * inverse - pad;
  const sy = analysis.region.y + bounds.minY * inverse - pad;
  const sw = boxWidth + pad * 2;
  const sh = boxHeight + pad * 2;

  const outScale = Math.min(1, maxDimension / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * outScale));
  const height = Math.max(1, Math.round(sh * outScale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);

  // The mask, as an image, so the browser's own smooth scaling feathers it.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = analysis.width;
  maskCanvas.height = analysis.height;
  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) return null;
  const maskImage = maskContext.createImageData(analysis.width, analysis.height);
  for (let i = 0; i < eroded.length; i += 1) {
    maskImage.data[i * 4] = eroded[i];
    maskImage.data[i * 4 + 1] = eroded[i];
    maskImage.data[i * 4 + 2] = eroded[i];
    maskImage.data[i * 4 + 3] = 255;
  }
  maskContext.putImageData(maskImage, 0, 0);

  const scaled = document.createElement('canvas');
  scaled.width = width;
  scaled.height = height;
  const scaledContext = scaled.getContext('2d', { willReadFrequently: true });
  if (!scaledContext) return null;
  scaledContext.imageSmoothingEnabled = true;
  scaledContext.imageSmoothingQuality = 'high';
  scaledContext.drawImage(
    maskCanvas,
    (sx - analysis.region.x) * analysis.scale,
    (sy - analysis.region.y) * analysis.scale,
    sw * analysis.scale,
    sh * analysis.scale,
    0,
    0,
    width,
    height,
  );

  const photo = context.getImageData(0, 0, width, height);
  const mask = scaledContext.getImageData(0, 0, width, height);
  for (let i = 0; i < width * height; i += 1) {
    photo.data[i * 4 + 3] = mask.data[i * 4];
  }
  context.putImageData(photo, 0, 0);

  return canvasToPngBlob(canvas);
}

/** Pull the mask in by one pixel, so no rim of background comes with it. */
function erode(alpha: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(alpha.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!alpha[pixel]) continue;
      const edge =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        !alpha[pixel - 1] ||
        !alpha[pixel + 1] ||
        !alpha[pixel - width] ||
        !alpha[pixel + width];
      out[pixel] = edge ? 0 : 255;
    }
  }
  return out;
}

export type { Scribble };
