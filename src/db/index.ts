'use client';

import { openDB, type IDBPDatabase } from 'idb';

import type { OutfitAIDB, MetaShapes, StoredPhoto } from './schema';

const DB_NAME = 'outfitai';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OutfitAIDB>> | null = null;

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
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const items = database.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('createdAt', 'createdAt');
          items.createIndex('category', 'category');

          const outfits = database.createObjectStore('outfits', { keyPath: 'id' });
          outfits.createIndex('createdAt', 'createdAt');

          const wearLogs = database.createObjectStore('wearLogs', { keyPath: 'id' });
          wearLogs.createIndex('date', 'date');

          const calendar = database.createObjectStore('calendar', { keyPath: 'id' });
          calendar.createIndex('date', 'date');

          const packing = database.createObjectStore('packing', { keyPath: 'id' });
          packing.createIndex('createdAt', 'createdAt');

          const wishlist = database.createObjectStore('wishlist', { keyPath: 'id' });
          wishlist.createIndex('createdAt', 'createdAt');

          database.createObjectStore('photos', { keyPath: 'id' });
          database.createObjectStore('meta', { keyPath: 'key' });
        }
      },
      blocked() {
        console.warn('[outfitai] another tab is holding an older database version open');
      },
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
}

export async function putMany<K extends CollectionName>(
  store: K,
  values: OutfitAIDB[K]['value'][],
): Promise<void> {
  const database = await db();
  const tx = database.transaction(store, 'readwrite');
  await Promise.all([...values.map((value) => tx.store.put(value)), tx.done]);
}

export async function remove(store: CollectionName, id: string): Promise<void> {
  const database = await db();
  await database.delete(store, id);
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
