import { findMemories } from '@/domain/memories';
import type { Outfit, WearLog } from '@/types';

import { makeItem } from './factories';

const TODAY = new Date(2026, 7, 28);
const dayKey = (offsetDays: number) => {
  const date = new Date(TODAY.getTime() - offsetDays * 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};
const iso = (offsetDays: number) =>
  new Date(TODAY.getTime() - offsetDays * 86_400_000).toISOString();

const log = (overrides: Partial<WearLog> & { date: string; itemIds: string[] }): WearLog => ({
  id: `log-${overrides.date}-${overrides.itemIds.join('')}`,
  createdAt: iso(0),
  ...overrides,
});

describe('findMemories', () => {
  it('finds what you wore a year ago today', () => {
    const tee = makeItem({ id: 'tee', category: 'tshirt', name: 'White tee' });
    const outfit: Outfit = {
      id: 'fit-1',
      name: 'Summer date',
      itemIds: ['tee'],
      favorite: false,
      source: 'manual',
      timesWorn: 1,
      createdAt: iso(365),
      updatedAt: iso(365),
    };
    const memories = findMemories(
      [tee],
      [outfit],
      [log({ date: dayKey(365), itemIds: ['tee'], outfitId: 'fit-1' })],
      TODAY,
    );
    const anniversary = memories.find((memory) => memory.kind === 'anniversary');
    expect(anniversary?.title).toBe('A year ago today');
    expect(anniversary?.body).toContain('summer date');
  });

  it('tolerates being a couple of days out', () => {
    const tee = makeItem({ id: 'tee', category: 'tshirt' });
    const found = findMemories([tee], [], [log({ date: dayKey(367), itemIds: ['tee'] })], TODAY);
    expect(found.some((memory) => memory.kind === 'anniversary')).toBe(true);
  });

  it('does not invent an anniversary from last week', () => {
    const tee = makeItem({ id: 'tee', category: 'tshirt' });
    const found = findMemories([tee], [], [log({ date: dayKey(7), itemIds: ['tee'] })], TODAY);
    expect(found.some((memory) => memory.kind === 'anniversary')).toBe(false);
  });

  it('surfaces something forgotten at the back', () => {
    const coat = makeItem({
      id: 'coat',
      category: 'coat',
      name: 'Charcoal coat',
      wearCount: 4,
      lastWornAt: iso(200),
    });
    const memory = findMemories([coat], [], [], TODAY).find(
      (entry) => entry.kind === 'forgotten',
    );
    expect(memory?.body).toContain('charcoal coat');
    expect(memory?.itemIds).toEqual(['coat']);
  });

  it('leaves accessories out of the forgotten pile', () => {
    const watch = makeItem({
      id: 'watch',
      category: 'watch',
      wearCount: 3,
      lastWornAt: iso(300),
    });
    expect(findMemories([watch], [], [], TODAY).some((m) => m.kind === 'forgotten')).toBe(false);
  });

  it('notices a piece on heavy rotation', () => {
    const jeans = makeItem({ id: 'jeans', category: 'jeans', name: 'Indigo jeans' });
    const logs = [1, 3, 5, 8, 11].map((offset) =>
      log({ date: dayKey(offset), itemIds: ['jeans'] }),
    );
    const memory = findMemories([jeans], [], logs, TODAY).find((m) => m.kind === 'on-repeat');
    expect(memory?.body).toContain('5 times');
  });

  it('flags pieces that have sat unworn for a month', () => {
    const dress = makeItem({ id: 'dress', category: 'dress', name: 'Green dress', createdAt: iso(60) });
    const memory = findMemories([dress], [], [], TODAY).find((m) => m.kind === 'never-worn');
    expect(memory?.title).toBe('Still with the tags on');
  });

  it('gives a brand new unworn piece time before nagging', () => {
    const dress = makeItem({ id: 'dress', category: 'dress', createdAt: iso(3) });
    expect(findMemories([dress], [], [], TODAY).some((m) => m.kind === 'never-worn')).toBe(false);
  });

  it('ignores archived pieces entirely', () => {
    const coat = makeItem({
      id: 'coat',
      category: 'coat',
      wearCount: 4,
      lastWornAt: iso(200),
      archived: true,
    });
    expect(findMemories([coat], [], [], TODAY)).toHaveLength(0);
  });

  it('never references a piece that has been deleted', () => {
    const memories = findMemories([], [], [log({ date: dayKey(365), itemIds: ['gone'] })], TODAY);
    expect(memories).toHaveLength(0);
  });

  it('ranks the anniversary above everything else', () => {
    const tee = makeItem({ id: 'tee', category: 'tshirt' });
    const coat = makeItem({ id: 'coat', category: 'coat', wearCount: 2, lastWornAt: iso(200) });
    const memories = findMemories(
      [tee, coat],
      [],
      [log({ date: dayKey(365), itemIds: ['tee'] })],
      TODAY,
    );
    expect(memories[0].kind).toBe('anniversary');
  });
});
