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
  /** Where the day itself asks for a colour. A funeral asks for black. */
  colorPreference?: string;
  /** Shown back to the wearer, so a wrong reading is visible and correctable. */
  summary: string;
}

interface Rule {
  occasion: string;
  /** Whole words, matched case-insensitively. */
  keywords: string[];
  /**
   * Phrases that veto a match however well a keyword fits.
   *
   * "Run" is a keyword for the gym and is also half of "running errands" and
   * "the school run" — both of which matched, so somebody popping to the shops
   * was dressed for a workout and had jeans, shirts and boots actively ruled
   * out. A whole-word match is not enough when the word does two jobs.
   */
  unless?: string[];
  /** Where the day itself asks for a colour, as a funeral does. */
  colorPreference?: string;
  /**
   * What to call it when a particular word was used.
   *
   * One rule can serve several days that dress identically, and the label still
   * has to be the one the person typed: somebody who wrote "the gym" was told
   * the app had built them "a run look", which is a small thing that reads as
   * not having been listened to.
   */
  names?: Record<string, string>;
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
    unless: ['errand', 'errands', 'school run', 'run out', 'run around', 'dry run', 'run to the'],
    names: {
      gym: 'the gym', workout: 'the gym', 'working out': 'the gym', training: 'training',
      exercise: 'the gym', yoga: 'yoga', pilates: 'pilates', cycling: 'a ride',
      spin: 'spin', football: 'football', tennis: 'tennis',
    },
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
    /*
     * Its own rule, and it has to come first. "Funeral" was a keyword on the
     * WEDDING rule, so the app read the two as the same day and told somebody
     * it had built them "a wedding look" — then dressed them for a celebration.
     * They are both formal and they are not remotely the same occasion.
     */
    occasion: 'a funeral',
    keywords: ['funeral', 'memorial', 'wake', 'burial'],
    formality: 'formal',
    styles: ['formal', 'minimalist'],
    colorPreference: 'black',
    prefer: ['blazer', 'suit', 'dress-pants', 'shirt', 'blouse', 'dress', 'coat', 'dress-shoes', 'flats'],
    avoid: ['shorts', 'tank', 'joggers', 'leggings', 'hoodie', 'sandals', 'sneakers', 'cap', 'swimwear'],
    summary: 'dark, plain and respectful',
  },
  {
    occasion: 'a graduation',
    keywords: ['graduation', 'graduate', 'graduating', 'prize giving', 'award'],
    formality: 'business-casual',
    styles: ['formal', 'business-casual'],
    prefer: SMART,
    avoid: ['shorts', 'joggers', 'leggings', 'hoodie', 'tank', 'swimwear'],
    summary: 'smart, and comfortable enough to sit through it',
  },
  {
    occasion: 'the theatre',
    keywords: ['theatre', 'theater', 'opera', 'ballet', 'symphony', 'orchestra'],
    formality: 'business-casual',
    styles: ['formal', 'minimalist'],
    prefer: SMART,
    avoid: ['shorts', 'joggers', 'leggings', 'tank', 'sandals', 'swimwear'],
    summary: 'smart, and warm enough for a cold auditorium',
  },
  {
    occasion: 'a baby shower',
    keywords: ['baby shower', 'christening party', 'naming'],
    formality: 'smart-casual',
    styles: ['casual', 'preppy'],
    prefer: ['blouse', 'shirt', 'dress', 'skirt', 'chinos', 'flats', 'loafers'],
    avoid: ['joggers', 'leggings', 'hoodie', 'swimwear', 'suit'],
    summary: 'smart but soft — nothing anybody has to be careful around',
  },
  {
    occasion: 'a festival',
    keywords: ['festival', 'glastonbury', 'camping trip', 'coachella'],
    formality: 'very-casual',
    styles: ['streetwear', 'outdoor', 'casual'],
    prefer: ['tshirt', 'tank', 'shorts', 'jeans', 'jacket', 'raincoat', 'boots', 'rain-boots', 'sunglasses'],
    avoid: ['dress-shoes', 'loafers', 'flats', 'blazer', 'suit', 'tie', 'blouse'],
    summary: 'layers, and something you do not mind ruining',
  },
  {
    occasion: 'a barbecue',
    keywords: ['barbecue', 'bbq', 'picnic', 'garden party', 'cookout'],
    formality: 'casual',
    styles: ['casual', 'preppy'],
    prefer: ['tshirt', 'polo', 'shirt', 'shorts', 'chinos', 'jeans', 'sneakers', 'sandals'],
    avoid: ['suit', 'blazer', 'tie', 'dress-shoes', 'dress-pants'],
    summary: 'easy, and fine to sit on grass in',
  },
  {
    occasion: 'a night out',
    keywords: ['pub', 'bar', 'pint', 'out out', 'nightclub', 'pubs'],
    formality: 'smart-casual',
    styles: ['casual', 'streetwear'],
    prefer: ['shirt', 'blouse', 'jeans', 'skirt', 'dress', 'boots', 'loafers'],
    avoid: ['joggers', 'leggings', 'hoodie', 'sandals', 'swimwear', 'cap'],
    summary: 'sharp enough for the door, comfortable enough to stand up all night',
  },
  {
    occasion: 'a wedding',
    keywords: ['wedding', 'black tie', 'gala', 'ceremony', 'christening'],
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
    keywords: ['home', 'indoors', 'lounging', 'relaxing', 'chilling', 'sofa', 'errands', 'errand', 'nothing'],
    // Errands dress like a day at home and are not one, and being told you have
    // "a day at home look" while heading to the shops reads as not listening.
    names: { errands: 'errands', errand: 'errands' },
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

  const rule = RULES.find(
    (candidate) =>
      candidate.keywords.some((keyword) => mentions(text, keyword)) &&
      !candidate.unless?.some((veto) => text.includes(veto)),
  );
  if (!rule) return null;

  // The longest matching keyword, so "working out" beats "work" for a label.
  const matched = rule.keywords
    .filter((keyword) => mentions(text, keyword))
    .sort((a, b) => b.length - a.length)[0];
  const occasion = (matched && rule.names?.[matched]) ?? rule.occasion;

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
    occasion,
    formality,
    styles: rule.styles,
    prefer: rule.prefer,
    avoid: rule.avoid,
    temperature: weather?.temperature,
    colorPreference: rule.colorPreference,
    summary: [`Reading this as ${occasion}`, rule.summary, ...modifiers].join(' — '),
  };
}

/** Every occasion it knows, for the quick-pick chips and for the tests. */
export const KNOWN_OCCASIONS = RULES.map((rule) => ({
  occasion: rule.occasion,
  example: rule.keywords[0],
}));
