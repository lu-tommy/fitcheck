/**
 * Single source of truth for colour.
 *
 * The light/dark maps are emitted as CSS custom properties in globals.css; this
 * module is what TypeScript reads when it needs a value directly (charts,
 * swatches, canvas drawing).
 */

export const light = {
  bg: '#F4F4F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EBEBE8',
  surfaceSunken: '#E3E4E0',
  border: '#E0E0DC',
  borderStrong: '#C9CAC4',
  text: '#16181A',
  textMuted: '#6B6F6C',
  textFaint: '#9A9E9A',
  brand: '#1F4A3D',
  brandPress: '#163629',
  brandSoft: '#E2ECE6',
  onBrand: '#FFFFFF',
  success: '#2F7A52',
  successSoft: '#E1EFE7',
  warning: '#8E6410',
  warningSoft: '#F4EAD4',
  danger: '#B03A2E',
  dangerSoft: '#F6E2DE',
  info: '#2A6076',
  infoSoft: '#E0EBF0',
} as const;

export const dark = {
  bg: '#101211',
  surface: '#1A1D1B',
  surfaceAlt: '#242825',
  surfaceSunken: '#0B0D0C',
  border: '#2F3431',
  borderStrong: '#454B47',
  text: '#EFF1EE',
  textMuted: '#99A09B',
  textFaint: '#6F766F',
  brand: '#79C6A4',
  brandPress: '#93D8B8',
  brandSoft: '#1B2E26',
  onBrand: '#0C1512',
  success: '#6FBF8D',
  successSoft: '#18291F',
  warning: '#DCA94A',
  warningSoft: '#2E2717',
  danger: '#E0796D',
  dangerSoft: '#301C1A',
  info: '#7DB2CC',
  infoSoft: '#15242B',
} as const;

/**
 * Categorical hues for the stats charts, in fixed assignment order.
 *
 * Each set passes the palette checks against its own surface — lightness band,
 * chroma floor, adjacent-pair separation under protan/deutan/tritan simulation,
 * and 3:1 contrast. Dark mode is a separately chosen set, not a lightened flip.
 * Never generate a seventh hue — fold the tail into "Other" instead.
 */
export const chartLight = ['#A83A2E', '#2166A8', '#B87F00', '#0C8F79', '#7B4BA8', '#2F7D4A'];
export const chartDark = ['#D2604A', '#4A8FD1', '#B07F14', '#12A186', '#9370CC', '#4E9A63'];

/** Named clothing colours -> swatch hex, used for filters and previews. */
export const swatches: Record<string, string> = {
  black: '#16161A',
  white: '#F7F5F2',
  grey: '#9A9691',
  charcoal: '#3A3A3F',
  navy: '#1F3557',
  blue: '#3B72B8',
  'light blue': '#9AC1E3',
  denim: '#4A6E96',
  green: '#4B7A50',
  olive: '#6B7048',
  sage: '#A3B394',
  red: '#B23A31',
  burgundy: '#6E2B33',
  pink: '#E0A7B0',
  orange: '#D2762F',
  yellow: '#DDB63F',
  beige: '#D9C7AE',
  cream: '#F0E6D6',
  tan: '#C2A178',
  brown: '#6E4C34',
  purple: '#6E5495',
  multicolor: '#8A8A8A',
};

/** Colour names offered in the item editor, in swatch-picker order. */
export const COLOR_NAMES = Object.keys(swatches);
