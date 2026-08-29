import { buildOutfitLocally, cycleSlot, slotAlternatives } from '@/domain/outfitEngine';
import { MAX_ACCESSORIES, accessoryPosition, slotOf } from '@/domain/taxonomy';
import type { ClothingItem, OutfitRequest } from '@/types';

import { makeItem } from './factories';

/**
 * Accessories are not one slot.
 *
 * Somebody who owns glasses, a chain, a watch, three rings, two belts and a bag
 * is normal. Treating all of that as a single bucket meant the app offered a
 * belt as an alternative to a watch, and capped the whole category at two.
 */

const request: OutfitRequest = {
  prompt: 'Something for today',
  includeItemIds: [],
  excludeItemIds: [],
  cleanOnly: true,
};

function closetWithAccessories(): ClothingItem[] {
  return [
    makeItem({ id: 'tee', category: 'tshirt', primaryColor: 'white' }),
    makeItem({ id: 'jeans', category: 'jeans', primaryColor: 'denim' }),
    makeItem({ id: 'shoes', category: 'sneakers', primaryColor: 'white' }),

    makeItem({ id: 'sunnies-1', category: 'sunglasses', name: 'Black sunglasses', primaryColor: 'black' }),
    makeItem({ id: 'sunnies-2', category: 'sunglasses', name: 'Tortoise sunglasses', primaryColor: 'brown' }),
    makeItem({ id: 'chain', category: 'necklace', name: 'Gold chain', primaryColor: 'yellow' }),
    makeItem({ id: 'scarf', category: 'scarf', name: 'Burgundy scarf', primaryColor: 'burgundy' }),
    makeItem({ id: 'watch-1', category: 'watch', name: 'Steel watch', primaryColor: 'grey' }),
    makeItem({ id: 'watch-2', category: 'watch', name: 'Black watch', primaryColor: 'black' }),
    makeItem({ id: 'bracelet', category: 'bracelet', name: 'Beaded bracelet', primaryColor: 'brown' }),
    makeItem({ id: 'ring-1', category: 'ring', name: 'Signet ring', primaryColor: 'yellow' }),
    makeItem({ id: 'ring-2', category: 'ring', name: 'Silver band', primaryColor: 'grey' }),
    makeItem({ id: 'belt', category: 'belt', name: 'Tan belt', primaryColor: 'tan' }),
    makeItem({ id: 'bag', category: 'bag', name: 'Canvas tote', primaryColor: 'beige' }),
  ];
}

const build = (closet = closetWithAccessories()) =>
  buildOutfitLocally({ request, closet }).itemIds
    .map((id) => closet.find((item) => item.id === id)!)
    .filter(Boolean);

describe('accessory positions', () => {
  it('knows where each one is worn', () => {
    expect(accessoryPosition('watch')).toBe('wrist');
    expect(accessoryPosition('bracelet')).toBe('wrist');
    expect(accessoryPosition('ring')).toBe('finger');
    expect(accessoryPosition('necklace')).toBe('neck');
    expect(accessoryPosition('scarf')).toBe('neck');
    expect(accessoryPosition('belt')).toBe('waist');
    expect(accessoryPosition('sunglasses')).toBe('eyes');
    expect(accessoryPosition('bag')).toBe('carried');
  });
});

describe('choosing accessories', () => {
  it('never puts two things in the same place', () => {
    const worn = build().filter((item) => slotOf(item.category) === 'accessory');
    const positions = worn.map((item) => accessoryPosition(item.category));
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('stops at three, the way a stylist would', () => {
    const worn = build().filter((item) => slotOf(item.category) === 'accessory');
    expect(worn.length).toBeLessThanOrEqual(MAX_ACCESSORIES);
  });

  it('wears more than one accessory when there are several to wear', () => {
    const worn = build().filter((item) => slotOf(item.category) === 'accessory');
    expect(worn.length).toBeGreaterThan(1);
  });

  it('does not put a watch and a bracelet on the same wrist', () => {
    const worn = build().filter((item) => accessoryPosition(item.category) === 'wrist');
    expect(worn.length).toBeLessThanOrEqual(1);
  });

  it('copes with a wardrobe of nothing but accessories', () => {
    const only = closetWithAccessories().filter((item) => slotOf(item.category) === 'accessory');
    expect(() => buildOutfitLocally({ request, closet: only })).not.toThrow();
  });
});

describe('changing one accessory', () => {
  const context = (closet: ClothingItem[]) => ({ request, closet });

  it('offers watches as alternatives to a watch, not belts', () => {
    const closet = closetWithAccessories();
    const ids = ['tee', 'jeans', 'shoes', 'watch-1', 'belt', 'chain'];
    const options = slotAlternatives(context(closet), ids, 'watch-1').map((item) => item.id);

    expect(options).toContain('watch-2');
    expect(options).toContain('bracelet');
    expect(options).not.toContain('belt');
    expect(options).not.toContain('chain');
    expect(options).not.toContain('bag');
  });

  it('offers the other things worn round a neck', () => {
    const closet = closetWithAccessories();
    const ids = ['tee', 'jeans', 'shoes', 'chain'];
    const options = slotAlternatives(context(closet), ids, 'chain').map((item) => item.id);
    expect(options).toContain('scarf');
    expect(options).not.toContain('watch-1');
  });

  it('steps between rings without touching anything else', () => {
    const closet = closetWithAccessories();
    const ids = ['tee', 'jeans', 'shoes', 'ring-1', 'watch-1'];
    const next = cycleSlot(context(closet), ids, 'ring-1', 1);
    expect(next).toContain('ring-2');
    expect(next).not.toContain('ring-1');
    expect(next).toContain('watch-1');
    expect(next).toContain('tee');
  });

  it('leaves a lone accessory alone', () => {
    const closet = closetWithAccessories();
    const ids = ['tee', 'jeans', 'shoes', 'bag'];
    expect(cycleSlot(context(closet), ids, 'bag', 1)).toEqual(ids);
  });
});
