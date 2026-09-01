'use client';

import { describeSilhouette, guessFromSilhouette, type CategoryGuess } from '@/domain/silhouette';

/**
 * Read the alpha channel of a cut-out and ask the domain rules what it is.
 *
 * Downscaled to a fixed width first: the rules are all ratios, so a 200px mask
 * answers the same as a 3000px one and does it in a few milliseconds on a
 * phone, where the add screen is already doing a flood fill per photo.
 */
const ANALYSIS_WIDTH = 200;

export async function guessCategoryFromCutout(cutout: Blob): Promise<CategoryGuess | null> {
  try {
    const bitmap = await createImageBitmap(cutout);
    const scale = Math.min(1, ANALYSIS_WIDTH / bitmap.width);
    const width = Math.max(8, Math.round(bitmap.width * scale));
    const height = Math.max(8, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const { data } = context.getImageData(0, 0, width, height);
    const alpha = new Uint8Array(width * height);
    for (let i = 0, p = 3; i < alpha.length; i += 1, p += 4) alpha[i] = data[p];

    const shape = describeSilhouette(alpha, width, height);
    if (!shape) return null;
    return guessFromSilhouette(shape);
  } catch {
    // A guess is a convenience. If anything about it fails, the picker simply
    // stays as it was.
    return null;
  }
}
