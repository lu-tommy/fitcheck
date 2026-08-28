import { analyzeHarmony, isNeutral, suggestPairings } from '@/domain/color';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import { slotOf } from '@/domain/taxonomy';
import { hexForColorName } from '@/domain/color';
import type { OutfitRequest } from '@/types';

import { makeItem } from './factories';

const request: OutfitRequest = {
  prompt: 'Something for today',
  includeItemIds: [],
  excludeItemIds: [],
  cleanOnly: true,
};

/**
 * The bugs these cover were both invisible to the warmth arithmetic and to the
 * harmony score — they only showed up when a real outfit was rendered.
 */
describe('layering coherence', () => {
  const summerCloset = [
    makeItem({ id: 'tee', category: 'tshirt', primaryColor: 'white', seasons: ['summer'] }),
    makeItem({ id: 'shorts', category: 'shorts', primaryColor: 'navy', seasons: ['summer'] }),
    makeItem({ id: 'sneakers', category: 'sneakers', primaryColor: 'white' }),
    makeItem({ id: 'jumper', category: 'sweater', primaryColor: 'beige', seasons: ['fall', 'winter'] }),
    makeItem({ id: 'coat', category: 'coat', primaryColor: 'charcoal', seasons: ['winter'] }),
  ];

  it('does not put a wool jumper over shorts in mild weather', () => {
    const outfit = buildOutfitLocally({
      request,
      closet: summerCloset,
      season: 'summer',
      weather: null,
    });
    expect(outfit.itemIds).toContain('shorts');
    expect(outfit.itemIds).not.toContain('jumper');
    expect(outfit.itemIds).not.toContain('coat');
  });

  it('still layers when it is genuinely cold', () => {
    const outfit = buildOutfitLocally({
      request: { ...request, temperature: 1 },
      closet: [
        ...summerCloset,
        makeItem({ id: 'jeans', category: 'jeans', primaryColor: 'denim' }),
      ],
      season: 'winter',
    });
    const slots = outfit.itemIds
      .map((id) => summerCloset.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => slotOf(item!.category));
    expect(outfit.itemIds).not.toContain('shorts');
    expect(slots.includes('midlayer') || slots.includes('outerwear')).toBe(true);
  });

  it('leaves a mild day unlayered rather than reaching for a jumper', () => {
    const outfit = buildOutfitLocally({
      request: { ...request, temperature: 18 },
      closet: [
        makeItem({ id: 'shirt', category: 'shirt', primaryColor: 'light blue' }),
        makeItem({ id: 'chinos', category: 'chinos', primaryColor: 'tan' }),
        makeItem({ id: 'loafers', category: 'loafers', primaryColor: 'brown' }),
        makeItem({ id: 'jumper', category: 'sweater', primaryColor: 'grey' }),
      ],
      season: 'spring',
    });
    expect(outfit.itemIds).not.toContain('jumper');
  });
});

describe('neutral detection', () => {
  it.each(['cream', 'white', 'beige', 'tan', 'black', 'charcoal', 'grey', 'navy', 'brown'])(
    'treats %s as a neutral',
    (name) => {
      expect(isNeutral(hexForColorName(name))).toBe(true);
    },
  );

  it.each(['red', 'green', 'yellow', 'purple', 'orange', 'light blue', 'burgundy'])(
    'treats %s as an accent',
    (name) => {
      expect(isNeutral(hexForColorName(name))).toBe(false);
    },
  );

  it('describes a cream-and-navy outfit as neutral, not as an orange accent', () => {
    const report = analyzeHarmony(
      ['cream', 'navy', 'white', 'beige'].map((name) => hexForColorName(name)),
    );
    expect(report.kind).toBe('neutral');
    expect(report.summary).not.toMatch(/orange/i);
  });
});

describe('pairing suggestions', () => {
  it('never suggests the piece its own colour back', () => {
    expect(suggestPairings(hexForColorName('navy'), 'navy')).not.toContain('navy');
    expect(suggestPairings(hexForColorName('white'), 'white')).not.toContain('white');
  });

  it('still returns a useful number of options', () => {
    expect(suggestPairings(hexForColorName('navy'), 'navy').length).toBeGreaterThanOrEqual(4);
    expect(suggestPairings(hexForColorName('red'), 'red').length).toBeGreaterThanOrEqual(3);
  });
});
