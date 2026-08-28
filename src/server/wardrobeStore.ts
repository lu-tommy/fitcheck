import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { SyncedStore, Tombstone } from '@/types';

/**
 * Where a wardrobe actually lives on the NAS.
 *
 * One JSON file per person plus a folder of photos. For a household this beats
 * a database on every axis that matters: you can read it, copy it, and restore
 * it with `cp`, and whatever already backs up the NAS backs this up too.
 *
 * Every write goes to a temporary file and is then renamed over the real one.
 * Rename is atomic on the same filesystem, so a power cut can leave the old
 * file or the new one — never a half-written one.
 */

export interface StoredRecord {
  id: string;
  store: SyncedStore;
  /** Monotonic per-user counter; the sync cursor is compared against this. */
  stamp: number;
  data: Record<string, unknown>;
}

export interface StoredTombstone {
  id: string;
  stamp: number;
  tombstone: Tombstone;
}

interface Wardrobe {
  version: 1;
  nextStamp: number;
  records: Record<string, StoredRecord>;
  tombstones: Record<string, StoredTombstone>;
}

const EMPTY: Wardrobe = { version: 1, nextStamp: 1, records: {}, tombstones: {} };

function root(): string {
  return process.env.OUTFITAI_DATA_DIR ?? path.join(process.cwd(), 'data');
}

/** Ids come from a signed session, but a path separator would still escape. */
function safeId(userId: string): string {
  if (!/^[a-z0-9_-]{1,64}$/i.test(userId)) throw new Error('Invalid user id');
  return userId.toLowerCase();
}

const userDir = (userId: string) => path.join(root(), 'users', safeId(userId));
const wardrobeFile = (userId: string) => path.join(userDir(userId), 'wardrobe.json');
const photoDir = (userId: string) => path.join(userDir(userId), 'photos');

async function atomicWrite(file: string, contents: Buffer | string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, file);
}

/*
 * Node serves requests concurrently, so two syncs from two devices could read,
 * modify and write the same file at once and lose one of them. Every mutation
 * for a user queues behind the last, which is enough for a household.
 */
const queues = new Map<string, Promise<unknown>>();

function withLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(userId) ?? Promise.resolve();
  const next = previous.then(work, work);
  queues.set(
    userId,
    next.catch(() => undefined),
  );
  return next;
}

async function read(userId: string): Promise<Wardrobe> {
  const file = wardrobeFile(userId);
  if (!existsSync(file)) return structuredClone(EMPTY);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Wardrobe;
  } catch (error) {
    // A corrupt file must never look like an empty wardrobe: that would sync
    // "everything deleted" to every device. Refuse loudly instead.
    throw new Error(
      `The wardrobe file for ${userId} could not be read (${(error as Error).message}). ` +
        'Nothing has been changed. Restore it from a backup.',
    );
  }
}

export async function pull(
  userId: string,
  since: number,
): Promise<{ records: StoredRecord[]; tombstones: StoredTombstone[]; newestStamp: number }> {
  const wardrobe = await read(userId);
  const records = Object.values(wardrobe.records).filter((entry) => entry.stamp > since);
  const tombstones = Object.values(wardrobe.tombstones).filter((entry) => entry.stamp > since);
  const newestStamp = Math.max(
    since,
    ...records.map((entry) => entry.stamp),
    ...tombstones.map((entry) => entry.stamp),
  );
  return { records, tombstones, newestStamp };
}

export async function push(
  userId: string,
  input: { records?: { store: SyncedStore; data: Record<string, unknown> }[]; tombstones?: Tombstone[] },
): Promise<{ newestStamp: number }> {
  return withLock(userId, async () => {
    const wardrobe = await read(userId);

    (input.records ?? []).forEach((entry) => {
      const id = String(entry.data.id ?? '');
      if (!id) return;
      const key = `${entry.store}__${id}`;
      wardrobe.records[key] = {
        id,
        store: entry.store,
        stamp: wardrobe.nextStamp++,
        data: entry.data,
      };
    });

    (input.tombstones ?? []).forEach((tombstone) => {
      wardrobe.tombstones[tombstone.id] = {
        id: tombstone.id,
        stamp: wardrobe.nextStamp++,
        tombstone,
      };
      delete wardrobe.records[`${tombstone.store}__${tombstone.recordId}`];
    });

    await atomicWrite(wardrobeFile(userId), JSON.stringify(wardrobe));
    return { newestStamp: wardrobe.nextStamp - 1 };
  });
}

/* ------------------------------------------------------------------ photos -- */

const PHOTO_ID = /^[a-z0-9_-]{1,80}$/i;

export async function listPhotos(userId: string): Promise<string[]> {
  const directory = photoDir(userId);
  if (!existsSync(directory)) return [];
  return (await readdir(directory)).filter((name) => PHOTO_ID.test(name));
}

export async function readPhoto(userId: string, photoId: string): Promise<Buffer | null> {
  if (!PHOTO_ID.test(photoId)) return null;
  const file = path.join(photoDir(userId), photoId);
  if (!existsSync(file)) return null;
  return readFile(file);
}

export async function writePhoto(
  userId: string,
  photoId: string,
  bytes: Buffer,
): Promise<void> {
  if (!PHOTO_ID.test(photoId)) throw new Error('Invalid photo id');
  await atomicWrite(path.join(photoDir(userId), photoId), bytes);
}

export async function deletePhoto(userId: string, photoId: string): Promise<void> {
  if (!PHOTO_ID.test(photoId)) return;
  const file = path.join(photoDir(userId), photoId);
  if (existsSync(file)) await unlink(file);
}

/** For the Profile screen: how much of the NAS this wardrobe is using. */
export async function usage(userId: string): Promise<{ records: number; photos: number }> {
  const wardrobe = await read(userId);
  return {
    records: Object.keys(wardrobe.records).length,
    photos: (await listPhotos(userId)).length,
  };
}
