/**
 * Pulling one garment out of a photograph nobody staged.
 *
 * The flood fill in `lib/backgroundRemoval` starts at the frame border and asks
 * "what colour is the backdrop?". That question only has an answer when there
 * IS a backdrop. In a mirror selfie the border is tile, curtain, skin and a
 * phone, so the fill either refuses or, worse, wanders into an arm.
 *
 * This asks a different question, and it is the question the crop screen has
 * already answered: the person drew a box around the tank top, so we know
 * roughly what is garment (the middle of the box) and definitely what is not
 * (everything outside it). Two colour models built from those two samples will
 * separate a blue tank from grey tile without knowing what either of them is.
 *
 * That is the classic box-prompted segmentation idea — GrabCut's premise minus
 * its graph cut, which needs a 6 MB WebAssembly build we would have to ship to
 * a phone. Instead the spatial coherence comes from neighbour voting, keeping
 * one connected shape and filling its holes, which is cheap enough to re-run on
 * every tap.
 *
 * Nothing here touches the DOM, so it can be reasoned about and tested against
 * drawn shapes. `lib/segment` supplies the pixels.
 */

/** Where the person tapped, in fractions of the source image. */
export interface Scribble {
  x: number;
  y: number;
  /** `keep` says "this is the garment", `drop` says "this is the room". */
  label: 'keep' | 'drop';
  /** Radius as a fraction of the image's short side. */
  radius: number;
}

export interface Region {
  /** The analysed area — the drawn box plus a margin of context — in pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The drawn box itself, relative to the region's own top-left. */
  inner: { x: number; y: number; width: number; height: number };
}

export interface SegmentResult {
  /** 0 or 255 per pixel, row-major, region-sized. */
  alpha: Uint8Array;
  width: number;
  height: number;
  /** Share of the drawn box the garment claimed. */
  coverage: number;
  /**
   * False when the split is not worth showing: a sliver, or the whole box.
   * The caller falls back to the plain rectangle rather than pretending.
   */
  confident: boolean;
}

/** Below this the model ate the garment; above it, it kept the room. */
export const TOO_THIN = 0.06;
export const TOO_GREEDY = 0.985;

/**
 * The margin of context sampled outside the drawn box.
 *
 * This is where the entire background model comes from, so it has to be wide
 * enough to contain more than one thing — a ring of nothing but forearm would
 * teach it that skin is the only background there is, and it would then keep
 * the tiled wall. 18% of the box is enough to reach past a limb.
 */
export const CONTEXT_MARGIN = 0.18;

export function regionFor(
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  margin = CONTEXT_MARGIN,
): Region {
  const bx = box.x * imageWidth;
  const by = box.y * imageHeight;
  const bw = box.width * imageWidth;
  const bh = box.height * imageHeight;

  const padX = bw * margin;
  const padY = bh * margin;
  const x = Math.max(0, Math.floor(bx - padX));
  const y = Math.max(0, Math.floor(by - padY));
  const right = Math.min(imageWidth, Math.ceil(bx + bw + padX));
  const bottom = Math.min(imageHeight, Math.ceil(by + bh + padY));

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
    inner: {
      x: Math.round(bx - x),
      y: Math.round(by - y),
      width: Math.max(1, Math.round(bw)),
      height: Math.max(1, Math.round(bh)),
    },
  };
}

/* ------------------------------------------------------------------ colour */

/**
 * sRGB to CIELAB.
 *
 * Worth the arithmetic: in RGB the lit and shaded halves of one blue tank top
 * are further apart than the tank is from the wall behind it, which is exactly
 * the mistake that makes naive background removal chew through fabric.
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const rl = lin(r);
  const gl = lin(g);
  const bl = lin(b);

  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.9505;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.089;

  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/* ------------------------------------------------------------------ models */

/**
 * k-means over LAB samples.
 *
 * Seeded deterministically — mean first, then farthest-point — because a
 * segmentation that came out differently on the same photo twice would be
 * impossible to trust, to demo, or to test.
 */
export function kmeans(samples: Float32Array, count: number, k: number, iterations = 8): Float32Array {
  const wanted = Math.min(k, count);
  if (wanted <= 0) return new Float32Array(0);

  const centroids = new Float32Array(wanted * 3);

  let mx = 0;
  let my = 0;
  let mz = 0;
  for (let i = 0; i < count; i += 1) {
    mx += samples[i * 3];
    my += samples[i * 3 + 1];
    mz += samples[i * 3 + 2];
  }
  centroids[0] = mx / count;
  centroids[1] = my / count;
  centroids[2] = mz / count;

  const best = new Float32Array(count).fill(Infinity);
  for (let c = 1; c < wanted; c += 1) {
    let far = 0;
    let farthest = 0;
    for (let i = 0; i < count; i += 1) {
      const d = distance(samples, i, centroids, c - 1);
      if (d < best[i]) best[i] = d;
      if (best[i] > far) {
        far = best[i];
        farthest = i;
      }
    }
    centroids[c * 3] = samples[farthest * 3];
    centroids[c * 3 + 1] = samples[farthest * 3 + 1];
    centroids[c * 3 + 2] = samples[farthest * 3 + 2];
  }

  const sums = new Float32Array(wanted * 3);
  const tally = new Int32Array(wanted);
  for (let step = 0; step < iterations; step += 1) {
    sums.fill(0);
    tally.fill(0);
    for (let i = 0; i < count; i += 1) {
      const owner = nearest(samples, i, centroids, wanted).index;
      sums[owner * 3] += samples[i * 3];
      sums[owner * 3 + 1] += samples[i * 3 + 1];
      sums[owner * 3 + 2] += samples[i * 3 + 2];
      tally[owner] += 1;
    }
    for (let c = 0; c < wanted; c += 1) {
      if (!tally[c]) continue;
      centroids[c * 3] = sums[c * 3] / tally[c];
      centroids[c * 3 + 1] = sums[c * 3 + 1] / tally[c];
      centroids[c * 3 + 2] = sums[c * 3 + 2] / tally[c];
    }
  }

  return centroids;
}

function distance(a: Float32Array, ai: number, b: Float32Array, bi: number): number {
  const dl = a[ai * 3] - b[bi * 3];
  const da = a[ai * 3 + 1] - b[bi * 3 + 1];
  const db = a[ai * 3 + 2] - b[bi * 3 + 2];
  return dl * dl + da * da + db * db;
}

export function nearest(
  samples: Float32Array,
  index: number,
  centroids: Float32Array,
  count: number,
): { index: number; distance: number } {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let c = 0; c < count; c += 1) {
    const d = distance(samples, index, centroids, c);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = c;
    }
  }
  return { index: bestIndex, distance: bestDistance };
}

/* ------------------------------------------------------------ segmentation */

const CLUSTERS = 5;
const SMOOTHING_PASSES = 4;

/**
 * Squared LAB distance below which two colours are the same thing to an eye.
 * ΔE 12 is a shade, not a different object.
 */
const SAME_COLOUR = 12 * 12;

/** Free = decided by colour; the rest are the caller's word and are not overruled. */
const FREE = 0;
const FORCED_KEEP = 1;
const FORCED_DROP = 2;

/**
 * How an image-fraction scribble lands in this region's pixels.
 *
 * The region is a window onto the source, analysed at reduced size, so a tap
 * needs the window's origin as well as its scale. Leaving this out was a bug
 * that put every tap in the top-left corner of the box.
 */
export interface Placement {
  imageWidth: number;
  imageHeight: number;
  /** The region's top-left in source pixels. */
  regionX: number;
  regionY: number;
  /** Analysis pixels per source pixel. */
  scale: number;
}

export interface SegmentOptions {
  /** 0 keeps generously, 1 keeps only what closely matches the middle of the box. */
  strictness?: number;
  scribbles?: Scribble[];
  placement?: Placement;
}

/**
 * Decide, for every pixel of the region, whether it is the garment.
 *
 * `rgba` is the region at analysis resolution; `region.inner` is the drawn box
 * in those same coordinates.
 */
export function segmentRegion(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  inner: { x: number; y: number; width: number; height: number },
  options: SegmentOptions = {},
): SegmentResult {
  const pixels = width * height;
  const lab = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    const [l, a, b] = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    lab[i * 3] = l;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }

  const forced = new Uint8Array(pixels);
  const insideBox = (x: number, y: number) =>
    x >= inner.x && y >= inner.y && x < inner.x + inner.width && y < inner.y + inner.height;

  /*
   * Everything outside the box is background, full stop. The person drew that
   * boundary on purpose; treating it as a hint rather than a rule is how a
   * cut-out ends up including the shoulder of whoever is holding the phone.
   */
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!insideBox(x, y)) forced[y * width + x] = FORCED_DROP;
    }
  }

  applyScribbles(forced, width, height, options);

  const keepSamples: number[] = [];
  const dropSamples: number[] = [];

  // The core of the box is the initial guess at the garment: the middle 56% by
  // side, which on a boxed top is fabric even when the arms are inside the box.
  const coreX = inner.x + inner.width * 0.22;
  const coreY = inner.y + inner.height * 0.22;
  const coreRight = inner.x + inner.width * 0.78;
  const coreBottom = inner.y + inner.height * 0.78;

  const stride = Math.max(1, Math.floor(Math.sqrt(pixels / 4000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const pixel = y * width + x;
      if (forced[pixel] === FORCED_DROP && !insideBox(x, y)) {
        dropSamples.push(pixel);
      } else if (x >= coreX && x < coreRight && y >= coreY && y < coreBottom) {
        keepSamples.push(pixel);
      }
    }
  }

  if (!keepSamples.length || !dropSamples.length) {
    return blank(width, height);
  }

  /*
   * A tap becomes a colour of its own rather than a pile of extra samples.
   *
   * Feeding taps into k-means as weighted samples looked reasonable and was
   * not: the models get a fixed number of clusters, so pointing at a navy phone
   * bought a navy cluster by evicting the one that had been holding skin, and
   * the correction removed the phone and handed back an arm. Raising the
   * cluster budget instead just let the background model learn the garment's
   * own grey hem and eat it.
   *
   * Appending the tap as an extra centroid leaves everything the model already
   * knew intact and adds one thing it did not. Corrections then only ever
   * correct.
   */
  const dropModel = withTaps(
    kmeans(gather(lab, dropSamples), dropSamples.length, CLUSTERS),
    lab,
    width,
    height,
    'drop',
    options,
  );
  const dropCount = dropModel.length / 3;

  /*
   * "The middle of the box is the garment" is a good guess and a bad rule.
   * A V-neck puts the wearer's chest dead centre; a cardigan puts whatever is
   * under it there. Left alone, the model then learns that skin is the jumper,
   * and no amount of smoothing recovers from that.
   *
   * The correction is already in the frame: the arms either side of a tank top
   * are in the margin, so skin is in the background model. Any core sample that
   * is perceptually the same colour as something already known to be background
   * is therefore dropped before the garment model is built. Photographing a
   * jumper against a wall its own colour would purge nearly everything, so if
   * too little survives the filter is abandoned and the split is reported as
   * not confident rather than quietly inverted.
   */
  const core = keepSamples.filter(
    (pixel) => nearest(lab, pixel, dropModel, dropCount).distance > SAME_COLOUR,
  );
  const trusted = core.length >= keepSamples.length * 0.25 ? core : keepSamples;

  const keepModel = withTaps(
    kmeans(gather(lab, trusted), trusted.length, CLUSTERS),
    lab,
    width,
    height,
    'keep',
    options,
  );
  const keepCount = keepModel.length / 3;

  const strictness = options.strictness ?? 0.5;
  const bias = 0.6 + strictness * 0.9;

  const mask = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) {
    if (forced[i] === FORCED_DROP) continue;
    if (forced[i] === FORCED_KEEP) {
      mask[i] = 1;
      continue;
    }
    const toKeep = nearest(lab, i, keepModel, keepCount).distance;
    const toDrop = nearest(lab, i, dropModel, dropCount).distance;
    mask[i] = toKeep * bias * bias < toDrop ? 1 : 0;
  }

  smooth(mask, forced, width, height);
  keepOneShape(mask, width, height, inner, options);
  fillHoles(mask, width, height, lab, dropModel, dropCount);

  const innerArea = inner.width * inner.height;
  let kept = 0;
  for (let i = 0; i < pixels; i += 1) kept += mask[i];
  const coverage = innerArea ? kept / innerArea : 0;

  const alpha = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i += 1) alpha[i] = mask[i] ? 255 : 0;

  return {
    alpha,
    width,
    height,
    coverage,
    confident: coverage > TOO_THIN && coverage < TOO_GREEDY,
  };
}

function blank(width: number, height: number): SegmentResult {
  return { alpha: new Uint8Array(width * height), width, height, coverage: 0, confident: false };
}

/** The model, plus one centroid for every place the person pointed. */
function withTaps(
  model: Float32Array,
  lab: Float32Array,
  width: number,
  height: number,
  label: 'keep' | 'drop',
  options: SegmentOptions,
): Float32Array {
  const marks = (options.scribbles ?? []).filter((scribble) => scribble.label === label);
  if (!marks.length) return model;

  const extra: number[] = [];
  for (const mark of marks) {
    const centre = scribbleCentre(mark, width, height, options);
    if (centre === null) continue;
    extra.push(lab[centre * 3], lab[centre * 3 + 1], lab[centre * 3 + 2]);
  }
  if (!extra.length) return model;

  const out = new Float32Array(model.length + extra.length);
  out.set(model, 0);
  out.set(extra, model.length);
  return out;
}

function gather(lab: Float32Array, indices: number[]): Float32Array {
  const out = new Float32Array(indices.length * 3);
  indices.forEach((pixel, n) => {
    out[n * 3] = lab[pixel * 3];
    out[n * 3 + 1] = lab[pixel * 3 + 1];
    out[n * 3 + 2] = lab[pixel * 3 + 2];
  });
  return out;
}

function scribbleCentre(
  scribble: Scribble,
  width: number,
  height: number,
  options: SegmentOptions,
): number | null {
  const point = scribbleToRegion(scribble, width, height, options);
  if (!point) return null;
  return point.y * width + point.x;
}

/**
 * Scribbles arrive in image fractions; the region is a window onto the image,
 * so they need the region's offset to land in the right place.
 */
function scribbleToRegion(
  scribble: Scribble,
  width: number,
  height: number,
  options: SegmentOptions,
): { x: number; y: number; radius: number } | null {
  const place = options.placement;
  const x = place
    ? Math.round((scribble.x * place.imageWidth - place.regionX) * place.scale)
    : Math.round(scribble.x * width);
  const y = place
    ? Math.round((scribble.y * place.imageHeight - place.regionY) * place.scale)
    : Math.round(scribble.y * height);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;

  const shortSide = place
    ? Math.min(place.imageWidth, place.imageHeight) * place.scale
    : Math.min(width, height);
  const radius = Math.max(1, Math.round(scribble.radius * shortSide));
  return { x, y, radius };
}

function applyScribbles(
  forced: Uint8Array,
  width: number,
  height: number,
  options: SegmentOptions,
): void {
  for (const scribble of options.scribbles ?? []) {
    const point = scribbleToRegion(scribble, width, height, options);
    if (!point) continue;
    const label = scribble.label === 'keep' ? FORCED_KEEP : FORCED_DROP;
    const r2 = point.radius * point.radius;
    for (let y = point.y - point.radius; y <= point.y + point.radius; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = point.x - point.radius; x <= point.x + point.radius; x += 1) {
        if (x < 0 || x >= width) continue;
        const dx = x - point.x;
        const dy = y - point.y;
        if (dx * dx + dy * dy > r2) continue;
        forced[y * width + x] = label;
      }
    }
  }
}

/** Neighbour voting: the cheap stand-in for a graph cut, and it kills speckle. */
function smooth(mask: Uint8Array, forced: Uint8Array, width: number, height: number): void {
  const next = new Uint8Array(mask.length);
  for (let pass = 0; pass < SMOOTHING_PASSES; pass += 1) {
    next.set(mask);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = y * width + x;
        if (forced[pixel] !== FREE) continue;
        const votes =
          mask[pixel - width - 1] + mask[pixel - width] + mask[pixel - width + 1] +
          mask[pixel - 1] + mask[pixel + 1] +
          mask[pixel + width - 1] + mask[pixel + width] + mask[pixel + width + 1];
        if (votes >= 6) next[pixel] = 1;
        else if (votes <= 2) next[pixel] = 0;
      }
    }
    mask.set(next);
  }
}

/**
 * A garment is one thing.
 *
 * Colour alone will happily also keep the blue towel on the rail behind you, so
 * only the shape connected to what was pointed at survives.
 */
function keepOneShape(
  mask: Uint8Array,
  width: number,
  height: number,
  inner: { x: number; y: number; width: number; height: number },
  options: SegmentOptions,
): void {
  const label = new Int32Array(mask.length).fill(-1);
  const sizes: number[] = [];
  const queue = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || label[start] !== -1) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    label[start] = id;
    let size = 0;
    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      size += 1;
      const x = pixel % width;
      const y = (pixel - x) / width;
      const push = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const neighbour = ny * width + nx;
        if (!mask[neighbour] || label[neighbour] !== -1) return;
        label[neighbour] = id;
        queue[tail] = neighbour;
        tail += 1;
      };
      push(x - 1, y);
      push(x + 1, y);
      push(x, y - 1);
      push(x, y + 1);
    }
    sizes.push(size);
  }

  if (!sizes.length) return;

  const wanted = new Set<number>();
  for (const scribble of options.scribbles ?? []) {
    if (scribble.label !== 'keep') continue;
    const centre = scribbleCentre(scribble, width, height, options);
    if (centre !== null && label[centre] >= 0) wanted.add(label[centre]);
  }

  if (!wanted.size) {
    const centre =
      Math.round(inner.y + inner.height / 2) * width + Math.round(inner.x + inner.width / 2);
    if (label[centre] >= 0) {
      wanted.add(label[centre]);
    } else {
      let biggest = 0;
      sizes.forEach((size, id) => {
        if (size > sizes[biggest]) biggest = id;
      });
      wanted.add(biggest);
    }
  }

  /*
   * A second shape almost as big as the first is part of the same garment — a
   * skirt split by a belt, a sleeve separated by a strap. A smaller one is
   * something else in the frame that happens to share a colour, and on a mirror
   * selfie that something is usually the phone: navy, held against a navy top,
   * and about a fifth of its size, which is exactly why a fifth was too
   * generous a threshold.
   */
  const anchor = Math.max(...[...wanted].map((id) => sizes[id]));
  sizes.forEach((size, id) => {
    if (size >= anchor * 0.45) wanted.add(id);
  });

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] && !wanted.has(label[i])) mask[i] = 0;
  }
}

/**
 * A print is a hole in the mask but not a hole in the shirt, so enclosed gaps
 * are filled back in — unless the gap is the room.
 *
 * The opening of a V-neck is enclosed by fabric on every side and is
 * emphatically not fabric; filling it puts the wearer's chest in the middle of
 * the cut-out, which is the exact thing this is supposed to remove. Size does
 * not tell the two apart. Measured on a real mirror selfie, the neckline broke
 * into five separate gaps of under 1% each — indistinguishable from a logo by
 * area, and every one of them within ΔE 11 of a colour already known to be
 * background, against ΔE 18 for the genuine texture gap.
 *
 * So the test is colour, not size: fill what is unlike the room, leave what is
 * the room. The size cap only rules out the absurd.
 */
export const LARGEST_FILLABLE_HOLE = 0.25;

function fillHoles(mask: Uint8Array, width: number, height: number, lab: Float32Array, dropModel: Float32Array, dropCount: number): void {
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);

  /** Walk one run of background, returning its pixels — bounded, so it is cheap. */
  const region = (start: number, marker: number): number[] => {
    const found: number[] = [];
    let head = 0;
    let tail = 0;
    seen[start] = marker;
    queue[tail] = start;
    tail += 1;
    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      found.push(pixel);
      const x = pixel % width;
      const y = (pixel - x) / width;
      const step = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const neighbour = ny * width + nx;
        if (mask[neighbour] || seen[neighbour]) return;
        seen[neighbour] = marker;
        queue[tail] = neighbour;
        tail += 1;
      };
      step(x - 1, y);
      step(x + 1, y);
      step(x, y - 1);
      step(x, y + 1);
    }
    return found;
  };

  // Everything reachable from the frame is outside the garment by definition.
  for (let x = 0; x < width; x += 1) {
    if (!mask[x] && !seen[x]) region(x, 1);
    const bottom = (height - 1) * width + x;
    if (!mask[bottom] && !seen[bottom]) region(bottom, 1);
  }
  for (let y = 0; y < height; y += 1) {
    const left = y * width;
    if (!mask[left] && !seen[left]) region(left, 1);
    const right = left + width - 1;
    if (!mask[right] && !seen[right]) region(right, 1);
  }

  let kept = 0;
  for (let i = 0; i < mask.length; i += 1) kept += mask[i];
  const limit = kept * LARGEST_FILLABLE_HOLE;

  const mean = new Float32Array(3);
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] || seen[i]) continue;
    const hole = region(i, 2);
    if (hole.length > limit) continue;

    mean.fill(0);
    for (const pixel of hole) {
      mean[0] += lab[pixel * 3];
      mean[1] += lab[pixel * 3 + 1];
      mean[2] += lab[pixel * 3 + 2];
    }
    mean[0] /= hole.length;
    mean[1] /= hole.length;
    mean[2] /= hole.length;

    // Background showing through a neckline or an armhole stays a gap.
    if (nearest(mean, 0, dropModel, dropCount).distance <= SAME_COLOUR) continue;
    for (const pixel of hole) mask[pixel] = 1;
  }
}
