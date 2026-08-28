import { mergeCollection, orphanedPhotoIds, planPhotoSync, resolveOne } from '@/sync/merge';
import type { SyncedStore, Tombstone } from '@/types';

interface Rec { id: string; updatedAt: string; label?: string }

const rec = (id: string, updatedAt: string, label?: string): Rec => ({ id, updatedAt, label });
const tomb = (id: string, deletedAt: string, store: SyncedStore = 'items'): Tombstone => ({
  id: `${store}:${id}`, store, recordId: id, deletedAt,
});

const merge = (input: Partial<Parameters<typeof mergeCollection<Rec>>[0]>) =>
  mergeCollection<Rec>({
    store: 'items', local: [], remote: [], localTombstones: [], remoteTombstones: [], ...input,
  });

describe('resolveOne', () => {
  it('takes the remote copy when it is newer', () => {
    expect(resolveOne<Rec>({ local: rec('a', '2026-01-01'), remote: rec('a', '2026-02-01') }))
      .toEqual([{ action: 'write-local', record: rec('a', '2026-02-01') }]);
  });

  it('pushes the local copy when it is newer', () => {
    expect(resolveOne<Rec>({ local: rec('a', '2026-03-01'), remote: rec('a', '2026-02-01') }))
      .toEqual([{ action: 'push', record: rec('a', '2026-03-01') }]);
  });

  it('does nothing when both sides already agree', () => {
    expect(resolveOne<Rec>({ local: rec('a', '2026-02-01'), remote: rec('a', '2026-02-01') }))
      .toEqual([{ action: 'none' }]);
  });

  it('pushes a record the server has never seen', () => {
    expect(resolveOne<Rec>({ local: rec('a', '2026-02-01') }))
      .toEqual([{ action: 'push', record: rec('a', '2026-02-01') }]);
  });

  it('writes a record this device has never seen', () => {
    expect(resolveOne<Rec>({ remote: rec('a', '2026-02-01') }))
      .toEqual([{ action: 'write-local', record: rec('a', '2026-02-01') }]);
  });
});

describe('deletions', () => {
  it('deletes locally when the other device deleted it later', () => {
    const plan = merge({
      local: [rec('a', '2026-01-01')],
      remoteTombstones: [tomb('a', '2026-02-01')],
    });
    expect(plan.deleteLocal).toEqual(['a']);
    expect(plan.push).toEqual([]);
    expect(plan.adoptTombstones).toHaveLength(1);
  });

  it('does not resurrect a record the server still holds after a local delete', () => {
    const plan = merge({
      remote: [rec('a', '2026-01-01')],
      localTombstones: [tomb('a', '2026-02-01')],
    });
    expect(plan.writeLocal).toEqual([]);
    expect(plan.pushTombstones).toHaveLength(1);
  });

  it('keeps a record edited after it was deleted elsewhere', () => {
    const plan = merge({
      local: [rec('a', '2026-03-01', 'edited')],
      remoteTombstones: [tomb('a', '2026-02-01')],
    });
    expect(plan.deleteLocal).toEqual([]);
    expect(plan.push).toEqual([rec('a', '2026-03-01', 'edited')]);
  });

  it('honours a deletion that came after the edit', () => {
    const plan = merge({
      local: [rec('a', '2026-01-01')],
      remote: [rec('a', '2026-02-01')],
      remoteTombstones: [tomb('a', '2026-03-01')],
    });
    expect(plan.deleteLocal).toEqual(['a']);
    expect(plan.writeLocal).toEqual([]);
  });

  it('does not push a tombstone the server already has', () => {
    const plan = merge({
      localTombstones: [tomb('a', '2026-02-01')],
      remoteTombstones: [tomb('a', '2026-02-01')],
    });
    expect(plan.pushTombstones).toEqual([]);
  });

  it('ignores tombstones belonging to another collection', () => {
    const plan = merge({
      local: [rec('a', '2026-01-01')],
      remoteTombstones: [tomb('a', '2026-05-01', 'outfits')],
    });
    expect(plan.deleteLocal).toEqual([]);
    expect(plan.push).toEqual([rec('a', '2026-01-01')]);
  });
});

describe('mergeCollection', () => {
  it('handles a mixed batch in one pass', () => {
    const plan = merge({
      local: [rec('same', '2026-02-01'), rec('mine', '2026-03-01'), rec('older', '2026-01-01')],
      remote: [rec('same', '2026-02-01'), rec('theirs', '2026-03-01'), rec('older', '2026-02-01')],
    });
    expect(plan.push.map((r) => r.id)).toEqual(['mine']);
    expect(plan.writeLocal.map((r) => r.id).sort()).toEqual(['older', 'theirs']);
    expect(plan.deleteLocal).toEqual([]);
  });

  it('is idempotent — running it on its own result changes nothing', () => {
    const local = [rec('a', '2026-01-01'), rec('b', '2026-03-01')];
    const remote = [rec('a', '2026-02-01')];
    const first = merge({ local, remote });

    const settledLocal = [
      ...local.filter((r) => !first.writeLocal.some((w) => w.id === r.id)),
      ...first.writeLocal,
    ];
    const settledRemote = [...remote, ...first.push];

    const second = mergeCollection<Rec>({
      store: 'items', local: settledLocal, remote: settledRemote,
      localTombstones: [], remoteTombstones: [],
    });
    expect(second.push).toEqual([]);
    expect(second.writeLocal).toEqual([]);
    expect(second.deleteLocal).toEqual([]);
  });

  it('an empty first sync pushes the whole wardrobe and loses nothing', () => {
    const local = Array.from({ length: 50 }, (_, i) => rec(`item-${i}`, '2026-01-01'));
    const plan = merge({ local });
    expect(plan.push).toHaveLength(50);
    expect(plan.deleteLocal).toEqual([]);
  });

  it('a fresh device pulls the whole wardrobe down', () => {
    const remote = Array.from({ length: 50 }, (_, i) => rec(`item-${i}`, '2026-01-01'));
    const plan = merge({ remote });
    expect(plan.writeLocal).toHaveLength(50);
    expect(plan.push).toEqual([]);
  });
});

describe('photo sync', () => {
  it('uploads what only this device has and downloads what only the server has', () => {
    expect(planPhotoSync({
      referencedIds: ['p1', 'p2', 'p3'],
      localIds: ['p1', 'p2'],
      remoteIds: ['p2', 'p3'],
    })).toEqual({ upload: ['p1'], download: ['p3'] });
  });

  it('never moves a photo nothing refers to', () => {
    expect(planPhotoSync({ referencedIds: [], localIds: ['orphan'], remoteIds: [] }))
      .toEqual({ upload: [], download: [] });
  });

  it('tolerates undefined photo ids from items with no picture', () => {
    expect(planPhotoSync({
      referencedIds: ['p1', undefined as unknown as string, ''],
      localIds: ['p1'], remoteIds: [],
    })).toEqual({ upload: ['p1'], download: [] });
  });

  it('finds photos left behind by deleted items', () => {
    expect(orphanedPhotoIds(['p1'], ['p1', 'p2', 'p3'])).toEqual(['p2', 'p3']);
  });
});
