'use client';

import { openDB, type IDBPDatabase } from 'idb';

import { nowIso } from '@/lib/date';
import type { SyncedStore, Tombstone } from '@/types';

import { DB_VERSION, runMigrations } from './migrations';
import type { OutfitAIDB, MetaShapes, StoredPhoto } from './schema';

const DB_NAME = 'outfitai';

let dbPromise: Promise<IDBPDatabase<OutfitAIDB>> | null = null;

/** Broadcast so a second tab does not keep showing a stale wardrobe. */
const CHANNEL = 'outfitai:changes';
/**
 * A BroadcastChannel does not hear its own posts, but a second channel object
 * in the same tab does — so messages carry the tab that sent them and a
 * listener ignores its own. Without this every local write would trigger a full
 * re-read in the tab that made it.
 */
const TAB_ID = Math.random().toString(36).slice(2);
let channel: BroadcastChannel | null = null;

function broadcast(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ tab: TAB_ID, at: Date.now() });
}

/** Run `handler` when another tab changes the data. Never fires for own writes. */
export function onExternalChange(handler: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const listener = new BroadcastChannel(CHANNEL);
  listener.onmessage = (event: MessageEvent<{ tab?: string }>) => {
    if (event.data?.tab === TAB_ID) return;
    handler();
  };
  return () => listener.close();
}

/** Run `handler` after any local write, so sync can be scheduled. */
export function onLocalWrite(handler: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const listener = new BroadcastChannel(CHANNEL);
  listener.onmessage = (event: MessageEvent<{ tab?: string }>) => {
    if (event.data?.tab === TAB_ID) handler();
  };
  return () => listener.close();
}

/**
 * IndexedDB does not exist during SSR or prerender, so every caller goes
 * through here and every caller is a client component effect.
 */
export function db(): Promise<IDBPDatabase<OutfitAIDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<OutfitAIDB>(DB_NAME, DB_VERSION, {
      async upgrade(database, oldVersion, _newVersion, transaction) {
        await runMigrations(database, transaction, oldVersion);
      },
      blocked() {
        console.warn('[outfitai] another tab is holding an older database version open');
      },
      blocking() {
        // Another tab wants to upgrade. Let go rather than deadlock it: the
        // next call reopens at the new version.
        void dbPromise?.then((database) => database.close());
        dbPromise = null;
      },
      terminated() {
        // The browser dropped the connection (memory pressure, a crashed tab).
        // Forget it so the next call reconnects instead of failing forever.
        dbPromise = null;
      },
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

type CollectionName = 'items' | 'outfits' | 'wearLogs' | 'calendar' | 'packing' | 'wishlist';

export async function readAll<K extends CollectionName>(
  store: K,
): Promise<OutfitAIDB[K]['value'][]> {
  const database = await db();
  return database.getAll(store);
}

export async function put<K extends CollectionName>(
  store: K,
  value: OutfitAIDB[K]['value'],
): Promise<void> {
  const database = await db();
  await database.put(store, value);
  broadcast();
}

export async function putMany<K extends CollectionName>(
  store: K,
  values: OutfitAIDB[K]['value'][],
): Promise<void> {
  if (!values.length) return;
  const database = await db();
  const tx = database.transaction(store, 'readwrite');
  await Promise.all([...values.map((value) => tx.store.put(value)), tx.done]);
  broadcast();
}

/**
 * Delete a record and leave a tombstone.
 *
 * The tombstone is what makes the deletion survive a sync: without it the other
 * device still holds the record, pushes it back, and the thing reappears.
 */
export async function remove(store: CollectionName, id: string): Promise<void> {
  const database = await db();
  const tx = database.transaction([store, 'deletions'], 'readwrite');
  const tombstone: Tombstone = {
    id: `${store}:${id}`,
    store: store as SyncedStore,
    recordId: id,
    deletedAt: nowIso(),
  };
  await Promise.all([
    tx.objectStore(store).delete(id),
    tx.objectStore('deletions').put(tombstone),
    tx.done,
  ]);
  broadcast();
}

/** Apply a remote deletion without recording a fresh tombstone for it. */
export async function removeSilently(store: CollectionName, id: string): Promise<void> {
  const database = await db();
  await database.delete(store, id);
}

export async function readTombstones(): Promise<Tombstone[]> {
  const database = await db();
  return database.getAll('deletions');
}

export async function putTombstone(tombstone: Tombstone): Promise<void> {
  const database = await db();
  await database.put('deletions', tombstone);
}

/** Tombstones older than the horizon are no longer needed by any device. */
export async function pruneTombstones(olderThanDays = 120): Promise<number> {
  const database = await db();
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const stale = (await database.getAll('deletions')).filter(
    (tombstone) => tombstone.deletedAt < cutoff,
  );
  if (!stale.length) return 0;
  const tx = database.transaction('deletions', 'readwrite');
  await Promise.all([...stale.map((t) => tx.store.delete(t.id)), tx.done]);
  return stale.length;
}

export async function clearAll(): Promise<void> {
  const database = await db();
  const stores = [
    'items',
    'outfits',
    'wearLogs',
    'calendar',
    'packing',
    'wishlist',
    'photos',
    'meta',
    'deletions',
  ] as const;
  const tx = database.transaction(stores, 'readwrite');
  await Promise.all([...stores.map((name) => tx.objectStore(name).clear()), tx.done]);
}

export async function readMeta<K extends keyof MetaShapes>(
  key: K,
): Promise<MetaShapes[K] | undefined> {
  const database = await db();
  const record = await database.get('meta', key);
  return record?.value as MetaShapes[K] | undefined;
}

export async function writeMeta<K extends keyof MetaShapes>(
  key: K,
  value: MetaShapes[K],
): Promise<void> {
  const database = await db();
  await database.put('meta', { key, value });
}

/* ---------------------------------------------------------------- photos -- */

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  const database = await db();
  await database.put('photos', photo);
}

export async function listPhotoIds(): Promise<string[]> {
  const database = await db();
  return database.getAllKeys('photos') as Promise<string[]>;
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  const database = await db();
  return database.get('photos', id);
}

export async function deletePhoto(id: string): Promise<void> {
  const database = await db();
  await database.delete('photos', id);
}

/**
 * Object URLs are per-document and leak if never revoked, so they are cached by
 * photo id and released together when the tab goes away.
 */
const urlCache = new Map<string, string>();

export async function photoUrl(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const cached = urlCache.get(id);
  if (cached) return cached;
  const photo = await getPhoto(id);
  if (!photo) return null;
  const url = URL.createObjectURL(photo.blob);
  urlCache.set(id, url);
  return url;
}

export function forgetPhotoUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    urlCache.forEach((url) => URL.revokeObjectURL(url));
    urlCache.clear();
  });
}

/** Rough storage footprint, shown in Settings. */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
