import { describe, expect, it } from 'vitest';

import { formalityClashPenalty } from '@/domain/outfitEngine';
import type { ClothingItem } from '@/types';

/**
 * Tommy, on a real suggestion: "it recommended me tank top with dress pants?
 * where is the fashion police!"
 */
function piece(partial: Partial<ClothingItem>): ClothingItem {
  return {
    id: partial.id ?? 'x',
    name: partial.name ?? 'piece',
    category: partial.category ?? 'tshirt',
    formality: partial.formality ?? 'casual',
    primaryColor: 'navy',
    primaryColorHex: '#1b2a4a',
    secondaryColors: [],
    seasons: [],
    styles: [],
    wearCount: 0,
    ...partial,
  } as ClothingItem;
}

describe('the fashion police', () => {
  const tank = piece({ id: 'tank', category: 'tank', formality: 'very-casual' });
  const dressPants = piece({ id: 'dp', category: 'dress-pants', formality: 'formal' });
  const jeans = piece({ id: 'j', category: 'jeans', formality: 'casual' });
  const shirt = piece({ id: 's', category: 'shirt', formality: 'business-casual' });

  it('punishes a tank top with dress trousers', () => {
    // four steps apart — the exact pairing that was suggested
    expect(formalityClashPenalty(tank, [dressPants])).toBe(-70);
  });

  it('leaves a shirt with jeans alone — mixed dressing is just dressing', () => {
    // business-casual over casual is two steps and is an ordinary outfit; the
    // rule has to be forgiving here or it would fight how people actually dress
    expect(formalityClashPenalty(shirt, [jeans])).toBe(0);
  });

  it('mildly discourages three steps, without forbidding it', () => {
    const tee = piece({ id: 't', category: 'tshirt', formality: 'casual' });
    expect(formalityClashPenalty(tee, [dressPants])).toBe(-25);
  });

  it('is neutral for the first piece, when nothing is on the body yet', () => {
    expect(formalityClashPenalty(tank, [])).toBe(0);
  });

  it('ignores accessories, which are allowed to be dressier', () => {
    const watch = piece({ id: 'w', category: 'watch', formality: 'smart-casual' });
    expect(formalityClashPenalty(watch, [tank])).toBe(0);
  });

  it('judges against the worst clash, not the average', () => {
    // with a casual pair of jeans AND formal trousers on the list, the tank is
    // still four steps from the trousers and that is what counts
    expect(formalityClashPenalty(tank, [jeans, dressPants])).toBe(-70);
  });

  it('costs more than the colour bonus can win back', () => {
    // harmonyBonus is (score - 60) / 3, so at most about +13
    expect(Math.abs(formalityClashPenalty(tank, [dressPants]))).toBeGreaterThan(13);
  });
});
