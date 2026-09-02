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

/**
 * The garment's own outline, at whatever resolution it was measured.
 *
 * Given, the crop comes back as a transparent PNG cut to this shape instead of
 * a rectangle. Covers exactly the drawn box, so it is stretched to the region
 * rather than positioned within it.
 */
export interface CropMask {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export async function cropToBlob(
  source: ImageBitmap,
  box: CropBox,
  maxDimension = 1200,
  mask?: CropMask,
): Promise<Blob> {
  const safe = normaliseBox(box);
  const plan = cropFrame(safe, source.width, source.height, maxDimension);
  const { sx, sy, sw, sh, outWidth, outHeight, scale } = plan;

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const context = canvas.getContext('2d', { willReadFrequently: Boolean(mask) });
  if (!context) throw new Error('This browser cannot crop images');

  // A cut-out keeps a transparent ground; a rectangle gets a plausible backdrop
  // wherever the tile-shaped frame reaches past the photo, rather than a black
  // band that reads as damage.
  if (!mask) {
    context.fillStyle = await borderColor(source, safe);
    context.fillRect(0, 0, outWidth, outHeight);
  }

  context.drawImage(source, sx, sy, sw, sh, plan.left, plan.top, sw * scale, sh * scale);

  if (mask) {
    applyMask(context, plan, mask);
    return canvasToPng(canvas);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.86),
  );
  if (!blob) throw new Error('Could not save the crop');
  return blob;
}

/**
 * Punch the garment's shape out of the tile.
 *
 * Only the region the box covers is touched — the rest of the tile is frame,
 * and was already transparent. Nearest-neighbour sampling is deliberate: the
 * mask is a statement about which pixels are cloth, and interpolating it would
 * invent half-cloth pixels along every edge that no rule downstream knows how
 * to read.
 */
function applyMask(
  context: CanvasRenderingContext2D,
  plan: CropPlan,
  mask: CropMask,
): void {
  const left = Math.round(plan.left);
  const top = Math.round(plan.top);
  const width = Math.max(1, Math.round(plan.sw * plan.scale));
  const height = Math.max(1, Math.round(plan.sh * plan.scale));
  if (left >= context.canvas.width || top >= context.canvas.height) return;

  const region = context.getImageData(left, top, width, height);
  const { data } = region;

  for (let y = 0; y < height; y += 1) {
    const my = Math.min(mask.height - 1, Math.floor((y / height) * mask.height));
    for (let x = 0; x < width; x += 1) {
      const mx = Math.min(mask.width - 1, Math.floor((x / width) * mask.width));
      if (mask.data[my * mask.width + mx] > 127) continue;
      data[(y * width + x) * 4 + 3] = 0;
    }
  }

  context.putImageData(region, left, top);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not save the crop'))),
      'image/png',
    ),
  );
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

/* ------------------------------------------------------------- rotation -- */

/**
 * Turning the photo, before anything is boxed.
 *
 * The crop is exactly the box that was drawn — that promise is the reason this
 * screen exists — and it is an axis-aligned box, which is the one thing it
 * cannot do anything about. A jumper photographed at a tilt does not fit in an
 * upright rectangle, so the only way to frame it was to draw a bigger box and
 * take the wall back in with it. No amount of care with the handles beats the
 * geometry; the photo has to turn.
 *
 * Rotation therefore rewrites the working image rather than being a layer over
 * the top of it. Everything downstream — the boxes, the crop, the colour
 * detection, the cut-out — then goes on believing it is looking at an ordinary
 * upright photograph, which is why none of it had to change.
 */

/** The size of the upright box a rotated image needs. */
export function rotatedExtent(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  };
}

/**
 * Where a box lands once the photo underneath it has turned.
 *
 * The four corners are carried through the rotation and an upright box is taken
 * around where they end up, so whatever was inside the box before the turn is
 * inside it afterwards. At ninety degrees that is exact. At five it is slightly
 * generous in pixels — a tilted rectangle does not fit in an upright one — and
 * generous is the right way round: a box that clipped a hem would not be
 * noticed until somebody looked at the finished tile.
 *
 * As a FRACTION the box can come out smaller, because the canvas grew to hold
 * the corners the turn opened up and grew faster than the box did. Nothing is
 * lost; the frame around it simply got bigger.
 */
export function rotateBox(
  box: CropBox,
  degrees: number,
  sourceWidth: number,
  sourceHeight: number,
): CropBox {
  const safe = normaliseBox(box);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const target = rotatedExtent(sourceWidth, sourceHeight, degrees);

  const corners = [
    [safe.x, safe.y],
    [safe.x + safe.width, safe.y],
    [safe.x + safe.width, safe.y + safe.height],
    [safe.x, safe.y + safe.height],
  ].map(([fx, fy]) => {
    const dx = fx * sourceWidth - sourceWidth / 2;
    const dy = fy * sourceHeight - sourceHeight / 2;
    return [
      (dx * cos - dy * sin + target.width / 2) / target.width,
      (dx * sin + dy * cos + target.height / 2) / target.height,
    ];
  });

  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = clamp(Math.min(...xs));
  const top = clamp(Math.min(...ys));

  return {
    id: box.id,
    x: left,
    y: top,
    width: Math.min(1 - left, clamp(Math.max(...xs)) - left),
    height: Math.min(1 - top, clamp(Math.max(...ys)) - top),
  };
}

/**
 * Paint the photo onto a canvas turned by `degrees`.
 *
 * The corners a straighten opens up are filled with the photo's own border
 * colour rather than left black, for the same reason the crop pads that way:
 * a black wedge reads as damage, and a plausible backdrop reads as framing.
 */
export async function rotateImage(source: Blob, degrees: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const target = rotatedExtent(bitmap.width, bitmap.height, degrees);

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser cannot rotate images');
  }

  context.fillStyle = await borderColor(bitmap, { id: 'whole', x: 0, y: 0, width: 1, height: 1 });
  context.fillRect(0, 0, target.width, target.height);

  context.translate(target.width / 2, target.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  );
  if (!blob) throw new Error('Could not turn the photo');
  return blob;
}

/* -------------------------------------------------------------- keyboard -- */

export type Nudge = 'move' | 'resize';

/**
 * Move or resize a box by a whole number of screen pixels.
 *
 * The cropper was built entirely around a finger and was, as a result,
 * unusable without one: the boxes are plain elements with no focus and no
 * keys, so a desktop user had a mouse-only tool and a screen-reader user had
 * none at all.
 *
 * It is also, incidentally, the most precise instrument on the screen. The
 * whole argument for pinch-zoom is that a fingertip covers a hundred source
 * pixels; an arrow key covers exactly one, at any zoom, without a magnifier or
 * a steady hand.
 *
 * Steps arrive in screen pixels and are converted here, so a nudge means the
 * same thing to the eye whether the photo is fitted or magnified ten times —
 * which is the only definition that makes sense for a key that is meant to
 * move something "a little".
 */
export function nudgeBox(
  box: CropBox,
  dxPixels: number,
  dyPixels: number,
  mode: Nudge,
  displayWidth: number,
  displayHeight: number,
): CropBox {
  if (!displayWidth || !displayHeight) return box;
  const safe = normaliseBox(box);
  const dx = dxPixels / displayWidth;
  const dy = dyPixels / displayHeight;

  if (mode === 'move') {
    return {
      ...safe,
      x: clamp(safe.x + dx, 0, 1 - safe.width),
      y: clamp(safe.y + dy, 0, 1 - safe.height),
    };
  }

  // Resizing pulls the far edges, so the top-left stays where it was put —
  // which is what somebody watching the box expects a width key to do.
  return {
    ...safe,
    width: clamp(safe.width + dx, MIN_BOX, 1 - safe.x),
    height: clamp(safe.height + dy, MIN_BOX, 1 - safe.y),
  };
}

/**
 * What to call a box out loud.
 *
 * Percentages rather than pixels: the numbers a screen reader says have to mean
 * something without the photo's dimensions in front of you, and "a third of the
 * way across" is a position anybody can picture.
 */
export function describeBox(box: CropBox, index: number, label?: string): string {
  const safe = normaliseBox(box);
  const pct = (value: number) => Math.round(value * 100);
  const named = label ? `${label}, ` : '';
  return (
    `Piece ${index}: ${named}${pct(safe.width)} by ${pct(safe.height)} per cent of the photo, ` +
    `${pct(safe.x)} per cent from the left and ${pct(safe.y)} per cent from the top`
  );
}
