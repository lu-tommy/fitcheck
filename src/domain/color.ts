import { swatches } from '@/lib/palette';

/**
 * Colour reasoning used both to score AI suggestions and to explain outfits to
 * the user in plain language. Everything works in HSL because hue distance is
 * what actually decides whether two garments fight each other.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export type HarmonyKind =
  | 'monochrome'
  | 'neutral'
  | 'neutral-anchored'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'mixed';

export interface HarmonyReport {
  kind: HarmonyKind;
  /** 0–100. Above 70 reads deliberate; below 40 usually reads accidental. */
  score: number;
  summary: string;
  clashes: string[];
}

const NAMED = swatches as Record<string, string>;

export function normalizeHex(input: string): string {
  let hex = input.trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${hex.toLowerCase()}`;
}

export function hexForColorName(name: string): string {
  const key = name.trim().toLowerCase();
  if (NAMED[key]) return NAMED[key];
  // "dark olive" / "washed denim" — fall back to the last recognisable word.
  const words = key.split(/[\s-]+/);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    if (NAMED[words[i]]) return NAMED[words[i]];
  }
  if (/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(key)) return normalizeHex(key);
  return NAMED.grey;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rf) h = ((gf - bf) / delta) % 6;
  else if (max === gf) h = (bf - rf) / delta + 2;
  else h = (rf - gf) / delta + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

/** Shortest distance between two hues, 0–180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Black, white, grey, navy, beige, brown — the pieces that go with anything. */
export function isNeutral(hex: string): boolean {
  const { h, s, l } = hexToHsl(hex);
  if (s < 16) return true;
  if (l < 22) return true;
  if (l > 88 && s < 30) return true;
  // Off-whites: cream and ivory carry real saturation in HSL but read as white
  // on a body, and calling them an orange accent misdescribes the outfit.
  if (l > 82 && s < 62 && h >= 15 && h <= 65) return true;
  // Warm low-saturation earth tones (beige, tan, camel, brown).
  if (h >= 15 && h <= 50 && s < 45) return true;
  // Navy behaves as a neutral even though it is saturated.
  if (h >= 200 && h <= 250 && l < 35) return true;
  /*
   * And so does indigo denim, which is the single most-worn colour in most
   * wardrobes and goes with everything in them. Left out, the analyser counted
   * a pair of jeans as an accent — so an outfit of jeans, a tee and a scarf was
   * reported as three colours fighting, which is not a thing anybody has ever
   * thought about a pair of jeans.
   */
  if (h >= 195 && h <= 250 && s < 45 && l >= 35 && l < 58) return true;
  return false;
}

export function readableTextOn(hex: string): '#FFFFFF' | '#16161A' {
  const { r, g, b } = hexToRgb(hex);
  // Relative luminance, sRGB coefficients.
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#16161A' : '#FFFFFF';
}

/**
 * Describe how a set of garment colours works together.
 *
 * The rules mirror how stylists actually talk: one or two accent colours
 * anchored by neutrals is the safest structure; three-plus competing saturated
 * hues is where outfits go wrong.
 */
export function analyzeHarmony(hexes: string[]): HarmonyReport {
  const colors = hexes.filter(Boolean).map(normalizeHex);
  if (colors.length === 0) {
    return { kind: 'neutral', score: 50, summary: 'No colours to analyse.', clashes: [] };
  }

  const hsls = colors.map(hexToHsl);
  const neutrals = colors.filter(isNeutral);
  const accents = colors.filter((hex) => !isNeutral(hex));
  const accentHsls = accents.map(hexToHsl);
  const clashes: string[] = [];

  if (accents.length === 0) {
    const lightnessSpread =
      Math.max(...hsls.map((c) => c.l)) - Math.min(...hsls.map((c) => c.l));
    return {
      kind: 'neutral',
      score: lightnessSpread > 25 ? 88 : 72,
      summary:
        lightnessSpread > 25
          ? 'An all-neutral palette with enough light-to-dark contrast to stay interesting.'
          : 'An all-neutral palette. Consider more contrast between light and dark pieces.',
      clashes: [],
    };
  }

  // Flag saturated hue pairs that sit in the awkward middle distance.
  for (let i = 0; i < accentHsls.length; i += 1) {
    for (let j = i + 1; j < accentHsls.length; j += 1) {
      const a = accentHsls[i];
      const b = accentHsls[j];
      const d = hueDistance(a.h, b.h);
      const bothVivid = a.s > 45 && b.s > 45;
      if (bothVivid && d > 35 && d < 110) {
        clashes.push(
          `${describeHue(a.h)} and ${describeHue(b.h)} are close enough to look unintentional — pull one back to a neutral.`,
        );
      }
    }
  }

  const uniqueHues = dedupeHues(accentHsls.map((c) => c.h));
  let kind: HarmonyKind;
  let score: number;
  let summary: string;

  if (uniqueHues.length === 1) {
    if (accents.length === colors.length) {
      kind = 'monochrome';
      score = 84;
      summary = `A monochrome ${describeHue(uniqueHues[0])} look — vary the shade between pieces to keep it from flattening.`;
    } else {
      kind = 'neutral-anchored';
      score = 92;
      summary = `One ${describeHue(uniqueHues[0])} accent carried by neutrals. Reliably sharp.`;
    }
  } else if (uniqueHues.length === 2) {
    const d = hueDistance(uniqueHues[0], uniqueHues[1]);
    if (d < 40) {
      kind = 'analogous';
      score = 80;
      summary = `${describeHue(uniqueHues[0])} and ${describeHue(uniqueHues[1])} sit next to each other on the wheel — a soft, tonal pairing.`;
    } else if (d > 140) {
      kind = 'complementary';
      score = 86;
      summary = `${describeHue(uniqueHues[0])} against ${describeHue(uniqueHues[1])} is a complementary contrast. Keep one dominant and the other as the accent.`;
    } else {
      kind = 'mixed';
      score = 58;
      summary = 'Two accent colours at an in-between distance. Works, but a neutral in the middle would settle it.';
    }
  } else if (uniqueHues.length === 3 && spreadIsEven(uniqueHues)) {
    kind = 'triadic';
    score = 74;
    summary = 'A triadic palette — bold. Let one colour lead and keep the other two small.';
  } else {
    kind = 'mixed';
    score = Math.max(30, 70 - (uniqueHues.length - 2) * 12);
    summary = `${uniqueHues.length} competing colours. Dropping one for a neutral will tighten this up.`;
  }

  if (neutrals.length >= accents.length) score = Math.min(100, score + 6);
  score = Math.max(0, score - clashes.length * 14);

  return { kind, score: Math.round(score), summary, clashes };
}

function dedupeHues(hues: number[]): number[] {
  const out: number[] = [];
  hues.forEach((h) => {
    if (!out.some((existing) => hueDistance(existing, h) < 18)) out.push(h);
  });
  return out;
}

function spreadIsEven(hues: number[]): boolean {
  const sorted = [...hues].sort((a, b) => a - b);
  const gaps = sorted.map((h, i) => hueDistance(h, sorted[(i + 1) % sorted.length]));
  return gaps.every((g) => g > 90);
}

export function describeHue(h: number): string {
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 160) return 'green';
  if (h < 200) return 'teal';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  if (h < 345) return 'pink';
  return 'red';
}

/**
 * Colours that reliably pair with a given piece — used for styling tips.
 *
 * `exclude` is the piece's own colour name: suggesting navy for a navy jumper
 * is technically true and completely useless.
 */
export function suggestPairings(hex: string, exclude?: string): string[] {
  const { h, s } = hexToHsl(hex);
  const own = exclude?.trim().toLowerCase();
  const drop = (list: string[]) =>
    list.filter((name) => name !== own && hexForColorName(name) !== normalizeHex(hex));

  if (isNeutral(hex)) {
    return drop(['white', 'navy', 'olive', 'burgundy', 'tan', 'charcoal', 'cream']).slice(0, 5);
  }
  const complement = (h + 180) % 360;
  const suggestions = new Set<string>(['black', 'white', 'grey', 'beige']);
  suggestions.add(describeHue(complement));
  if (s > 55) suggestions.add('navy');
  return drop([...suggestions]).slice(0, 5);
}

export const SEASONAL_PALETTES = {
  spring: ['sage', 'cream', 'light blue', 'tan', 'white'],
  summer: ['white', 'light blue', 'beige', 'olive', 'pink'],
  fall: ['burgundy', 'olive', 'brown', 'orange', 'cream'],
  winter: ['charcoal', 'navy', 'black', 'grey', 'burgundy'],
} as const;
