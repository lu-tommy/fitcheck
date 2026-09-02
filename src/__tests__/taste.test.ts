import { describe, expect, it } from 'vitest';

import { AFFINITY_WEIGHT, readTaste } from '@/domain/taste';
import { buildOutfitLocally } from '@/domain/outfitEngine';
import type { ClothingItem, OutfitRequest, SignalKind, StyleSignal, WearLog } from '@/types';

import { makeItem } from './factories';

/**
 * What the app is allowed to conclude about somebody.
 *
 * This is the one part of the product that forms an opinion nobody asked it to
 * form, so the tests are as much about restraint as about behaviour: it must
 * not state a pattern it cannot evidence, it must not let an inference outvote
 * a fact, and everything it holds must be forgettable.
 */

const TODAY = '2026-09-02';

let seq = 0;
function sig(itemId: string, kind: SignalKind, date = TODAY, against?: string): StyleSignal {
  seq += 1;
  return {
    id: `sig-${seq}`,
    itemId,
    kind,
    againstItemId: against,
    date,
    createdAt: `${date}T09:00:00.000Z`,
    updatedAt: `${date}T09:00:00.000Z`,
  };
}

const many = (itemId: string, kind: SignalKind, count: number, date = TODAY) =>
  Array.from({ length: count }, () => sig(itemId, kind, date));

const closet = (): ClothingItem[] => [
  makeItem({ id: 'olive', category: 'jacket', name: 'Olive field jacket', primaryColor: 'olive' }),
  makeItem({ id: 'linen', category: 'shirt', name: 'Cream linen shirt', primaryColor: 'cream' }),
  makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans', primaryColor: 'denim' }),
];

const read = (signals: StyleSignal[], items = closet(), logs: WearLog[] = [], dismissed?: string[]) =>
  readTaste(signals, items, logs, TODAY, dismissed);

describe('affinity', () => {
  it('is empty when nobody has done anything', () => {
    const taste = read([]);
    expect(taste.affinity.size).toBe(0);
    expect(taste.observations).toEqual([]);
    expect(taste.evidence).toBe(0);
  });

  it('rises for a piece that is chosen and falls for one that is put back', () => {
    const taste = read([...many('linen', 'chosen', 3), ...many('olive', 'passed', 3)]);
    expect(taste.affinity.get('linen')!).toBeGreaterThan(0.5);
    expect(taste.affinity.get('olive')!).toBeLessThan(-0.4);
  });

  /*
   * tanh, not a running total. Ten passes in a bad fortnight must not be ten
   * times an opinion, or one week of laundry buries a jacket permanently.
   */
  it('saturates, so a bad fortnight cannot bury a garment for good', () => {
    const some = read(many('olive', 'passed', 4)).affinity.get('olive')!;
    const lots = read(many('olive', 'passed', 40)).affinity.get('olive')!;
    expect(lots).toBeLessThan(some);
    expect(lots).toBeGreaterThan(-1.01);
    expect(Math.abs(lots - some)).toBeLessThan(0.35);
  });

  it('lets old evidence fade, so somebody can change their mind', () => {
    const recent = read(many('olive', 'passed', 4, TODAY)).affinity.get('olive')!;
    const lastYear = read(many('olive', 'passed', 4, '2025-09-02')).affinity.get('olive')!;
    expect(lastYear).toBeGreaterThan(recent);
  });

  it('ignores signals about clothes that are no longer in the wardrobe', () => {
    const taste = read([...many('ghost', 'passed', 5), sig('linen', 'chosen')]);
    expect(taste.affinity.has('ghost')).toBe(false);
    expect(taste.evidence).toBe(1);
  });
});

describe('what it will and will not say', () => {
  it('says nothing from a single swap', () => {
    const taste = read([sig('olive', 'passed')]);
    expect(taste.observations).toEqual([]);
  });

  it('names the piece that keeps going back, and cites the count', () => {
    const taste = read([...many('olive', 'passed', 4), sig('olive', 'worn')]);
    const avoided = taste.observations.find((entry) => entry.kind === 'avoided');
    expect(avoided?.headline).toContain('olive field jacket');
    expect(avoided?.detail).toContain('5');
    expect(avoided?.detail).toContain('4');
    expect(avoided?.action).toEqual({ kind: 'archive', itemId: 'olive', label: 'Archive it' });
  });

  it('will not call one avoided garment a fact about its colour', () => {
    // Four passes on one olive jacket is a fact about a jacket. Calling it a
    // fact about olive is the overreach that makes people stop believing an app.
    const taste = read(many('olive', 'passed', 6));
    expect(taste.observations.map((entry) => entry.kind)).not.toContain('colour');
  });

  it('will call it a fact about the colour once two garments agree', () => {
    const items = [
      ...closet(),
      makeItem({ id: 'olive-2', category: 'chinos', name: 'Olive chinos', primaryColor: 'olive' }),
    ];
    const taste = read([...many('olive', 'passed', 4), ...many('olive-2', 'passed', 4)], items);
    const colour = taste.observations.find((entry) => entry.kind === 'colour');
    expect(colour?.headline).toContain('olive');
    expect(colour?.action).toMatchObject({ kind: 'avoid-colour', colour: 'olive' });
  });

  it('names the reach-for, and offers to mark it', () => {
    const taste = read([...many('linen', 'chosen', 3), ...many('linen', 'worn', 2)]);
    const favoured = taste.observations.find((entry) => entry.kind === 'favoured');
    expect(favoured?.headline).toContain('cream linen shirt');
    expect(favoured?.action).toMatchObject({ kind: 'favourite', itemId: 'linen' });
  });

  it('spots a pair from the wear log, and says how often', () => {
    const log = (id: string, date: string): WearLog => ({
      id,
      itemIds: ['linen', 'jeans'],
      date,
      createdAt: `${date}T09:00:00.000Z`,
      updatedAt: `${date}T09:00:00.000Z`,
    });
    const taste = read([], closet(), [
      log('w1', '2026-08-01'),
      log('w2', '2026-08-08'),
      log('w3', '2026-08-15'),
    ]);
    const pairing = taste.observations.find((entry) => entry.kind === 'pairing');
    expect(pairing?.detail).toContain('3');
    expect(pairing?.itemIds.sort()).toEqual(['jeans', 'linen']);
  });

  it('leads with the observations that have something to do about them', () => {
    const taste = read([
      ...many('olive', 'passed', 5),
      ...many('linen', 'chosen', 3),
      ...many('linen', 'worn', 2),
    ]);
    expect(taste.observations[0].kind).toBe('avoided');
  });

  it('stays quiet about anything the wearer has said is wrong', () => {
    const signals = many('olive', 'passed', 5);
    expect(read(signals).observations.length).toBeGreaterThan(0);
    expect(read(signals, closet(), [], ['avoided:olive']).observations).toEqual([]);
  });

  it('does not nag about a piece already archived', () => {
    const items = closet().map((item) =>
      item.id === 'olive' ? { ...item, archived: true } : item,
    );
    const taste = read(many('olive', 'passed', 6), items);
    expect(taste.observations).toEqual([]);
  });
});

describe('what an opinion is allowed to do to an outfit', () => {
  const request: OutfitRequest = {
    prompt: 'Something for today',
    includeItemIds: [],
    excludeItemIds: [],
    cleanOnly: true,
  };

  it('tips the balance between two equally good options', () => {
    const items = [
      makeItem({ id: 'tee-a', category: 'tshirt', name: 'White tee' }),
      makeItem({ id: 'tee-b', category: 'tshirt', name: 'Black tee' }),
      makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans' }),
      makeItem({ id: 'shoes', category: 'sneakers', name: 'White sneakers' }),
    ];
    const affinity = read(many('tee-b', 'chosen', 4), items).affinity;

    expect(buildOutfitLocally({ request, closet: items }).itemIds).toContain('tee-a');
    expect(buildOutfitLocally({ request, closet: items, affinity }).itemIds).toContain('tee-b');
  });

  /*
   * The line this must never cross. Affinity is an inference drawn from a few
   * taps; the laundry basket is a fact. An app that dresses somebody in a dirty
   * shirt because they like it has stopped being useful.
   */
  it('cannot put a dirty favourite back on you', () => {
    const items = [
      makeItem({ id: 'loved', category: 'tshirt', name: 'Loved tee', laundry: 'dirty' }),
      makeItem({ id: 'clean', category: 'tshirt', name: 'Clean tee' }),
      makeItem({ id: 'jeans', category: 'jeans' }),
      makeItem({ id: 'shoes', category: 'sneakers' }),
    ];
    const affinity = read(many('loved', 'chosen', 20), items).affinity;
    const outfit = buildOutfitLocally({ request, closet: items, affinity });
    expect(outfit.itemIds).toContain('clean');
    expect(outfit.itemIds).not.toContain('loved');
  });

  it('cannot outweigh a garment being wrong for the occasion', () => {
    const items = [
      makeItem({ id: 'blazer', category: 'blazer', name: 'Navy blazer' }),
      makeItem({ id: 'hoodie', category: 'hoodie', name: 'Grey hoodie' }),
      makeItem({ id: 'joggers', category: 'joggers' }),
      makeItem({ id: 'shoes', category: 'sneakers' }),
    ];
    const affinity = read(many('blazer', 'chosen', 20), items).affinity;
    const outfit = buildOutfitLocally({
      request,
      closet: items,
      affinity,
      avoidCategories: ['blazer'],
    });
    expect(outfit.itemIds).not.toContain('blazer');
  });

  it('stays a nudge — smaller than the things the wearer stated outright', () => {
    // Colours the wearer explicitly avoids cost 30; this must not undo that.
    expect(AFFINITY_WEIGHT).toBeLessThan(30);
  });
});
