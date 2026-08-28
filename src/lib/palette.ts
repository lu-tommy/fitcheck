/**
 * Single source of truth for colour.
 *
 * The light/dark maps are emitted as CSS custom properties in globals.css; this
 * module is what TypeScript reads when it needs a value directly (charts,
 * swatches, canvas drawing).
 */

export const light = {
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F2EEE9',
  surfaceSunken: '#EDE7E0',
  border: '#E6DFD6',
  borderStrong: '#D6CCC0',
  text: '#1A1714',
  textMuted: '#7A716A',
  textFaint: '#A9A099',
  brand: '#C8553D',
  brandPress: '#AE452F',
  brandSoft: '#F7E5DF',
  onBrand: '#FFFFFF',
  success: '#3F8F5E',
  successSoft: '#E2F0E7',
  warning: '#B98105',
  warningSoft: '#F8ECD4',
  danger: '#BE4238',
  dangerSoft: '#F7E1DE',
  info: '#2F6D8F',
  infoSoft: '#E0EDF3',
} as const;

export const dark = {
  bg: '#131211',
  surface: '#1C1A19',
  surfaceAlt: '#262322',
  surfaceSunken: '#0E0D0D',
  border: '#332F2D',
  borderStrong: '#474240',
  text: '#F5F1EC',
  textMuted: '#A29A93',
  textFaint: '#7A726C',
  brand: '#E4795F',
  brandPress: '#F0917B',
  brandSoft: '#3A2622',
  onBrand: '#1A1714',
  success: '#6FBF8D',
  successSoft: '#1E2E24',
  warning: '#E0AE4A',
  warningSoft: '#332A18',
  danger: '#E58076',
  dangerSoft: '#331F1D',
  info: '#7FB6D1',
  infoSoft: '#18262D',
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
