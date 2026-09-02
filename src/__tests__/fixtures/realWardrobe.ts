import type { ClothingItem } from '@/types';

/**
 * One real person's wardrobe, for judging what the engine actually puts on her.
 *
 * Every unit test in this repo builds the smallest closet that proves a rule.
 * That is the right way to test a rule and a useless way to answer the only
 * question that matters to somebody standing in front of a mirror: does this
 * app dress me like a person or like a spreadsheet?
 *
 * So this is a whole wardrobe, written the way one actually is. Forty pieces,
 * a real spread of formality, three quarters of it neutral and a handful of
 * colour, a couple of things bought and barely worn, and — deliberately —
 * detail filled in unevenly. The much-worn pieces know how they fit because
 * somebody got round to saying; the guest-room end of the rail does not. An
 * engine that only looks good on a wardrobe where every field is populated is
 * an engine that looks good on nobody's.
 */

let n = 0;
const stamp = '2026-06-01T09:00:00.000Z';

function piece(spec: Partial<ClothingItem> & Pick<ClothingItem, 'name' | 'category'>): ClothingItem {
  n += 1;
  return {
    id: `w${n}`,
    primaryColor: 'black',
    primaryColorHex: '#16161A',
    secondaryColors: [],
    pattern: 'solid',
    formality: 'casual',
    seasons: ['spring', 'summer', 'fall', 'winter'],
    styles: ['casual'],
    favorite: false,
    laundry: 'clean',
    wearCount: 0,
    createdAt: stamp,
    updatedAt: stamp,
    detection: { source: 'manual', editedByUser: true },
    // A photographed wardrobe: everything has a picture, which is the state the
    // app is designed around and the one the suggestion screen has to render.
    photoId: `photo-${n}`,
    cutoutId: `cutout-${n}`,
    ...spec,
  };
}

export const REAL_WARDROBE: ClothingItem[] = [
  /* ------------------------------------------------------------------ tops */
  piece({ lastWornAt: '2026-05-31T18:00:00.000Z', name: 'White cotton tee', category: 'tshirt', primaryColor: 'white', primaryColorHex: '#F7F5F2', material: 'Cotton', wearCount: 42, favorite: true, fit: 'regular', length: 'regular', seasons: ['spring', 'summer', 'fall'] }),
  piece({ lastWornAt: '2026-05-29T18:00:00.000Z', name: 'Black cotton tee', category: 'tshirt', primaryColor: 'black', material: 'Cotton', wearCount: 31, fit: 'relaxed', length: 'regular', seasons: ['spring', 'summer', 'fall'] }),
  piece({ name: 'Striped Breton top', category: 'longsleeve', primaryColor: 'navy', primaryColorHex: '#1F3557', secondaryColors: ['white'], pattern: 'striped', patternScale: 'medium', material: 'Cotton', wearCount: 18, fit: 'regular', length: 'regular' }),
  piece({ name: 'Oxford shirt', category: 'shirt', primaryColor: 'light blue', primaryColorHex: '#9AC1E3', material: 'Cotton', brand: 'Uniqlo', formality: 'business-casual', wearCount: 22, fit: 'regular', length: 'regular', styles: ['business-casual', 'preppy'] }),
  piece({ name: 'Cream silk blouse', category: 'blouse', primaryColor: 'cream', primaryColorHex: '#F0E6D6', material: 'Silk', formality: 'business-casual', wearCount: 9, fit: 'relaxed', length: 'regular', styles: ['minimalist'] }),
  piece({ name: 'Black ribbed tank', category: 'tank', primaryColor: 'black', material: 'Cotton', formality: 'very-casual', wearCount: 14, fit: 'fitted', length: 'cropped', seasons: ['summer'] }),
  piece({ name: 'Rust linen shirt', category: 'shirt', primaryColor: 'orange', primaryColorHex: '#D2762F', material: 'Linen', formality: 'smart-casual', wearCount: 6, fit: 'relaxed', length: 'regular', seasons: ['spring', 'summer'] }),
  piece({ name: 'Grey marl long sleeve', category: 'longsleeve', primaryColor: 'grey', primaryColorHex: '#9A9691', material: 'Cotton', wearCount: 11, seasons: ['fall', 'winter'] }),

  /* -------------------------------------------------------------- midlayers */
  piece({ lastWornAt: '2026-05-26T18:00:00.000Z', name: 'Oatmeal wool jumper', category: 'sweater', primaryColor: 'beige', primaryColorHex: '#D9C7AE', material: 'Wool', formality: 'smart-casual', wearCount: 27, favorite: true, fit: 'relaxed', length: 'regular', seasons: ['fall', 'winter'], styles: ['minimalist', 'casual'] }),
  piece({ name: 'Navy cashmere cardigan', category: 'cardigan', primaryColor: 'navy', primaryColorHex: '#1F3557', material: 'Cashmere', formality: 'smart-casual', wearCount: 13, fit: 'regular', length: 'long', seasons: ['fall', 'winter', 'spring'] }),
  piece({ lastWornAt: '2026-05-28T18:00:00.000Z', name: 'Grey marl hoodie', category: 'hoodie', primaryColor: 'grey', primaryColorHex: '#9A9691', material: 'Fleece', formality: 'very-casual', wearCount: 24, fit: 'oversized', length: 'regular', seasons: ['fall', 'winter'], styles: ['streetwear', 'athletic'] }),
  piece({ name: 'Forest green knit vest', category: 'vest', primaryColor: 'green', primaryColorHex: '#4B7A50', material: 'Wool', formality: 'smart-casual', wearCount: 4, fit: 'regular', length: 'cropped', seasons: ['fall', 'spring'] }),

  /* -------------------------------------------------------------- outerwear */
  piece({ name: 'Olive field jacket', category: 'jacket', primaryColor: 'olive', primaryColorHex: '#6B7048', material: 'Canvas', wearCount: 19, fit: 'regular', length: 'regular', seasons: ['spring', 'fall'], styles: ['outdoor', 'casual'] }),
  piece({ name: 'Navy wool blazer', category: 'blazer', primaryColor: 'navy', primaryColorHex: '#1F3557', material: 'Wool', formality: 'formal', wearCount: 7, fit: 'fitted', length: 'regular', seasons: ['fall', 'winter', 'spring'], styles: ['formal', 'business-casual'] }),
  piece({ name: 'Charcoal wool coat', category: 'coat', primaryColor: 'charcoal', primaryColorHex: '#3A3A3F', material: 'Wool', formality: 'business-casual', wearCount: 15, fit: 'regular', length: 'long', seasons: ['winter'], styles: ['minimalist', 'formal'] }),
  piece({ name: 'Black leather jacket', category: 'jacket', primaryColor: 'black', material: 'Leather', formality: 'casual', wearCount: 8, fit: 'fitted', length: 'cropped', seasons: ['spring', 'fall'], styles: ['streetwear'] }),

  /* ---------------------------------------------------------------- bottoms */
  piece({ lastWornAt: '2026-05-31T18:00:00.000Z', name: 'Indigo straight jeans', category: 'jeans', primaryColor: 'denim', primaryColorHex: '#4A6E96', material: 'Denim', brand: "Levi's", wearCount: 55, favorite: true, fit: 'regular', rise: 'high', seasons: ['spring', 'fall', 'winter'] }),
  piece({ lastWornAt: '2026-05-27T18:00:00.000Z', name: 'Black slim jeans', category: 'jeans', primaryColor: 'black', material: 'Denim', wearCount: 29, fit: 'fitted', rise: 'mid', seasons: ['fall', 'winter', 'spring'], styles: ['streetwear', 'minimalist'] }),
  piece({ name: 'Wide-leg cream trousers', category: 'chinos', primaryColor: 'cream', primaryColorHex: '#F0E6D6', material: 'Cotton', formality: 'smart-casual', wearCount: 12, fit: 'oversized', rise: 'high', seasons: ['spring', 'summer'], styles: ['minimalist'] }),
  piece({ name: 'Charcoal dress trousers', category: 'dress-pants', primaryColor: 'charcoal', primaryColorHex: '#3A3A3F', material: 'Wool', formality: 'formal', wearCount: 5, fit: 'regular', rise: 'mid', seasons: ['fall', 'winter', 'spring'], styles: ['formal'] }),
  piece({ name: 'Stone chinos', category: 'chinos', primaryColor: 'tan', primaryColorHex: '#C2A178', material: 'Cotton', formality: 'smart-casual', wearCount: 16, fit: 'regular', rise: 'mid', seasons: ['spring', 'summer', 'fall'] }),
  piece({ name: 'Black midi skirt', category: 'skirt', primaryColor: 'black', material: 'Wool', formality: 'smart-casual', wearCount: 6, fit: 'regular', rise: 'high', seasons: ['fall', 'winter'] }),
  piece({ name: 'Navy shorts', category: 'shorts', primaryColor: 'navy', primaryColorHex: '#1F3557', material: 'Cotton', formality: 'very-casual', wearCount: 9, fit: 'regular', rise: 'mid', seasons: ['summer'] }),
  piece({ name: 'Grey joggers', category: 'joggers', primaryColor: 'grey', primaryColorHex: '#9A9691', material: 'Fleece', formality: 'very-casual', wearCount: 21, fit: 'relaxed', rise: 'mid', seasons: ['fall', 'winter'], styles: ['athletic'] }),

  /* ------------------------------------------------------------- full body */
  piece({ name: 'Black wrap dress', category: 'dress', primaryColor: 'black', material: 'Silk', formality: 'formal', wearCount: 4, fit: 'fitted', length: 'long', seasons: ['spring', 'summer', 'fall'], styles: ['formal', 'minimalist'] }),
  piece({ name: 'Green floral sundress', category: 'dress', primaryColor: 'green', primaryColorHex: '#4B7A50', pattern: 'floral', patternScale: 'bold', material: 'Cotton', formality: 'smart-casual', wearCount: 7, fit: 'relaxed', length: 'long', seasons: ['summer'], styles: ['casual', 'vintage'] }),

  /* -------------------------------------------------------------- footwear */
  piece({ lastWornAt: '2026-05-30T18:00:00.000Z', name: 'White leather trainers', category: 'sneakers', primaryColor: 'white', primaryColorHex: '#F7F5F2', material: 'Leather', wearCount: 61, favorite: true, seasons: ['spring', 'summer', 'fall'], styles: ['minimalist', 'casual'] }),
  piece({ name: 'Brown suede boots', category: 'boots', primaryColor: 'brown', primaryColorHex: '#6E4C34', material: 'Suede', formality: 'smart-casual', wearCount: 23, seasons: ['fall', 'winter'], styles: ['casual', 'outdoor'] }),
  piece({ name: 'Black leather loafers', category: 'loafers', primaryColor: 'black', material: 'Leather', formality: 'business-casual', wearCount: 14, seasons: ['spring', 'fall', 'winter'] }),
  piece({ name: 'Black heeled pumps', category: 'dress-shoes', primaryColor: 'black', material: 'Leather', formality: 'formal', wearCount: 5, seasons: ['spring', 'fall', 'winter'], styles: ['formal'] }),
  piece({ name: 'Tan leather sandals', category: 'sandals', primaryColor: 'tan', primaryColorHex: '#C2A178', material: 'Leather', formality: 'very-casual', wearCount: 12, seasons: ['summer'] }),

  /* ------------------------------------------------------------ accessories */
  piece({ lastWornAt: '2026-05-31T18:00:00.000Z', name: 'Gold hoop earrings', category: 'earrings', primaryColor: 'yellow', primaryColorHex: '#DDB63F', formality: 'smart-casual', metal: 'gold', wearCount: 34, favorite: true }),
  piece({ name: 'Fine gold chain', category: 'necklace', primaryColor: 'yellow', primaryColorHex: '#DDB63F', formality: 'smart-casual', metal: 'gold', wearCount: 28 }),
  piece({ name: 'Gold signet ring', category: 'ring', primaryColor: 'yellow', primaryColorHex: '#DDB63F', metal: 'gold', wearCount: 30 }),
  piece({ name: 'Steel watch', category: 'watch', primaryColor: 'grey', primaryColorHex: '#9A9691', formality: 'smart-casual', metal: 'silver', wearCount: 26 }),
  piece({ name: 'Tan leather belt', category: 'belt', primaryColor: 'tan', primaryColorHex: '#C2A178', material: 'Leather', formality: 'smart-casual', wearCount: 17 }),
  piece({ name: 'Black leather tote', category: 'bag', primaryColor: 'black', material: 'Leather', formality: 'business-casual', wearCount: 33 }),
  piece({ name: 'Burgundy wool scarf', category: 'scarf', primaryColor: 'burgundy', primaryColorHex: '#6E2B33', material: 'Wool', wearCount: 10, seasons: ['fall', 'winter'] }),
  piece({ name: 'Tortoiseshell sunglasses', category: 'sunglasses', primaryColor: 'brown', primaryColorHex: '#6E4C34', wearCount: 15, seasons: ['spring', 'summer'] }),
  piece({ name: 'Charcoal beanie', category: 'beanie', primaryColor: 'charcoal', primaryColorHex: '#3A3A3F', material: 'Wool', wearCount: 8, seasons: ['winter'] }),

  /* ------- the guest-room end of the rail: bought, barely worn, unfilled --- */
  piece({ name: 'Purple satin shirt', category: 'shirt', primaryColor: 'purple', primaryColorHex: '#6E5495', material: 'Polyester', formality: 'smart-casual', wearCount: 1 }),
  piece({ name: 'Red plaid overshirt', category: 'shirt', primaryColor: 'red', primaryColorHex: '#B23A31', pattern: 'plaid', material: 'Cotton', formality: 'casual', wearCount: 2, seasons: ['fall', 'winter'] }),
];
