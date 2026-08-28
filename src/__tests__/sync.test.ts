import 'fake-indexeddb/auto';

import { clearAll, put, putPhoto, readAll, remove } from '@/db';
import { runSync, SYNCED_STORES } from '@/sync/engine';
import type { SyncTransport } from '@/sync/transport';
import type { SyncRecord } from '@/sync/merge';
import type { ClothingItem, SyncedStore, Tombstone } from '@/types';

import { makeItem } from './factories';

/**
 * Two devices, one account.
 *
 * These are the tests that decide whether someone can trust the app with their
 * wardrobe. They run the real engine against a real (in-memory) IndexedDB and a
 * server that behaves like Firestore does: monotonic write stamps, and a cursor
 * that only returns what changed.
 */

/* ------------------------------------------------------------ fake server -- */

interface StoredDoc { record: SyncRecord; store: SyncedStore; stamp: number }

class FakeServer implements SyncTransport {
  /** Who the server says is signed in — the cookie, in effect. */
  constructor(private signedInAs = USER) {}

  private docs = new Map<string, StoredDoc>();
  private tombstones = new Map<string, { tombstone: Tombstone; stamp: number }>();
  private photos = new Map<string, Blob>();
  private clock = 1000;
  /** Set to make the next write throw, standing in for a dropped connection. */
  failNextPush = false;
  pushCount = 0;

  async identify() {
    return this.signedInAs;
  }

  /** Simulate somebody else signing in on the same device. */
  signInAs(userId: string) {
    this.signedInAs = userId;
  }

  private tick(): number {
    this.clock += 1;
    return this.clock;
  }

  async fetchRecords(store: SyncedStore, since: number) {
    const records: SyncRecord[] = [];
    let newestStamp = since;
    this.docs.forEach((entry) => {
      if (entry.store !== store) return;
      if (since && entry.stamp <= since) return;
      records.push(structuredClone(entry.record));
      newestStamp = Math.max(newestStamp, entry.stamp);
    });
    return { records, newestStamp };
  }

  async fetchTombstones(since: number) {
    const tombstones: Tombstone[] = [];
    let newestStamp = since;
    this.tombstones.forEach((entry) => {
      if (since && entry.stamp <= since) return;
      tombstones.push(structuredClone(entry.tombstone));
      newestStamp = Math.max(newestStamp, entry.stamp);
    });
    return { tombstones, newestStamp };
  }

  async pushRecords(store: SyncedStore, records: SyncRecord[]) {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('connection lost');
    }
    this.pushCount += records.length;
    records.forEach((record) => {
      this.docs.set(`${store}__${record.id}`, {
        record: structuredClone(record),
        store,
        stamp: this.tick(),
      });
    });
  }

  async pushTombstones(tombstones: Tombstone[]) {
    tombstones.forEach((tombstone) => {
      this.tombstones.set(tombstone.id, { tombstone: structuredClone(tombstone), stamp: this.tick() });
      this.docs.delete(`${tombstone.store}__${tombstone.recordId}`);
    });
  }

  async listPhotoIds() {
    return [...this.photos.keys()];
  }

  async uploadPhoto(id: string, photo: { blob: Blob }) {
    this.photos.set(id, photo.blob);
  }

  async downloadPhoto(id: string) {
    return this.photos.get(id) ?? null;
  }

  /** What the server holds, for assertions. */
  itemIds(): string[] {
    return [...this.docs.values()]
      .filter((entry) => entry.store === 'items')
      .map((entry) => entry.record.id)
      .sort();
  }
}

/* ------------------------------------------------------------- device rig -- */

type Snapshot = Record<string, unknown[]>;

/** Everything on one device, so a second device can be simulated by swapping. */
async function snapshot(): Promise<Snapshot> {
  const out: Snapshot = {};
  for (const store of SYNCED_STORES) out[store] = await readAll(store);
  const { db } = await import('@/db');
  const database = await db();
  out.photos = await database.getAll('photos');
  out.deletions = await database.getAll('deletions');
  out.meta = await database.getAll('meta');
  return out;
}

async function restore(snap: Snapshot): Promise<void> {
  await clearAll();
  const { db } = await import('@/db');
  const database = await db();
  for (const store of SYNCED_STORES) {
    for (const record of snap[store] ?? []) await database.put(store, record as never);
  }
  for (const photo of snap.photos ?? []) await database.put('photos', photo as never);
  for (const tombstone of snap.deletions ?? []) await database.put('deletions', tombstone as never);
  for (const entry of snap.meta ?? []) await database.put('meta', entry as never);
}

const USER = 'user-1';
const sync = (server: FakeServer, mode?: 'auto' | 'adopt') => runSync(USER, server, mode);

const itemIds = async () => (await readAll('items')).map((item) => item.id).sort();

async function addItem(overrides: Partial<ClothingItem> & { id: string }): Promise<ClothingItem> {
  const item = { ...makeItem({ category: 'tshirt', ...overrides }), ...overrides };
  await put('items', item);
  return item;
}

beforeEach(async () => {
  await clearAll();
});

/* ------------------------------------------------------------------ tests -- */

describe('a wardrobe reaching the cloud', () => {
  it('pushes everything on the first sync', async () => {
    await addItem({ id: 'a' });
    await addItem({ id: 'b' });
    const server = new FakeServer();

    const report = await sync(server);

    expect(report.pushed).toBe(2);
    expect(server.itemIds()).toEqual(['a', 'b']);
  });

  it('sends nothing the second time', async () => {
    await addItem({ id: 'a' });
    const server = new FakeServer();
    await sync(server);
    const second = await sync(server);

    expect(second.pushed).toBe(0);
    expect(second.pulled).toBe(0);
  });

  it('restores a wiped device from the account alone', async () => {
    await addItem({ id: 'a', name: 'White tee' });
    await addItem({ id: 'b', name: 'Indigo jeans' });
    const server = new FakeServer();
    await sync(server);

    // The phone is lost. A brand new device signs into the same account.
    await clearAll();
    expect(await itemIds()).toEqual([]);

    const report = await sync(server);

    expect(report.pulled).toBe(2);
    expect(await itemIds()).toEqual(['a', 'b']);
    expect((await readAll('items')).map((i) => i.name).sort()).toEqual([
      'Indigo jeans',
      'White tee',
    ]);
  });

  it('carries photos across to the new device', async () => {
    await putPhoto({
      id: 'photo-1',
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
      width: 100,
      height: 125,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await addItem({ id: 'a', photoId: 'photo-1' });
    const server = new FakeServer();

    const first = await sync(server);
    expect(first.photosUploaded).toBe(1);

    await clearAll();
    const second = await sync(server);

    expect(second.photosDownloaded).toBe(1);
    const { db } = await import('@/db');
    const restored = await (await db()).get('photos', 'photo-1');
    expect(restored?.blob.size).toBe(4);
  });
});

describe('two devices', () => {
  it('converges on the newer edit', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a', name: 'Original', updatedAt: '2026-01-01T00:00:00.000Z' });
    await sync(server);
    const deviceA = await snapshot();

    // Second device pulls, then renames the item.
    await clearAll();
    await sync(server);
    await put('items', {
      ...(await readAll('items'))[0],
      name: 'Renamed on the iPad',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    await sync(server);

    // Back on the first device.
    await restore(deviceA);
    await sync(server);

    expect((await readAll('items'))[0].name).toBe('Renamed on the iPad');
  });

  it('does not let an older copy overwrite a newer one', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a', name: 'Newer', updatedAt: '2026-03-01T00:00:00.000Z' });
    await sync(server);
    const deviceA = await snapshot();

    await clearAll();
    await sync(server);
    await put('items', {
      ...(await readAll('items'))[0],
      name: 'Older',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await sync(server);

    await restore(deviceA);
    await sync(server);
    expect((await readAll('items'))[0].name).toBe('Newer');
  });

  it('a deletion on one device does not come back from the other', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a' });
    await addItem({ id: 'b' });
    await sync(server);
    const deviceA = await snapshot();

    // Second device pulls both, then deletes one.
    await clearAll();
    await sync(server);
    await remove('items', 'b');
    await sync(server);
    expect(server.itemIds()).toEqual(['a']);

    // First device still has it, and must not push it back.
    await restore(deviceA);
    expect(await itemIds()).toEqual(['a', 'b']);

    await sync(server);
    expect(await itemIds()).toEqual(['a']);
    expect(server.itemIds()).toEqual(['a']);

    // And it stays gone, however many times either side syncs.
    await sync(server);
    await sync(server);
    expect(await itemIds()).toEqual(['a']);
    expect(server.itemIds()).toEqual(['a']);
  });

  it('keeps a piece that was re-added after being deleted elsewhere', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a' });
    await sync(server);
    const deviceA = await snapshot();

    await clearAll();
    await sync(server);
    await remove('items', 'a');
    await sync(server);

    // Meanwhile the first device edits it, later than the deletion.
    await restore(deviceA);
    await put('items', {
      ...(await readAll('items'))[0],
      name: 'Back in use',
      updatedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await sync(server);

    expect(await itemIds()).toEqual(['a']);
    expect(server.itemIds()).toEqual(['a']);
  });
});

describe('when things go wrong', () => {
  it('loses nothing when the connection drops mid-sync', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a' });
    await addItem({ id: 'b' });

    server.failNextPush = true;
    await expect(sync(server)).rejects.toThrow('connection lost');

    // The wardrobe is untouched locally, and the next run completes it.
    expect(await itemIds()).toEqual(['a', 'b']);
    const report = await sync(server);
    expect(report.pushed).toBe(2);
    expect(server.itemIds()).toEqual(['a', 'b']);
  });

  it('does not advance its cursor after a failure', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a' });
    server.failNextPush = true;
    await expect(sync(server)).rejects.toThrow();

    const { readMeta } = await import('@/db');
    expect(await readMeta('sync')).toBeUndefined();
  });

  it('still restores the wardrobe when a photo file is missing', async () => {
    const server = new FakeServer();
    await addItem({ id: 'a', photoId: 'missing-photo' });
    await sync(server);

    await clearAll();
    const report = await sync(server);

    expect(await itemIds()).toEqual(['a']);
    expect(report.photosDownloaded).toBe(0);
  });

  it('refuses to upload one account’s wardrobe into another', async () => {
    const server = new FakeServer();
    await addItem({ id: 'private-to-a' });
    await sync(server);

    // The same device is now signed into a different account.
    const otherServer = new FakeServer('user-2');
    const report = await runSync('user-2', otherServer);

    expect(otherServer.itemIds()).toEqual([]);
    expect(report.pushed).toBe(0);
    // And nothing local was destroyed in the process.
    expect(await itemIds()).toEqual(['private-to-a']);
  });

  /*
   * The bug this covers shipped and was caught in a browser: the client cached
   * "you are Tommy" while the session cookie had become Lia's, so the guard
   * compared Tommy to Tommy, saw no mismatch, and pushed one person's wardrobe
   * into the other's account. Identity now comes from the server.
   */
  it('stops rather than sync when the client and the server disagree', async () => {
    const server = new FakeServer();
    await addItem({ id: 'belongs-to-user-1' });
    await sync(server);

    // Somebody else signs in, but the client still thinks it is user-1.
    server.signInAs('user-2');
    await expect(runSync(USER, server)).rejects.toThrow(/Signed in as user-2/);

    // Nothing crossed over, and nothing local was touched.
    expect(server.itemIds()).toEqual(['belongs-to-user-1']);
    expect(await itemIds()).toEqual(['belongs-to-user-1']);
  });

  it('holds back a wardrobe that belongs to another account', async () => {
    const first = new FakeServer('user-1');
    await addItem({ id: 'user-1-only' });
    await sync(first);

    // Same device, second account. The engine must not push what it holds.
    const second = new FakeServer('user-2');
    const report = await runSync('user-2', second);

    expect(report.heldBackLocalData).toBe(true);
    expect(second.itemIds()).toEqual([]);
    expect(await itemIds()).toEqual(['user-1-only']);
  });

  /*
   * This one shipped and was caught in a browser. The first pull-only run
   * recorded the new account id, so the next run — triggered by the writes the
   * pull itself made — saw matching ids, decided the other person's clothes
   * belonged to this account, and uploaded all of them.
   */
  it('keeps holding it back on every later sync, not just the first', async () => {
    const first = new FakeServer('user-1');
    await addItem({ id: 'user-1-only' });
    await sync(first);

    const second = new FakeServer('user-2');
    await runSync('user-2', second);
    await runSync('user-2', second);
    await runSync('user-2', second);

    expect(second.itemIds()).toEqual([]);
  });

  it('and still holds it back after the other account’s items arrive', async () => {
    const first = new FakeServer('user-1');
    await addItem({ id: 'user-1-only' });
    await sync(first);

    // user-2 has their own wardrobe waiting on the server.
    const second = new FakeServer('user-2');
    await second.pushRecords('items', [{ id: 'user-2-only', updatedAt: '2026-01-01T00:00:00.000Z' }]);

    await runSync('user-2', second);
    await runSync('user-2', second);

    // Both are on the device now, but only user-2's is in user-2's account.
    expect((await itemIds()).sort()).toEqual(['user-1-only', 'user-2-only']);
    expect(second.itemIds()).toEqual(['user-2-only']);
  });

  it('uploads it only when somebody deliberately adopts it', async () => {
    const first = new FakeServer('user-1');
    await addItem({ id: 'was-user-1s' });
    await sync(first);

    const second = new FakeServer('user-2');
    await runSync('user-2', second);
    expect(second.itemIds()).toEqual([]);

    await runSync('user-2', second, 'adopt');
    expect(second.itemIds()).toEqual(['was-user-1s']);

    // And the warning does not come back afterwards.
    const report = await runSync('user-2', second);
    expect(report.heldBackLocalData).toBe(false);
  });
});

describe('everything else in the wardrobe', () => {
  it('syncs outfits, wear history, plans, packing and wishlist', async () => {
    const server = new FakeServer();
    const stamp = '2026-01-01T00:00:00.000Z';

    await addItem({ id: 'a' });
    await put('outfits', {
      id: 'fit-1', name: 'Office', itemIds: ['a'], favorite: false, source: 'manual',
      timesWorn: 0, createdAt: stamp, updatedAt: stamp,
    });
    await put('wearLogs', {
      id: 'log-1', itemIds: ['a'], date: '2026-01-01', createdAt: stamp, updatedAt: stamp,
    });
    await put('calendar', {
      id: 'cal-1', date: '2026-01-02', outfitId: 'fit-1', createdAt: stamp, updatedAt: stamp,
    });
    await put('packing', {
      id: 'pack-1', destination: 'Lisbon', days: 3, activities: [], itemIds: ['a'],
      dayPlans: [], packedItemIds: [], createdAt: stamp, updatedAt: stamp,
    });
    await put('wishlist', {
      id: 'wish-1', name: 'Camel coat', category: 'coat', source: 'manual',
      purchased: false, createdAt: stamp, updatedAt: stamp,
    });

    await sync(server);
    await clearAll();
    await sync(server);

    for (const store of SYNCED_STORES) {
      expect((await readAll(store)).length, `${store} should have come back`).toBe(1);
    }
  });
});
