import { hexForColorName } from '@/domain/color';
import type { NewClothingItem } from '@/store/closet';
import type { Category, Formality, Pattern, Season, Style } from '@/types';

/**
 * A demo capsule wardrobe.
 *
 * Loaded on request (never automatically) so the generator, stats and packing
 * features can be explored before the user has photographed anything. Pieces
 * carry no photo — the UI renders them as colour blocks, which keeps it obvious
 * that these are placeholders.
 */

interface SeedSpec {
  name: string;
  category: Category;
  color: string;
  pattern?: Pattern;
  material?: string;
  brand?: string;
  formality: Formality;
  seasons: Season[];
  styles: Style[];
  favorite?: boolean;
  wearCount?: number;
  price?: number;
}

const SPECS: SeedSpec[] = [
  { name: 'White cotton tee', category: 'tshirt', color: 'white', material: 'Cotton', formality: 'casual', seasons: ['spring', 'summer', 'fall'], styles: ['casual', 'minimalist'], favorite: true, wearCount: 14, price: 25 },
  { name: 'Black cotton tee', category: 'tshirt', color: 'black', material: 'Cotton', formality: 'casual', seasons: ['spring', 'summer', 'fall'], styles: ['casual', 'streetwear'], wearCount: 9, price: 25 },
  { name: 'Oxford shirt', category: 'shirt', color: 'light blue', material: 'Cotton', brand: 'Uniqlo', formality: 'business-casual', seasons: ['spring', 'fall', 'winter'], styles: ['business-casual', 'preppy'], wearCount: 6, price: 45 },
  { name: 'Cream linen shirt', category: 'shirt', color: 'cream', material: 'Linen', formality: 'smart-casual', seasons: ['spring', 'summer'], styles: ['minimalist', 'casual'], favorite: true, wearCount: 4, price: 60 },
  { name: 'Navy polo', category: 'polo', color: 'navy', material: 'Cotton', formality: 'smart-casual', seasons: ['spring', 'summer'], styles: ['preppy', 'casual'], wearCount: 3, price: 40 },
  { name: 'Grey marl hoodie', category: 'hoodie', color: 'grey', material: 'Fleece', formality: 'very-casual', seasons: ['fall', 'winter'], styles: ['streetwear', 'athletic'], wearCount: 11, price: 55 },
  { name: 'Oatmeal knit jumper', category: 'sweater', color: 'beige', material: 'Wool', formality: 'smart-casual', seasons: ['fall', 'winter'], styles: ['minimalist', 'casual'], favorite: true, wearCount: 7, price: 90 },
  { name: 'Navy blazer', category: 'blazer', color: 'navy', material: 'Wool', formality: 'formal', seasons: ['fall', 'winter', 'spring'], styles: ['formal', 'business-casual'], wearCount: 2, price: 180 },
  { name: 'Olive field jacket', category: 'jacket', color: 'olive', material: 'Canvas', formality: 'casual', seasons: ['spring', 'fall'], styles: ['outdoor', 'casual'], wearCount: 5, price: 130 },
  { name: 'Charcoal wool coat', category: 'coat', color: 'charcoal', material: 'Wool', formality: 'business-casual', seasons: ['winter'], styles: ['minimalist', 'formal'], wearCount: 3, price: 260 },
  { name: 'Indigo straight jeans', category: 'jeans', color: 'denim', material: 'Denim', brand: "Levi's", formality: 'casual', seasons: ['spring', 'fall', 'winter'], styles: ['casual', 'streetwear'], favorite: true, wearCount: 18, price: 95 },
  { name: 'Black slim jeans', category: 'jeans', color: 'black', material: 'Denim', formality: 'casual', seasons: ['fall', 'winter', 'spring'], styles: ['streetwear', 'minimalist'], wearCount: 8, price: 85 },
  { name: 'Stone chinos', category: 'chinos', color: 'tan', material: 'Cotton', formality: 'smart-casual', seasons: ['spring', 'summer', 'fall'], styles: ['preppy', 'business-casual'], wearCount: 6, price: 70 },
  { name: 'Charcoal dress trousers', category: 'dress-pants', color: 'charcoal', material: 'Wool', formality: 'formal', seasons: ['fall', 'winter', 'spring'], styles: ['formal'], wearCount: 2, price: 110 },
  { name: 'Navy shorts', category: 'shorts', color: 'navy', material: 'Cotton', formality: 'very-casual', seasons: ['summer'], styles: ['casual'], wearCount: 4, price: 40 },
  { name: 'White leather sneakers', category: 'sneakers', color: 'white', material: 'Leather', formality: 'casual', seasons: ['spring', 'summer', 'fall'], styles: ['minimalist', 'casual'], favorite: true, wearCount: 21, price: 120 },
  { name: 'Brown suede boots', category: 'boots', color: 'brown', material: 'Suede', formality: 'smart-casual', seasons: ['fall', 'winter'], styles: ['casual', 'outdoor'], wearCount: 9, price: 160 },
  { name: 'Black derby shoes', category: 'dress-shoes', color: 'black', material: 'Leather', formality: 'formal', seasons: ['fall', 'winter', 'spring'], styles: ['formal'], wearCount: 2, price: 190 },
  { name: 'Tan leather belt', category: 'belt', color: 'tan', material: 'Leather', formality: 'smart-casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['casual', 'preppy'], wearCount: 12, price: 45 },
  { name: 'Steel watch', category: 'watch', color: 'grey', material: 'Leather', formality: 'smart-casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['minimalist'], favorite: true, wearCount: 25, price: 220 },
  { name: 'Charcoal beanie', category: 'beanie', color: 'charcoal', material: 'Wool', formality: 'casual', seasons: ['winter'], styles: ['streetwear', 'casual'], wearCount: 5, price: 30 },
  { name: 'Burgundy scarf', category: 'scarf', color: 'burgundy', material: 'Wool', formality: 'casual', seasons: ['fall', 'winter'], styles: ['casual', 'minimalist'], wearCount: 3, price: 50 },
  // Three positions the wardrobe had no way to hold until now. They are in the
  // demo so the accessory shelves arrive with something on them.
  { name: 'Gold hoop earrings', category: 'earrings', color: 'yellow', formality: 'smart-casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['minimalist', 'casual'], favorite: true, wearCount: 16, price: 65 },
  { name: 'Cream ribbed socks', category: 'socks', color: 'cream', material: 'Cotton', formality: 'casual', seasons: ['fall', 'winter', 'spring'], styles: ['casual', 'preppy'], wearCount: 11, price: 12 },
  { name: 'Enamel lapel pin', category: 'brooch', color: 'green', formality: 'business-casual', seasons: ['fall', 'winter', 'spring'], styles: ['vintage', 'preppy'], wearCount: 2, price: 30 },

  /*
   * One of everything.
   *
   * The demo is the only place all fifty-odd silhouettes are ever drawn, so a
   * category missing from it is a drawing nobody has looked at — and it had
   * drifted to covering fewer than half of them. It is also the wardrobe a new
   * person judges the app on, and a capsule with no dress, no coat and no shoes
   * but trainers is not one anybody recognises.
   */
  { name: 'Straw sun hat', category: 'hat', color: 'beige', material: 'Canvas', formality: 'casual', seasons: ['summer'], styles: ['casual'], wearCount: 3, price: 35 },
  { name: 'Navy baseball cap', category: 'cap', color: 'navy', material: 'Cotton', formality: 'very-casual', seasons: ['spring', 'summer', 'fall'], styles: ['streetwear', 'athletic'], wearCount: 14, price: 20 },
  { name: 'Ivory silk blouse', category: 'blouse', color: 'cream', material: 'Silk', formality: 'business-casual', seasons: ['spring', 'summer', 'fall'], styles: ['minimalist', 'business-casual'], wearCount: 6, price: 85 },
  { name: 'Black ribbed tank', category: 'tank', color: 'black', material: 'Cotton', formality: 'very-casual', seasons: ['summer'], styles: ['casual', 'minimalist'], wearCount: 13, price: 18 },
  { name: 'Striped long sleeve', category: 'longsleeve', color: 'navy', pattern: 'striped', material: 'Cotton', formality: 'casual', seasons: ['spring', 'fall'], styles: ['casual', 'preppy'], wearCount: 17, price: 38 },
  { name: 'Charcoal turtleneck', category: 'turtleneck', color: 'charcoal', material: 'Wool', formality: 'smart-casual', seasons: ['fall', 'winter'], styles: ['minimalist'], wearCount: 8, price: 70 },
  { name: 'Camel cardigan', category: 'cardigan', color: 'tan', material: 'Wool', formality: 'smart-casual', seasons: ['fall', 'winter', 'spring'], styles: ['minimalist', 'casual'], wearCount: 9, price: 95 },
  { name: 'Quilted gilet', category: 'vest', color: 'olive', material: 'Nylon', formality: 'casual', seasons: ['fall', 'spring'], styles: ['outdoor'], wearCount: 5, price: 80 },
  { name: 'Check overshirt', category: 'overshirt', color: 'red', pattern: 'plaid', material: 'Cotton', formality: 'casual', seasons: ['fall', 'winter'], styles: ['casual', 'streetwear'], wearCount: 7, price: 60 },
  { name: 'Khaki parka', category: 'parka', color: 'olive', material: 'Nylon', formality: 'casual', seasons: ['winter'], styles: ['outdoor', 'casual'], wearCount: 6, price: 190 },
  { name: 'Yellow raincoat', category: 'raincoat', color: 'yellow', material: 'Nylon', formality: 'casual', seasons: ['spring', 'fall', 'winter'], styles: ['outdoor'], wearCount: 8, price: 110 },
  { name: 'Black wrap dress', category: 'dress', color: 'black', material: 'Silk', formality: 'formal', seasons: ['spring', 'summer', 'fall'], styles: ['formal', 'minimalist'], wearCount: 4, price: 150 },
  { name: 'Denim jumpsuit', category: 'jumpsuit', color: 'denim', material: 'Denim', formality: 'smart-casual', seasons: ['spring', 'summer'], styles: ['casual', 'vintage'], wearCount: 3, price: 120 },
  { name: 'Charcoal suit', category: 'suit', color: 'charcoal', material: 'Wool', formality: 'formal', seasons: ['fall', 'winter', 'spring'], styles: ['formal'], wearCount: 2, price: 420 },
  { name: 'Navy swimsuit', category: 'swimwear', color: 'navy', material: 'Nylon', formality: 'very-casual', seasons: ['summer'], styles: ['casual'], wearCount: 5, price: 55 },
  { name: 'Grey joggers', category: 'joggers', color: 'grey', material: 'Fleece', formality: 'very-casual', seasons: ['fall', 'winter'], styles: ['athletic', 'streetwear'], wearCount: 20, price: 45 },
  { name: 'Black leggings', category: 'leggings', color: 'black', material: 'Nylon', formality: 'very-casual', seasons: ['spring', 'fall', 'winter'], styles: ['athletic'], wearCount: 26, price: 40 },
  { name: 'Black midi skirt', category: 'skirt', color: 'black', material: 'Wool', formality: 'smart-casual', seasons: ['fall', 'winter'], styles: ['minimalist'], wearCount: 6, price: 75 },
  { name: 'Brown penny loafers', category: 'loafers', color: 'brown', material: 'Leather', formality: 'business-casual', seasons: ['spring', 'fall'], styles: ['preppy', 'business-casual'], wearCount: 11, price: 140 },
  { name: 'Leather sandals', category: 'sandals', color: 'tan', material: 'Leather', formality: 'very-casual', seasons: ['summer'], styles: ['casual'], wearCount: 12, price: 65 },
  { name: 'Black ballet flats', category: 'flats', color: 'black', material: 'Leather', formality: 'business-casual', seasons: ['spring', 'summer', 'fall'], styles: ['minimalist'], wearCount: 10, price: 90 },
  { name: 'Green rain boots', category: 'rain-boots', color: 'green', material: 'Nylon', formality: 'very-casual', seasons: ['fall', 'winter', 'spring'], styles: ['outdoor'], wearCount: 4, price: 60 },
  { name: 'Fine gold chain', category: 'necklace', color: 'yellow', formality: 'smart-casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['minimalist'], wearCount: 22, price: 90 },
  { name: 'Beaded bracelet', category: 'bracelet', color: 'brown', formality: 'casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['casual'], wearCount: 9, price: 25 },
  { name: 'Gold signet ring', category: 'ring', color: 'yellow', formality: 'casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['minimalist'], wearCount: 27, price: 110 },
  { name: 'Tortoiseshell sunglasses', category: 'sunglasses', color: 'brown', formality: 'casual', seasons: ['spring', 'summer'], styles: ['casual'], wearCount: 15, price: 70 },
  { name: 'Navy silk tie', category: 'tie', color: 'navy', material: 'Silk', formality: 'formal', seasons: ['fall', 'winter', 'spring'], styles: ['formal'], wearCount: 3, price: 55 },
  { name: 'Black bow tie', category: 'bow-tie', color: 'black', material: 'Silk', formality: 'formal', seasons: ['fall', 'winter', 'spring'], styles: ['formal'], wearCount: 1, price: 40 },
  { name: 'White pocket square', category: 'pocket-square', color: 'white', material: 'Linen', formality: 'formal', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['formal'], wearCount: 2, price: 20 },
  { name: 'Black velvet headband', category: 'headband', color: 'black', formality: 'casual', seasons: ['fall', 'winter'], styles: ['preppy'], wearCount: 6, price: 22 },
  { name: 'Tortoiseshell claw clip', category: 'hair-clip', color: 'brown', formality: 'casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['casual'], wearCount: 18, price: 14 },
  { name: 'Black opaque tights', category: 'tights', color: 'black', material: 'Nylon', formality: 'smart-casual', seasons: ['fall', 'winter'], styles: ['minimalist'], wearCount: 11, price: 15 },
  { name: 'Canvas tote', category: 'bag', color: 'beige', material: 'Canvas', formality: 'casual', seasons: ['spring', 'summer', 'fall', 'winter'], styles: ['casual', 'minimalist'], wearCount: 24, price: 35 },
  { name: 'Leather gloves', category: 'gloves', color: 'brown', material: 'Leather', formality: 'smart-casual', seasons: ['winter'], styles: ['casual'], wearCount: 7, price: 75 },
  { name: 'Black umbrella', category: 'umbrella', color: 'black', material: 'Nylon', formality: 'casual', seasons: ['spring', 'fall', 'winter'], styles: ['casual'], wearCount: 13, price: 30 },
];

export function demoWardrobe(): NewClothingItem[] {
  return SPECS.map((spec) => ({
    name: spec.name,
    category: spec.category,
    primaryColor: spec.color,
    primaryColorHex: hexForColorName(spec.color),
    secondaryColors: [],
    pattern: spec.pattern ?? 'solid',
    material: spec.material,
    brand: spec.brand,
    formality: spec.formality,
    seasons: spec.seasons,
    styles: spec.styles,
    favorite: spec.favorite ?? false,
    wearCount: spec.wearCount ?? 0,
    purchasePrice: spec.price,
    detection: { source: 'seed', editedByUser: false },
  }));
}
