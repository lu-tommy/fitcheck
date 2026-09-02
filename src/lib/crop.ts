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

/**
 * The smallest a box may become mid-gesture, as a fraction of the photo.
 *
 * This is a geometric floor and nothing more: it stops an edge being dragged
 * past its opposite one and turning the box inside out, which would rename its
 * own handles halfway through a drag.
 *
 * It used to be 0.03 and to double as the test for "was that a drag or a tap?",
 * which quietly turned it into a minimum GARMENT size — and 3% of a photo is a
 * large object. A ring, a pair of earrings or a watch face shot from a normal
 * distance is smaller than that, so a box drawn carefully around one was
 * deleted the moment the finger lifted, with no message and nothing to appeal
 * to. Zooming could not rescue it either: the threshold is in fractions of the
 * source, so magnifying ten times changes how precisely you can draw and not
 * one thing about what survives.
 *
 * The drag-or-tap question is now asked in screen pixels, where it belongs.
 */
export const MIN_BOX = 0.002;

/**
 * How far a finger must travel before it is drawing rather than tapping, in
 * screen pixels. Below this the press is a tap — which selects, and which pairs
 * up into the double-tap zoom — and leaves nothing behind.
 */
export const MIN_DRAG_PX = 12;

/**
 * Whether a box is something drawn or the residue of a tap.
 *
 * The question is about the gesture, so it is asked in the units the gesture
 * happened in. Asking it in fractions of the photo is what made a tiny garment
 * indistinguishable from a stray tap.
 */
export function isDrawnBox(
  box: CropBox,
  displayWidth: number,
  displayHeight: number,
): boolean {
  return (
    Math.abs(box.width) * displayWidth >= MIN_DRAG_PX &&
    Math.abs(box.height) * displayHeight >= MIN_DRAG_PX
  );
}

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
 * Cut one box out of the source. Exactly the box, and nothing else.
 *
 * This used to pad the box by 6% and then GROW it until it matched the tile's
 * shape, taking whatever the photo happened to have there. On a mirror selfie
 * that is more wall, more arm and more of the shorts — so a box placed
 * carefully around a tank top still produced a tile with a bathroom in it. No
 * amount of care with the box could beat the crop widening afterwards.
 *
 * The region is now honoured to the pixel. It is centred in a tile-shaped frame
 * and whatever the frame does not cover is filled with the crop's own border
 * colour, so a grid of pieces still lines up without a single pixel being added
 * from outside what was framed. Draw the box at 4:5 and there is nothing to
 * fill at all.
 */
export interface CropPlan {
  /** The region to read, in source pixels. Exactly the drawn box. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** The tile the region is centred in. */
  outWidth: number;
  outHeight: number;
  left: number;
  top: number;
  scale: number;
}

/**
 * Where the drawn box lands in the finished tile.
 *
 * Separated from the canvas work so the promise this screen makes — the crop is
 * the box, to the pixel — is something a test can hold it to.
 */
export function cropFrame(
  box: CropBox,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension = 1200,
): CropPlan {
  const safe = normaliseBox(box);
  const sx = safe.x * sourceWidth;
  const sy = safe.y * sourceHeight;
  const sw = Math.max(1, safe.width * sourceWidth);
  const sh = Math.max(1, safe.height * sourceHeight);

  // The frame is never smaller than the region, so nothing drawn is cut back
  // off; a box already at the tile's shape needs no frame at all.
  const frameWidth = Math.max(sw, sh * CROP_ASPECT);
  const frameHeight = Math.max(sh, sw / CROP_ASPECT);

  const scale = Math.min(1, maxDimension / Math.max(frameWidth, frameHeight));
  const outWidth = Math.max(1, Math.round(frameWidth * scale));
  const outHeight = Math.max(1, Math.round(frameHeight * scale));

  return {
    sx,
    sy,
    sw,
    sh,
    outWidth,
    outHeight,
    left: (outWidth - sw * scale) / 2,
    top: (outHeight - sh * scale) / 2,
    scale,
  };
}

export async function cropToBlob(
  source: ImageBitmap,
  box: CropBox,
  maxDimension = 1200,
): Promise<Blob> {
  const safe = normaliseBox(box);
  const plan = cropFrame(safe, source.width, source.height, maxDimension);
  const { sx, sy, sw, sh, outWidth, outHeight, scale } = plan;

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot crop images');

  // Fill first, so any part of the frame that falls outside the photo is a
  // plausible backdrop instead of a black band.
  context.fillStyle = await borderColor(source, safe);
  context.fillRect(0, 0, outWidth, outHeight);

  context.drawImage(source, sx, sy, sw, sh, plan.left, plan.top, sw * scale, sh * scale);

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
