'use client';

/**
 * Turning one photo into several garments.
 *
 * The expensive part of building a wardrobe is photographing things one at a
 * time. This lets someone shoot a whole outfit laid on the bed — or a picture
 * they liked — and pull each piece out of it by hand. No model, no guessing:
 * the person drawing the boxes already knows what is in the frame.
 *
 * Boxes are stored normalised (0–1) so they survive the image being displayed
 * at any size, and every crop is rendered to the same aspect ratio so a grid of
 * pieces cut from different photos still looks like a set.
 */

export interface CropBox {
  id: string;
  /** All four values are fractions of the source image, 0–1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Portrait, matching the closet grid's tiles. */
export const CROP_ASPECT = 4 / 5;

/** A little air around the box, so nothing is cut flush to the fabric. */
const PADDING = 0.06;

export const MIN_BOX = 0.06;

export function normaliseBox(box: CropBox): CropBox {
  const x = Math.min(box.x, box.x + box.width);
  const y = Math.min(box.y, box.y + box.height);
  const width = Math.abs(box.width);
  const height = Math.abs(box.height);
  return {
    id: box.id,
    x: clamp(x),
    y: clamp(y),
    width: Math.min(width, 1 - clamp(x)),
    height: Math.min(height, 1 - clamp(y)),
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Cut one box out of the source.
 *
 * The box is padded, then grown to the target aspect ratio. Where the image
 * runs out before the frame is filled — a garment at the very edge of the shot
 * — the remainder is filled with the crop's own border colour rather than
 * black bars, so the result still reads as a photographed object.
 */
export async function cropToBlob(
  source: ImageBitmap,
  box: CropBox,
  maxDimension = 1200,
): Promise<Blob> {
  const safe = normaliseBox(box);

  const padX = safe.width * PADDING;
  const padY = safe.height * PADDING;
  let sx = (safe.x - padX) * source.width;
  let sy = (safe.y - padY) * source.height;
  let sw = (safe.width + padX * 2) * source.width;
  let sh = (safe.height + padY * 2) * source.height;

  // Grow the short side until the region matches the output aspect.
  const currentAspect = sw / sh;
  if (currentAspect > CROP_ASPECT) {
    const wanted = sw / CROP_ASPECT;
    sy -= (wanted - sh) / 2;
    sh = wanted;
  } else {
    const wanted = sh * CROP_ASPECT;
    sx -= (wanted - sw) / 2;
    sw = wanted;
  }

  const scale = Math.min(1, maxDimension / Math.max(sw, sh));
  const outWidth = Math.max(1, Math.round(sw * scale));
  const outHeight = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot crop images');

  // Fill first, so any part of the frame that falls outside the photo is a
  // plausible backdrop instead of a black band.
  context.fillStyle = await borderColor(source, safe);
  context.fillRect(0, 0, outWidth, outHeight);

  // Intersect the wanted region with the image, and draw it where it belongs.
  const ix = Math.max(0, sx);
  const iy = Math.max(0, sy);
  const iw = Math.min(source.width, sx + sw) - ix;
  const ih = Math.min(source.height, sy + sh) - iy;
  if (iw > 0 && ih > 0) {
    context.drawImage(
      source,
      ix,
      iy,
      iw,
      ih,
      (ix - sx) * scale,
      (iy - sy) * scale,
      iw * scale,
      ih * scale,
    );
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  );
  if (!blob) throw new Error('Could not save the crop');
  return blob;
}

/** The average colour just inside the box edge — a decent stand-in for the backdrop. */
async function borderColor(source: ImageBitmap, box: CropBox): Promise<string> {
  const canvas = document.createElement('canvas');
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return '#f2eee9';

  const sx = box.x * source.width;
  const sy = box.y * source.height;
  const sw = Math.max(1, box.width * source.width);
  const sh = Math.max(1, box.height * source.height);
  context.drawImage(source, sx, sy, sw, sh, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const onEdge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      if (!onEdge) continue;
      const i = (y * size + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }
  if (!count) return '#f2eee9';
  return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
}
