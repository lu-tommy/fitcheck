import type { Category, Formality, Style } from '@/types';

/**
 * Reading what somebody typed.
 *
 * "I'm going for a run" and "first day at the new office" have to produce
 * different clothes, and until now the box you type into was decorative — the
 * engine only ever read the dropdowns underneath it.
 *
 * This is a keyword matcher, not a language model: a fixed table of activities,
 * each saying how dressed up it is, which styles suit it, and which garments
 * belong or definitely do not. That is enough to separate a run from a wedding,
 * it runs instantly, it works offline, and when it does not recognise something
 * it says so rather than guessing.
 */

export interface Intent {
  /** What it thinks the occasion is, in the wearer's words. */
  occasion: string;
  formality: Formality;
  styles: Style[];
  /** Garments that belong at this occasion. */
  prefer: Category[];
  /** Garments that would be wrong for it. */
  avoid: Category[];
  /** A nudge in degrees when the words imply weather. */
  temperature?: number;
  /** Shown back to the wearer, so a wrong reading is visible and correctable. */
  summary: string;
}

interface Rule {
  occasion: string;
  /** Whole words, matched case-insensitively. */
  keywords: string[];
  formality: Formality;
  styles: Style[];
  prefer: Category[];
  avoid: Category[];
  summary: string;
}

const ATHLETIC: Category[] = ['tshirt', 'tank', 'shorts', 'joggers', 'hoodie', 'sneakers'];
const SMART: Category[] = ['shirt', 'blouse', 'chinos', 'dress-pants', 'blazer', 'loafers', 'dress-shoes'];
const TOO_CASUAL: Category[] = ['tank', 'shorts', 'joggers', 'hoodie', 'sandals'];
const TOO_SMART: Category[] = ['blazer', 'suit', 'dress-shoes', 'tie', 'dress-pants'];

/**
 * Order matters: the first rule whose keyword appears wins, so the more
 * specific activities are listed before the general ones.
 */
const RULES: Rule[] = [
  {
    occasion: 'a run',
    keywords: ['run', 'running', 'jog', 'jogging', 'gym', 'workout', 'working out', 'exercise',
      'training', 'yoga', 'pilates', 'cycling', 'spin', 'sport', 'sports', 'football', 'tennis'],
    formality: 'very-casual',
    styles: ['athletic'],
    prefer: ATHLETIC,
    avoid: ['jeans', 'chinos', 'dress-pants', 'shirt', 'blouse', 'blazer', 'suit', 'coat',
      'dress-shoes', 'loafers', 'boots', 'dress', 'skirt', 'tie'],
    summary: 'something you can move in',
  },
  {
    occasion: 'a hike',
    keywords: ['hike', 'hiking', 'trail', 'camping', 'outdoors', 'mountain'],
    formality: 'very-casual',
    styles: ['outdoor'],
    prefer: ['tshirt', 'longsleeve', 'joggers', 'chinos', 'jacket', 'boots', 'beanie'],
    avoid: ['dress-shoes', 'loafers', 'blazer', 'suit', 'skirt', 'dress', 'sandals', 'tie'],
    summary: 'something hard-wearing',
  },
  {
    occasion: 'a wedding',
    keywords: ['wedding', 'black tie', 'gala', 'ceremony', 'funeral', 'christening'],
    formality: 'formal',
    styles: ['formal'],
    prefer: ['suit', 'blazer', 'dress', 'dress-pants', 'dress-shoes', 'tie', 'shirt', 'blouse'],
    avoid: [...TOO_CASUAL, 'tshirt', 'jeans', 'sneakers'],
    summary: 'properly dressed up',
  },
  {
    occasion: 'an interview',
    keywords: ['interview', 'presentation', 'pitch', 'client', 'board'],
    formality: 'formal',
    styles: ['formal', 'business-casual'],
    prefer: SMART,
    avoid: [...TOO_CASUAL, 'tshirt', 'sneakers'],
    summary: 'sharp, and taken seriously',
  },
  {
    occasion: 'work',
    keywords: ['work', 'office', 'meeting', 'job', 'workday', 'desk', 'commute'],
    formality: 'business-casual',
    styles: ['business-casual', 'minimalist'],
    prefer: SMART,
    avoid: TOO_CASUAL,
    summary: 'office-appropriate',
  },
  {
    occasion: 'a date',
    keywords: ['date', 'dinner', 'drinks', 'cocktail', 'restaurant', 'anniversary'],
    formality: 'smart-casual',
    styles: ['minimalist', 'casual'],
    prefer: ['shirt', 'blouse', 'sweater', 'chinos', 'jeans', 'boots', 'loafers', 'dress'],
    avoid: ['shorts', 'joggers', 'tank', 'hoodie', 'sandals'],
    summary: 'a step above everyday',
  },
  {
    occasion: 'a party',
    keywords: ['party', 'club', 'clubbing', 'night out', 'birthday', 'gig', 'concert'],
    formality: 'smart-casual',
    styles: ['streetwear'],
    prefer: ['shirt', 'tshirt', 'jeans', 'boots', 'sneakers', 'jacket'],
    avoid: ['joggers', 'sandals'],
    summary: 'going out',
  },
  {
    occasion: 'the beach',
    keywords: ['beach', 'pool', 'swimming', 'seaside', 'holiday', 'vacation', 'resort'],
    formality: 'very-casual',
    styles: ['casual'],
    prefer: ['tank', 'tshirt', 'shorts', 'sandals', 'sunglasses', 'hat'],
    avoid: ['coat', 'blazer', 'suit', 'dress-shoes', 'boots', 'dress-pants'],
    summary: 'warm and easy',
  },
  {
    occasion: 'travelling',
    keywords: ['travel', 'travelling', 'flight', 'flying', 'airport', 'plane', 'train', 'road trip'],
    formality: 'casual',
    styles: ['casual', 'minimalist'],
    prefer: ['tshirt', 'hoodie', 'sweater', 'joggers', 'jeans', 'sneakers'],
    avoid: ['dress-shoes', 'suit', 'tie', 'blazer'],
    summary: 'comfortable for hours',
  },
  {
    occasion: 'school',
    keywords: ['school', 'class', 'lecture', 'university', 'uni', 'college', 'campus', 'study'],
    formality: 'casual',
    styles: ['casual', 'streetwear'],
    prefer: ['tshirt', 'hoodie', 'sweater', 'jeans', 'chinos', 'sneakers'],
    avoid: ['suit', 'tie', 'dress-shoes'],
    summary: 'easy and everyday',
  },
  {
    occasion: 'church',
    keywords: ['church', 'temple', 'mosque', 'synagogue', 'service', 'mass'],
    formality: 'business-casual',
    styles: ['business-casual'],
    prefer: SMART,
    avoid: TOO_CASUAL,
    summary: 'modest and neat',
  },
  {
    occasion: 'a day at home',
    keywords: ['home', 'indoors', 'lounging', 'relaxing', 'chilling', 'sofa', 'errands', 'nothing'],
    formality: 'very-casual',
    styles: ['casual'],
    prefer: ['tshirt', 'hoodie', 'joggers', 'shorts', 'sneakers'],
    avoid: TOO_SMART,
    summary: 'comfortable',
  },
  {
    occasion: 'brunch',
    keywords: ['brunch', 'coffee', 'lunch', 'shopping', 'market', 'museum', 'gallery'],
    formality: 'casual',
    styles: ['casual', 'minimalist'],
    prefer: ['tshirt', 'shirt', 'sweater', 'jeans', 'chinos', 'sneakers', 'boots'],
    avoid: ['suit', 'tie'],
    summary: 'relaxed but put together',
  },
];

/** Words about the weather, which the forecast cannot know about indoors. */
const WEATHER: { keywords: string[]; temperature: number; note: string }[] = [
  { keywords: ['freezing', 'snow', 'snowing', 'ice', 'icy'], temperature: -2, note: 'freezing' },
  { keywords: ['cold', 'chilly', 'chill'], temperature: 5, note: 'cold' },
  { keywords: ['rain', 'raining', 'rainy', 'wet', 'drizzle'], temperature: 10, note: 'wet' },
  { keywords: ['mild', 'cool'], temperature: 14, note: 'mild' },
  { keywords: ['warm'], temperature: 24, note: 'warm' },
  { keywords: ['hot', 'heat', 'boiling', 'scorching', 'heatwave'], temperature: 30, note: 'hot' },
];

/** Words that push the occasion a notch smarter. */
const DRESS_UP = ['first day', 'important', 'smart', 'formal', 'posh', 'fancy', 'nice'];
const DRESS_DOWN = ['casual', 'relaxed', 'chill', 'comfy', 'comfortable', 'lazy'];

const FORMALITY_LADDER: Formality[] = [
  'very-casual',
  'casual',
  'smart-casual',
  'business-casual',
  'formal',
  'black-tie',
];

function shift(formality: Formality, by: number): Formality {
  const index = FORMALITY_LADDER.indexOf(formality);
  return FORMALITY_LADDER[Math.max(0, Math.min(FORMALITY_LADDER.length - 1, index + by))];
}

/** Whole-word match, so "running" is not found inside "errands". */
function mentions(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(
    text,
  );
}

export function readIntent(input: string): Intent | null {
  const text = ` ${input.toLowerCase().trim()} `;
  if (text.trim().length < 2) return null;

  const rule = RULES.find((candidate) =>
    candidate.keywords.some((keyword) => mentions(text, keyword)),
  );
  if (!rule) return null;

  let formality = rule.formality;
  const modifiers: string[] = [];

  if (DRESS_UP.some((word) => mentions(text, word))) {
    formality = shift(formality, 1);
    modifiers.push('dressed up a notch');
  }
  if (DRESS_DOWN.some((word) => mentions(text, word))) {
    formality = shift(formality, -1);
    modifiers.push('kept relaxed');
  }

  const weather = WEATHER.find((entry) => entry.keywords.some((word) => mentions(text, word)));
  if (weather) modifiers.push(`for ${weather.note} weather`);

  return {
    occasion: rule.occasion,
    formality,
    styles: rule.styles,
    prefer: rule.prefer,
    avoid: rule.avoid,
    temperature: weather?.temperature,
    summary: [`Reading this as ${rule.occasion}`, rule.summary, ...modifiers].join(' — '),
  };
}

/** Every occasion it knows, for the quick-pick chips and for the tests. */
export const KNOWN_OCCASIONS = RULES.map((rule) => ({
  occasion: rule.occasion,
  example: rule.keywords[0],
}));
