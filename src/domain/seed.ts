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
