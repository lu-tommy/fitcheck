'use client';

import { contentBounds } from '@/domain/silhouette';
import { canvasToPngBlob } from '@/lib/image';

/**
 * Crop a cut-out down to the garment.
 *
 * The flood fill clears the background but keeps whatever frame the camera
 * chose, so a jumper shot from across the room stays a small object adrift in a
 * large transparent canvas. Every tile, every collage and every shared image
 * then inherits that framing, which is what makes a wardrobe read as a pile of
 * snapshots instead of a rail of clothes. Trimming to the garment's own bounds
 * is the single change that makes them look photographed on purpose.
 *
 * Returns null when there is nothing worth doing — either the cut-out already
 * fills the frame, or it plainly misfired and cropping would enshrine the
 * mistake.
 */
export interface TrimmedCutout {
  blob: Blob;
  width: number;
  height: number;
  /** Share of the ORIGINAL frame the garment occupied, before trimming. */
  coverage: number;
}

/** Below this the flood fill has eaten the garment rather than the background. */
const TOO_LITTLE_LEFT = 0.005;
/** Above this it removed almost nothing, so there is no background to trim. */
const ALREADY_TIGHT = 0.92;

export async function trimToGarment(cutout: Blob, padding = 0.04): Promise<TrimmedCutout | null> {
  try {
    const bitmap = await createImageBitmap(cutout);
    const { width, height } = bitmap;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0);

    const { data } = context.getImageData(0, 0, width, height);
    const alpha = new Uint8Array(width * height);
    for (let i = 0, p = 3; i < alpha.length; i += 1, p += 4) alpha[i] = data[p];

    const bounds = contentBounds(alpha, width, height);
    if (!bounds || bounds.coverage < TOO_LITTLE_LEFT) {
      bitmap.close();
      return null;
    }

    const boxW = bounds.maxX - bounds.minX + 1;
    const boxH = bounds.maxY - bounds.minY + 1;
    if ((boxW * boxH) / (width * height) > ALREADY_TIGHT) {
      bitmap.close();
      return null;
    }

    // A little air around the garment, so it does not touch the tile edges.
    const pad = Math.round(Math.max(boxW, boxH) * padding);
    const x = Math.max(0, bounds.minX - pad);
    const y = Math.max(0, bounds.minY - pad);
    const w = Math.min(width - x, boxW + pad * 2);
    const h = Math.min(height - y, boxH + pad * 2);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const outContext = out.getContext('2d');
    if (!outContext) {
      bitmap.close();
      return null;
    }
    outContext.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
    bitmap.close();

    const blob = await canvasToPngBlob(out);
    return blob ? { blob, width: w, height: h, coverage: bounds.coverage } : null;
  } catch {
    return null;
  }
}
