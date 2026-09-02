import type {
  Category,
  Fit,
  Formality,
  Length,
  Metal,
  Pattern,
  PatternScale,
  Rise,
  Season,
  Slot,
  Style,
} from '@/types';

export interface CategoryMeta {
  category: Category;
  label: string;
  slot: Slot;
  /** Rough warmth contribution, 0 (none) to 3 (very warm). Drives weather fit. */
  warmth: number;
  /** Typical formality, used when the user skips the field. */
  formality: Formality;
}

export const CATEGORIES: CategoryMeta[] = [
  { category: 'hat', label: 'Hat', slot: 'headwear', warmth: 0, formality: 'casual' },
  { category: 'cap', label: 'Cap', slot: 'headwear', warmth: 0, formality: 'very-casual' },
  { category: 'beanie', label: 'Beanie', slot: 'headwear', warmth: 1, formality: 'casual' },

  { category: 'tshirt', label: 'T-shirt', slot: 'top', warmth: 0, formality: 'casual' },
  { category: 'polo', label: 'Polo', slot: 'top', warmth: 0, formality: 'smart-casual' },
  { category: 'shirt', label: 'Shirt', slot: 'top', warmth: 1, formality: 'business-casual' },
  { category: 'blouse', label: 'Blouse', slot: 'top', warmth: 0, formality: 'business-casual' },
  { category: 'tank', label: 'Tank top', slot: 'top', warmth: 0, formality: 'very-casual' },
  { category: 'longsleeve', label: 'Long sleeve', slot: 'top', warmth: 1, formality: 'casual' },

  { category: 'sweater', label: 'Sweater', slot: 'midlayer', warmth: 2, formality: 'smart-casual' },
  { category: 'hoodie', label: 'Hoodie', slot: 'midlayer', warmth: 2, formality: 'very-casual' },
  { category: 'cardigan', label: 'Cardigan', slot: 'midlayer', warmth: 2, formality: 'smart-casual' },
  { category: 'vest', label: 'Vest', slot: 'midlayer', warmth: 1, formality: 'smart-casual' },

  { category: 'jacket', label: 'Jacket', slot: 'outerwear', warmth: 2, formality: 'casual' },
  { category: 'blazer', label: 'Blazer', slot: 'outerwear', warmth: 1, formality: 'business-casual' },
  { category: 'coat', label: 'Coat', slot: 'outerwear', warmth: 3, formality: 'business-casual' },
  { category: 'parka', label: 'Parka', slot: 'outerwear', warmth: 3, formality: 'casual' },

  { category: 'dress', label: 'Dress', slot: 'fullbody', warmth: 0, formality: 'formal' },
  { category: 'jumpsuit', label: 'Jumpsuit', slot: 'fullbody', warmth: 1, formality: 'smart-casual' },
  { category: 'suit', label: 'Suit', slot: 'fullbody', warmth: 1, formality: 'formal' },

  { category: 'jeans', label: 'Jeans', slot: 'bottom', warmth: 1, formality: 'casual' },
  { category: 'chinos', label: 'Chinos', slot: 'bottom', warmth: 1, formality: 'smart-casual' },
  { category: 'dress-pants', label: 'Dress pants', slot: 'bottom', warmth: 1, formality: 'formal' },
  { category: 'shorts', label: 'Shorts', slot: 'bottom', warmth: 0, formality: 'very-casual' },
  { category: 'joggers', label: 'Joggers', slot: 'bottom', warmth: 1, formality: 'very-casual' },
  { category: 'skirt', label: 'Skirt', slot: 'bottom', warmth: 0, formality: 'smart-casual' },

  { category: 'sneakers', label: 'Sneakers', slot: 'footwear', warmth: 0, formality: 'casual' },
  { category: 'boots', label: 'Boots', slot: 'footwear', warmth: 2, formality: 'smart-casual' },
  { category: 'dress-shoes', label: 'Dress shoes', slot: 'footwear', warmth: 0, formality: 'formal' },
  { category: 'loafers', label: 'Loafers', slot: 'footwear', warmth: 0, formality: 'business-casual' },
  { category: 'sandals', label: 'Sandals', slot: 'footwear', warmth: 0, formality: 'very-casual' },

  { category: 'watch', label: 'Watch', slot: 'accessory', warmth: 0, formality: 'smart-casual' },
  { category: 'belt', label: 'Belt', slot: 'accessory', warmth: 0, formality: 'smart-casual' },
  { category: 'necklace', label: 'Necklace', slot: 'accessory', warmth: 0, formality: 'smart-casual' },
  { category: 'earrings', label: 'Earrings', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'bracelet', label: 'Bracelet', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'ring', label: 'Ring', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'brooch', label: 'Brooch', slot: 'accessory', warmth: 0, formality: 'business-casual' },
  { category: 'sunglasses', label: 'Sunglasses', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'scarf', label: 'Scarf', slot: 'accessory', warmth: 2, formality: 'casual' },
  { category: 'tie', label: 'Tie', slot: 'accessory', warmth: 0, formality: 'formal' },
  { category: 'bow-tie', label: 'Bow tie', slot: 'accessory', warmth: 0, formality: 'formal' },
  { category: 'pocket-square', label: 'Pocket square', slot: 'accessory', warmth: 0, formality: 'formal' },
  { category: 'headband', label: 'Headband', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'hair-clip', label: 'Hair clip', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'socks', label: 'Socks', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'tights', label: 'Tights', slot: 'accessory', warmth: 1, formality: 'smart-casual' },
  { category: 'bag', label: 'Bag', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'gloves', label: 'Gloves', slot: 'accessory', warmth: 2, formality: 'casual' },
  { category: 'other', label: 'Other', slot: 'accessory', warmth: 0, formality: 'casual' },
];

const CATEGORY_INDEX = new Map<Category, CategoryMeta>(
  CATEGORIES.map((meta) => [meta.category, meta]),
);

export function categoryMeta(category: Category): CategoryMeta {
  return CATEGORY_INDEX.get(category) ?? CATEGORY_INDEX.get('other')!;
}

export function categoryLabel(category: Category): string {
  return categoryMeta(category).label;
}

export function slotOf(category: Category): Slot {
  return categoryMeta(category).slot;
}

/** Top-to-bottom rendering order for the outfit preview. */
export const SLOT_ORDER: Slot[] = [
  'headwear',
  'outerwear',
  'midlayer',
  'top',
  'fullbody',
  'bottom',
  'footwear',
  'accessory',
];

export const SLOT_LABEL: Record<Slot, string> = {
  headwear: 'Headwear',
  outerwear: 'Outerwear',
  midlayer: 'Layer',
  top: 'Top',
  fullbody: 'Full piece',
  bottom: 'Bottom',
  footwear: 'Shoes',
  accessory: 'Accessories',
};

/**
 * Where on the body an accessory is worn.
 *
 * "Accessory" is not one slot. A watch, a belt and a pair of sunglasses are
 * worn together, not instead of one another — treating them as a single bucket
 * means the app offers you a belt as an alternative to your watch, and quietly
 * caps a whole category at two pieces. Position is what actually competes:
 * only one thing goes round a wrist at a time.
 */
export type AccessoryPosition =
  | 'head'
  | 'eyes'
  | 'ears'
  | 'neck'
  | 'chest'
  | 'wrist'
  | 'finger'
  | 'waist'
  | 'legs'
  | 'carried'
  | 'hands'
  | 'other';

const ACCESSORY_POSITION: Partial<Record<Category, AccessoryPosition>> = {
  headband: 'head',
  'hair-clip': 'head',
  sunglasses: 'eyes',
  earrings: 'ears',
  necklace: 'neck',
  scarf: 'neck',
  tie: 'neck',
  'bow-tie': 'neck',
  brooch: 'chest',
  'pocket-square': 'chest',
  watch: 'wrist',
  bracelet: 'wrist',
  ring: 'finger',
  belt: 'waist',
  socks: 'legs',
  tights: 'legs',
  bag: 'carried',
  gloves: 'hands',
  other: 'other',
};

export function accessoryPosition(category: Category): AccessoryPosition {
  return ACCESSORY_POSITION[category] ?? 'other';
}

export const ACCESSORY_POSITION_LABEL: Record<AccessoryPosition, string> = {
  head: 'Hair',
  eyes: 'Eyewear',
  ears: 'Earrings',
  neck: 'Neck',
  chest: 'Lapel',
  wrist: 'Wrist',
  finger: 'Rings',
  waist: 'Waist',
  legs: 'Legwear',
  carried: 'Bag',
  hands: 'Hands',
  other: 'Accessory',
};

/** The order accessories are offered and drawn in, roughly head to toe. */
export const ACCESSORY_POSITION_ORDER: AccessoryPosition[] = [
  'head',
  'eyes',
  'ears',
  'neck',
  'chest',
  'wrist',
  'finger',
  'waist',
  'legs',
  'carried',
  'hands',
  'other',
];

/**
 * How much attention one accessory asks for.
 *
 * The rule stylists use is three — past that, pieces stop supporting an outfit
 * and start arguing with it. This used to be implemented as a cap of three
 * OBJECTS, which is not the same claim and gets ordinary dressing wrong in both
 * directions. A belt half-hidden under a jacket spent the same budget as a
 * statement necklace, so a belt, a watch and sunglasses filled the whole
 * allowance and locked out the one piece anybody would actually notice; while
 * three thin bracelets on the same wrist read as a single point and were
 * counted as the lot.
 *
 * So the budget is spent in focal points rather than in things. Roughly: a
 * piece somebody would comment on costs 1, a piece they would register costs
 * about a half, and a piece that is simply doing its job costs a fraction.
 */
const ACCESSORY_FOCAL_WEIGHT: Partial<Record<Category, number>> = {
  necklace: 1,
  earrings: 1,
  bag: 1,
  scarf: 1,
  'bow-tie': 0.9,
  sunglasses: 0.8,
  tie: 0.8,
  brooch: 0.8,
  headband: 0.7,
  watch: 0.6,
  bracelet: 0.6,
  gloves: 0.5,
  'pocket-square': 0.5,
  tights: 0.4,
  'hair-clip': 0.3,
  socks: 0.3,
  ring: 0.3,
  belt: 0.3,
};

/** Unknown pieces sit in the middle: noticeable, not a statement. */
export function accessoryFocalWeight(category: Category): number {
  return ACCESSORY_FOCAL_WEIGHT[category] ?? 0.5;
}

/** The rule of three, measured in focal points rather than in objects. */
export const ACCESSORY_FOCAL_BUDGET = 3;

/**
 * The order a wardrobe is browsed in, which is not the order an outfit is
 * stacked in. SLOT_ORDER runs head to toe because that is how a look is
 * assembled; a person looking for something to wear starts at tops.
 */
export const SLOT_BROWSE_ORDER: Slot[] = [
  'top',
  'bottom',
  'fullbody',
  'footwear',
  'outerwear',
  'midlayer',
  'headwear',
  'accessory',
];

/**
 * The same slots as group headings. "Top" labels one garment in an outfit;
 * "Tops" labels the shelf they came from, and the two read differently enough
 * to be worth spelling out rather than pluralising by hand at each call site.
 */
export const SLOT_LABEL_PLURAL: Record<Slot, string> = {
  headwear: 'Headwear',
  outerwear: 'Outerwear',
  midlayer: 'Layers',
  top: 'Tops',
  fullbody: 'Full pieces',
  bottom: 'Bottoms',
  footwear: 'Shoes',
  accessory: 'Accessories',
};

/** Slots that may only hold one item in a valid outfit. */
export const SINGLE_ITEM_SLOTS: Slot[] = [
  'headwear',
  'top',
  'outerwear',
  'fullbody',
  'bottom',
  'footwear',
];

export const FORMALITY_ORDER: Formality[] = [
  'very-casual',
  'casual',
  'smart-casual',
  'business-casual',
  'formal',
  'black-tie',
];

export const FORMALITY_LABEL: Record<Formality, string> = {
  'very-casual': 'Very casual',
  casual: 'Casual',
  'smart-casual': 'Smart casual',
  'business-casual': 'Business casual',
  formal: 'Formal',
  'black-tie': 'Black tie',
};

export function formalityScore(formality: Formality): number {
  return FORMALITY_ORDER.indexOf(formality);
}

export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

export const STYLES: Style[] = [
  'casual',
  'streetwear',
  'business-casual',
  'formal',
  'athletic',
  'minimalist',
  'outdoor',
  'preppy',
  'vintage',
];

export const STYLE_LABEL: Record<Style, string> = {
  casual: 'Casual',
  streetwear: 'Streetwear',
  'business-casual': 'Business casual',
  formal: 'Formal',
  athletic: 'Athletic',
  minimalist: 'Minimalist',
  outdoor: 'Outdoor',
  preppy: 'Preppy',
  vintage: 'Vintage',
};

export const PATTERNS: Pattern[] = [
  'solid',
  'striped',
  'checked',
  'plaid',
  'floral',
  'graphic',
  'camo',
  'polka-dot',
  'houndstooth',
  'textured',
  'other',
];

export const PATTERN_LABEL: Record<Pattern, string> = {
  solid: 'Solid',
  striped: 'Striped',
  checked: 'Checked',
  plaid: 'Plaid',
  floral: 'Floral',
  graphic: 'Graphic',
  camo: 'Camo',
  'polka-dot': 'Polka dot',
  houndstooth: 'Houndstooth',
  textured: 'Textured',
  other: 'Other',
};

export const MATERIALS = [
  'Cotton',
  'Linen',
  'Wool',
  'Cashmere',
  'Denim',
  'Leather',
  'Suede',
  'Silk',
  'Polyester',
  'Nylon',
  'Fleece',
  'Down',
  'Corduroy',
  'Canvas',
  'Knit',
  // Not a fabric, but the wardrobe now holds earrings, brooches and rings, and
  // an editor offering only cloth for them reads as a list that forgot they
  // exist. Nothing washes it — see NEVER_WASHED in domain/care.
  'Metal',
];

export const LAUNDRY_LABEL = {
  clean: 'Clean',
  dirty: 'Dirty',
  washing: 'Washing',
} as const;

/** Occasion presets offered on the generate screen. */
export const OCCASIONS = [
  { key: 'work', label: 'Work', prompt: "I'm going to work", formality: 'business-casual' as Formality },
  { key: 'date', label: 'Date', prompt: 'I have a date tonight', formality: 'smart-casual' as Formality },
  { key: 'school', label: 'School', prompt: "I'm going to school", formality: 'casual' as Formality },
  { key: 'wedding', label: 'Wedding', prompt: "I'm attending a wedding", formality: 'formal' as Formality },
  { key: 'dinner', label: 'Dinner', prompt: 'Dinner out with friends', formality: 'smart-casual' as Formality },
  { key: 'travel', label: 'Travel', prompt: "I'm travelling today", formality: 'casual' as Formality },
  { key: 'hiking', label: 'Hiking', prompt: "I'm going hiking", formality: 'very-casual' as Formality },
  { key: 'gym', label: 'Gym', prompt: "I'm heading to the gym", formality: 'very-casual' as Formality },
  { key: 'home', label: 'Home', prompt: "I'm staying home today", formality: 'very-casual' as Formality },
  { key: 'party', label: 'Party', prompt: "I'm going to a party", formality: 'smart-casual' as Formality },
];

/* ------------------------------------------------------------------ shape -- */

export const FIT_ORDER: Fit[] = ['fitted', 'regular', 'relaxed', 'oversized'];

export const FIT_LABEL: Record<Fit, string> = {
  fitted: 'Fitted',
  regular: 'Regular',
  relaxed: 'Relaxed',
  oversized: 'Oversized',
};

export const LENGTH_ORDER: Length[] = ['cropped', 'regular', 'long'];

export const LENGTH_LABEL: Record<Length, string> = {
  cropped: 'Cropped',
  regular: 'Regular',
  long: 'Long',
};

export const RISE_ORDER: Rise[] = ['low', 'mid', 'high'];

export const RISE_LABEL: Record<Rise, string> = {
  low: 'Low rise',
  mid: 'Mid rise',
  high: 'High rise',
};

export const PATTERN_SCALE_ORDER: PatternScale[] = ['micro', 'medium', 'bold'];

export const PATTERN_SCALE_LABEL: Record<PatternScale, string> = {
  micro: 'Micro',
  medium: 'Medium',
  bold: 'Bold',
};

/**
 * Which shape questions a garment can answer.
 *
 * Asking a pair of sunglasses how it is cut is the sort of thing that turns a
 * two-field form into the fourteen-input form the reviews describe people
 * quitting over. Volume matters on anything that covers the body; where the hem
 * falls only matters above the waist; rise only exists below it.
 */
const VOLUME_SLOTS: Slot[] = ['top', 'midlayer', 'outerwear', 'bottom', 'fullbody'];
const HEM_SLOTS: Slot[] = ['top', 'midlayer', 'outerwear', 'fullbody'];

export function hasFit(category: Category): boolean {
  return VOLUME_SLOTS.includes(slotOf(category));
}

export function hasLength(category: Category): boolean {
  return HEM_SLOTS.includes(slotOf(category));
}

export function hasRise(category: Category): boolean {
  return slotOf(category) === 'bottom';
}

/**
 * Roughly how much of a dressed person each slot covers.
 *
 * Colour harmony was counted one garment per vote, which makes a scarf argue
 * with a coat on equal terms. 60/30/10 is a rule about AREA, so judging it
 * needs an area, and these are the numbers a flat lay already implies.
 */
export const VISUAL_AREA: Record<Slot, number> = {
  fullbody: 5,
  outerwear: 4,
  top: 3,
  bottom: 3,
  midlayer: 2,
  footwear: 1,
  headwear: 0.5,
  accessory: 0.4,
};

export const METAL_ORDER: Metal[] = ['gold', 'silver', 'rose-gold', 'mixed', 'other'];

export const METAL_LABEL: Record<Metal, string> = {
  gold: 'Gold',
  silver: 'Silver',
  'rose-gold': 'Rose gold',
  mixed: 'Mixed',
  other: 'Other',
};

/**
 * Which pieces are asked what they are made of.
 *
 * The ones where the metal IS the material. A belt buckle is metal too, and
 * asking about it would be the beginning of asking about every stud and zip —
 * which is how a two-field form becomes the fourteen-input one people quit over.
 */
const METAL_CATEGORIES: Category[] = [
  'necklace',
  'earrings',
  'bracelet',
  'ring',
  'brooch',
  'watch',
];

export function hasMetal(category: Category): boolean {
  return METAL_CATEGORIES.includes(category);
}
