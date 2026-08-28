import 'fake-indexeddb/auto';

import { openDB } from 'idb';

import { DB_VERSION, MIGRATIONS } from '@/db/migrations';

/**
 * Upgrading somebody's database.
 *
 * A migration that throws leaves the database stuck at the old version and the
 * app unable to open it at all — which, to the person holding the phone, is
 * exactly the same as having lost everything. These tests build a database in
 * the shape an earlier release left behind and prove the current code opens it
 * without dropping a single record.
 */

const DB_NAME = 'outfitai';

async function wipe() {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

/** A database exactly as version 1 of the app left it. */
async function buildVersion1() {
  const database = await openDB(DB_NAME, 1, {
    upgrade(db) {
      const items = db.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('createdAt', 'createdAt');
      items.createIndex('category', 'category');
      const outfits = db.createObjectStore('outfits', { keyPath: 'id' });
      outfits.createIndex('createdAt', 'createdAt');
      const wearLogs = db.createObjectStore('wearLogs', { keyPath: 'id' });
      wearLogs.createIndex('date', 'date');
      const calendar = db.createObjectStore('calendar', { keyPath: 'id' });
      calendar.createIndex('date', 'date');
      const packing = db.createObjectStore('packing', { keyPath: 'id' });
      packing.createIndex('createdAt', 'createdAt');
      const wishlist = db.createObjectStore('wishlist', { keyPath: 'id' });
      wishlist.createIndex('createdAt', 'createdAt');
      db.createObjectStore('photos', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });

  await database.put('items', {
    id: 'item-1',
    name: 'White tee',
    category: 'tshirt',
    primaryColor: 'white',
    primaryColorHex: '#F7F5F2',
    secondaryColors: [],
    pattern: 'solid',
    formality: 'casual',
    seasons: ['summer'],
    styles: ['casual'],
    favorite: false,
    laundry: 'clean',
    wearCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    detection: { source: 'manual', editedByUser: false },
  });
  // Records from before sync existed: a creation stamp and nothing else.
  await database.put('wearLogs', {
    id: 'log-1', itemIds: ['item-1'], date: '2026-01-05', createdAt: '2026-01-05T09:00:00.000Z',
  });
  await database.put('calendar', {
    id: 'cal-1', date: '2026-01-06', outfitId: 'fit-1', createdAt: '2026-01-05T09:00:00.000Z',
  });
  await database.put('packing', {
    id: 'pack-1', destination: 'Lisbon', days: 3, activities: [], itemIds: [],
    dayPlans: [], packedItemIds: [], createdAt: '2026-01-04T09:00:00.000Z',
  });
  await database.put('wishlist', {
    id: 'wish-1', name: 'Camel coat', category: 'coat', source: 'manual',
    purchased: false, createdAt: '2026-01-03T09:00:00.000Z',
  });
  await database.put('photos', {
    id: 'photo-1', blob: new Blob([new Uint8Array([9, 9])]), width: 10, height: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  await database.put('meta', {
    key: 'preferences', value: { themeMode: 'dark', units: 'metric' },
  });

  database.close();
}

/** Open at the current version, running whatever migrations are outstanding. */
async function openCurrent() {
  const { runMigrations } = await import('@/db/migrations');
  return openDB(DB_NAME, DB_VERSION, {
    async upgrade(database, oldVersion, _newVersion, transaction) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test rig
      await runMigrations(database as any, transaction as any, oldVersion);
    },
  });
}

beforeEach(wipe);
afterEach(wipe);

describe('migrations', () => {
  it('the declared version matches the highest step', () => {
    expect(DB_VERSION).toBe(Math.max(...MIGRATIONS.map((m) => m.version)));
  });

  it('has no duplicate or out-of-order versions', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
  });

  it('creates every store on a brand new database', async () => {
    const database = await openCurrent();
    expect([...database.objectStoreNames].sort()).toEqual([
      'calendar', 'deletions', 'items', 'meta', 'outfits',
      'packing', 'photos', 'wearLogs', 'wishlist',
    ]);
    database.close();
  });

  it('upgrades a version 1 database without losing a record', async () => {
    await buildVersion1();
    const database = await openCurrent();

    expect(database.version).toBe(DB_VERSION);
    expect((await database.getAll('items'))).toHaveLength(1);
    expect((await database.getAll('wearLogs'))).toHaveLength(1);
    expect((await database.getAll('calendar'))).toHaveLength(1);
    expect((await database.getAll('packing'))).toHaveLength(1);
    expect((await database.getAll('wishlist'))).toHaveLength(1);
    expect((await database.getAll('photos'))).toHaveLength(1);

    const preferences = await database.get('meta', 'preferences');
    expect((preferences?.value as { themeMode: string }).themeMode).toBe('dark');

    database.close();
  });

  it('backfills updatedAt from createdAt rather than inventing a time', async () => {
    await buildVersion1();
    const database = await openCurrent();

    const log = await database.get('wearLogs', 'log-1');
    expect(log?.updatedAt).toBe('2026-01-05T09:00:00.000Z');
    const wish = await database.get('wishlist', 'wish-1');
    expect(wish?.updatedAt).toBe('2026-01-03T09:00:00.000Z');

    database.close();
  });

  it('leaves an existing updatedAt alone', async () => {
    await buildVersion1();
    const database = await openCurrent();
    const item = await database.get('items', 'item-1');
    expect(item?.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    database.close();
  });

  it('is safe to run twice', async () => {
    await buildVersion1();
    (await openCurrent()).close();
    const database = await openCurrent();
    expect((await database.getAll('items'))).toHaveLength(1);
    expect(database.version).toBe(DB_VERSION);
    database.close();
  });

  it('reports which step failed instead of failing silently', async () => {
    const { runMigrations } = await import('@/db/migrations');
    const broken = [
      { version: 99, describe: 'a step that throws', run: () => { throw new Error('boom'); } },
    ];
    const original = MIGRATIONS.splice(0, MIGRATIONS.length, ...broken);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test rig
      runMigrations({} as any, {} as any, 0),
    ).rejects.toThrow(/v99 \(a step that throws\).*boom/);
    MIGRATIONS.splice(0, MIGRATIONS.length, ...original);
  });
});
