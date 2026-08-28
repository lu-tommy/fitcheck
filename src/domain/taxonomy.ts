import type {
  Category,
  Formality,
  Pattern,
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
  { category: 'bracelet', label: 'Bracelet', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'ring', label: 'Ring', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'sunglasses', label: 'Sunglasses', slot: 'accessory', warmth: 0, formality: 'casual' },
  { category: 'scarf', label: 'Scarf', slot: 'accessory', warmth: 2, formality: 'casual' },
  { category: 'tie', label: 'Tie', slot: 'accessory', warmth: 0, formality: 'formal' },
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
