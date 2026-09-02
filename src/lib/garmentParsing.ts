'use client';

import {
  ATR_LABELS,
  describeEmptyParse,
  labelMapFromMasks,
  regionMask,
  regionsFromLabelMap,
  type GarmentRegion,
  type RegionMask,
} from '@/domain/garmentClasses';

/**
 * Finding the clothes in a photograph.
 *
 * Cataloguing is where wardrobe apps lose their users, and boxing garments by
 * hand — even with a good cropper — is still the slow part. A human-parsing
 * model reads one photograph and hands back a labelled region for every garment
 * in it, which turns "draw five boxes and pick five categories" into "confirm
 * five chips".
 *
 * Four constraints shaped how this is wired in, and they are the reason it is
 * an opt-in button rather than something that just happens:
 *
 * - **It is a download, and it says so.** Twenty-seven megabytes, once, from a
 *   third party — which is a real departure for an app whose whole pitch is
 *   that it needs no keys and talks to nobody. Nobody should discover that on a
 *   train. It is asked for in plain numbers before anything is fetched, and it
 *   can be pointed at a copy you host yourself.
 * - **It never replaces the hand path.** Every photo can still be boxed by
 *   hand, and a parse that finds nothing says which of the two things went
 *   wrong rather than leaving an unchanged screen that reads as broken.
 * - **It suggests, and the person confirms.** Regions arrive as boxes with a
 *   category attached, ready to be dragged, deleted or re-labelled. Below
 *   PARSE_CONFIDENT nothing is preselected at all.
 * - **It cannot take the app down with it.** Everything here is behind a
 *   dynamic import, so the library is not in the bundle for the people who
 *   never turn it on, and every failure resolves to an error message rather
 *   than a rejected promise nobody catches.
 */

/**
 * Weights fine-tuned on ATR. The licence is the SegFormer one — fine for a
 * wardrobe on your own server, worth reading before it goes anywhere near a
 * shop.
 */
export const GARMENT_MODEL = 'Xenova/segformer_b2_clothes';

/** What the download costs, so the question can be asked honestly. */
export const MODEL_SIZE_MB = 27;

/**
 * Where the weights come from.
 *
 * Set NEXT_PUBLIC_MODEL_HOST to a copy you host and this app goes back to
 * talking to nothing but your own server, which is the promise the rest of it
 * makes and the one this feature would otherwise quietly break.
 */
const MODEL_HOST = process.env.NEXT_PUBLIC_MODEL_HOST?.trim();

/**
 * How large the photo is allowed to be going in.
 *
 * The processor resizes to the model's own input anyway, so handing it twelve
 * megapixels only costs a decode and a copy on a phone that has neither to
 * spare. Regions come back in fractions, so nothing downstream can tell.
 */
const MAX_INPUT = 1024;

export interface ParseProgress {
  /** 0–1 while the model downloads, then null once it is running. */
  downloaded: number | null;
  message: string;
}

/**
 * A region, plus the garment's own outline.
 *
 * The mask is the expensive half of the work and keeping only the rectangle
 * throws it away — it is also the half that settles the cut-out a flood fill
 * structurally cannot do, on a photo of somebody wearing the clothes.
 */
export interface ParsedGarment extends GarmentRegion {
  mask: RegionMask | null;
}

export type ParseOutcome =
  | { ok: true; regions: ParsedGarment[]; ranOn: 'webgpu' | 'wasm' }
  | { ok: false; message: string };

/* eslint-disable @typescript-eslint/no-explicit-any -- the pipeline is loaded at runtime */
type Segmenter = (input: any) => Promise<any[]>;

let loading: Promise<{ run: Segmenter; ranOn: 'webgpu' | 'wasm' }> | null = null;

/** True once the weights are in the browser's cache and a parse will be quick. */
export async function modelIsCached(): Promise<boolean> {
  if (loading) return true;
  if (typeof caches === 'undefined') return false;
  try {
    const store = await caches.open('transformers-cache');
    const entries = await store.keys();
    return entries.some((request) => request.url.includes('segformer_b2_clothes'));
  } catch {
    return false;
  }
}

/**
 * Load once, and share the promise.
 *
 * Two taps in quick succession must not start two downloads. A failed load
 * clears the promise so the next attempt is a real retry rather than the same
 * error handed out forever.
 */
async function segmenter(onProgress?: (progress: ParseProgress) => void) {
  if (!loading) {
    loading = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      if (MODEL_HOST) env.remoteHost = MODEL_HOST;
      // There are no weights inside this app, so never look for any: the probe
      // is a request that always 404s and slows down every cold start.
      env.allowLocalModels = false;

      const options = {
        // q8 is the 27 MB build. The full-precision one is 104 MB, for a
        // difference nobody boxing a jumper is going to see.
        dtype: 'q8' as const,
        progress_callback: (event: { status?: string; progress?: number }) => {
          if (!onProgress) return;
          if (event.status === 'progress' && typeof event.progress === 'number') {
            onProgress({
              downloaded: Math.min(1, event.progress / 100),
              message: `Downloading the model — ${Math.round(event.progress)}%`,
            });
          } else if (event.status === 'ready' || event.status === 'done') {
            onProgress({ downloaded: null, message: 'Reading the photo…' });
          }
        },
      };

      /*
       * WebGPU where it exists, WebAssembly where it does not.
       *
       * The difference is large enough to matter — the published figures put
       * the encoder around nineteen times faster — but WASM is a few seconds
       * rather than a failure, and a browser that reports WebGPU and then falls
       * over compiling a shader is common enough to be worth catching.
       */
      const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
      if (hasWebGPU) {
        try {
          const run = (await pipeline('image-segmentation', GARMENT_MODEL, {
            ...options,
            device: 'webgpu',
          })) as unknown as Segmenter;
          return { run, ranOn: 'webgpu' as const };
        } catch {
          // Fall through and try again on the CPU.
        }
      }

      const run = (await pipeline(
        'image-segmentation',
        GARMENT_MODEL,
        options,
      )) as unknown as Segmenter;
      return { run, ranOn: 'wasm' as const };
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/**
 * Every garment this photo contains, or a sentence saying why there are none.
 *
 * Never rejects. A screen that has been busy for four seconds and then throws
 * has told the person nothing they can act on.
 */
export async function parseGarments(
  source: Blob,
  onProgress?: (progress: ParseProgress) => void,
): Promise<ParseOutcome> {
  try {
    onProgress?.({ downloaded: 0, message: 'Getting ready…' });
    const { run, ranOn } = await segmenter(onProgress);

    onProgress?.({ downloaded: null, message: 'Reading the photo…' });
    const canvas = await downscale(source);
    const output = await run(canvas);

    if (!Array.isArray(output) || output.length === 0) {
      return { ok: false, message: describeEmptyParse(false) };
    }

    const masks = output
      .map((entry) => ({
        classId: ATR_LABELS.indexOf(entry?.label),
        data: entry?.mask?.data as ArrayLike<number> | undefined,
      }))
      .filter(
        (entry): entry is { classId: number; data: ArrayLike<number> } =>
          entry.classId > 0 && Boolean(entry.data),
      );

    // The masks come back at the size the pipeline was handed, not the model's.
    const width = output[0]?.mask?.width ?? canvas.width;
    const height = output[0]?.mask?.height ?? canvas.height;

    const labels = labelMapFromMasks(masks, width, height);
    const regions = regionsFromLabelMap(labels, width, height);

    if (regions.length === 0) {
      // A person with no nameable garment is a different problem from a photo
      // with no person in it, and the two want different advice.
      return { ok: false, message: describeEmptyParse(masks.length > 0) };
    }

    return {
      ok: true,
      regions: regions.map((region) => ({
        ...region,
        mask: regionMask(labels, width, height, region),
      })),
      ranOn,
    };
  } catch (error) {
    const reason = (error as Error)?.message ?? '';
    return {
      ok: false,
      message: /fetch|network|load/i.test(reason)
        ? 'Could not fetch the model. It needs a connection the first time; after that it works offline.'
        : 'This browser could not run the model. Draw the boxes by hand — that always works.',
    };
  }
}

/** Bound the work, and hand the pipeline something it can read directly. */
async function downscale(source: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_INPUT / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser cannot read images');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
