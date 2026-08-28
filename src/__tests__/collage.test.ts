import { autoLayout, resolveLayout } from '@/domain/collage';
import { slotOf } from '@/domain/taxonomy';
import type { CollagePlacement } from '@/types';

import { makeItem } from './factories';

const outfit = () => [
  makeItem({ id: 'tee', category: 'tshirt' }),
  makeItem({ id: 'jeans', category: 'jeans' }),
  makeItem({ id: 'sneakers', category: 'sneakers' }),
  makeItem({ id: 'jacket', category: 'jacket' }),
  makeItem({ id: 'watch', category: 'watch' }),
  makeItem({ id: 'belt', category: 'belt' }),
];

describe('autoLayout', () => {
  it('places every piece exactly once', () => {
    const items = outfit();
    const layout = autoLayout(items);
    expect(layout).toHaveLength(items.length);
    expect(new Set(layout.map((entry) => entry.itemId)).size).toBe(items.length);
  });

  it('keeps everything inside the canvas', () => {
    autoLayout(outfit()).forEach((entry) => {
      expect(entry.x).toBeGreaterThan(0);
      expect(entry.x).toBeLessThan(1);
      expect(entry.y).toBeGreaterThan(0);
      expect(entry.y).toBeLessThan(1);
      expect(entry.size).toBeGreaterThan(0);
      expect(entry.size).toBeLessThanOrEqual(0.6);
    });
  });

  it('never stacks two pieces on the same spot', () => {
    const spots = autoLayout(outfit()).map((entry) => `${entry.x.toFixed(3)},${entry.y.toFixed(3)}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it('gives the big garments more room than the accessories', () => {
    const layout = autoLayout(outfit());
    const size = (id: string) => layout.find((entry) => entry.itemId === id)!.size;
    expect(size('tee')).toBeGreaterThan(size('watch'));
    expect(size('jeans')).toBeGreaterThan(size('belt'));
  });

  it('builds a different composition around a dress', () => {
    const layout = autoLayout([
      makeItem({ id: 'dress', category: 'dress' }),
      makeItem({ id: 'heels', category: 'loafers' }),
    ]);
    const dress = layout.find((entry) => entry.itemId === 'dress')!;
    expect(slotOf('dress')).toBe('fullbody');
    // The dress carries the middle rather than sitting where a top would.
    expect(dress.x).toBeGreaterThan(0.4);
    expect(dress.size).toBeGreaterThan(0.5);
  });

  it('centres a top-and-bottom outfit when there is no layer beside it', () => {
    const withJacket = autoLayout(outfit());
    const without = autoLayout(outfit().filter((item) => item.id !== 'jacket'));
    const x = (layout: CollagePlacement[]) => layout.find((e) => e.itemId === 'tee')!.x;
    expect(x(without)).toBeGreaterThan(x(withJacket));
  });

  it('is deterministic', () => {
    expect(autoLayout(outfit())).toEqual(autoLayout(outfit()));
  });

  it('spreads several accessories to different spots', () => {
    const layout = autoLayout([
      ...outfit(),
      makeItem({ id: 'sunglasses', category: 'sunglasses' }),
      makeItem({ id: 'bag', category: 'bag' }),
    ]);
    const accessories = ['watch', 'belt', 'sunglasses', 'bag'].map(
      (id) => layout.find((entry) => entry.itemId === id)!,
    );
    const spots = accessories.map((entry) => `${entry.x},${entry.y}`);
    expect(new Set(spots).size).toBe(4);
  });
});

describe('resolveLayout', () => {
  it('falls back to the automatic composition when nothing is saved', () => {
    const items = outfit();
    expect(resolveLayout(items, undefined)).toEqual(autoLayout(items));
  });

  it('keeps hand-positioned pieces where they were put', () => {
    const items = outfit();
    const saved = [{ itemId: 'tee', x: 0.8, y: 0.2, size: 0.3, z: 9, rotation: 0 }];
    const resolved = resolveLayout(items, saved);
    expect(resolved.find((entry) => entry.itemId === 'tee')).toEqual(saved[0]);
    expect(resolved).toHaveLength(items.length);
  });

  it('repairs a layout that has fallen out of sync with the outfit', () => {
    const items = outfit();
    const stale = [
      { itemId: 'tee', x: 0.8, y: 0.2, size: 0.3, z: 9, rotation: 0 },
      { itemId: 'deleted-piece', x: 0.1, y: 0.1, size: 0.3, z: 1, rotation: 0 },
    ];
    const resolved = resolveLayout(items, stale);
    expect(resolved.map((entry) => entry.itemId).sort()).toEqual(
      items.map((item) => item.id).sort(),
    );
    // The piece that is still there keeps its hand-set position.
    expect(resolved.find((entry) => entry.itemId === 'tee')!.x).toBe(0.8);
  });
});
