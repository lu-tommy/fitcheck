import {
  db,
  listPhotoIds,
  putMany,
  putPhoto,
  putTombstone,
  pruneTombstones,
  readAll,
  readMeta,
  readTombstones,
  removeSilently,
  writeMeta,
} from '@/db';
import type { StoredPhoto } from '@/db/schema';
import { nowIso } from '@/lib/date';
import type { SyncState, SyncedStore } from '@/types';

import { mergeCollection, planPhotoSync, type SyncRecord } from './merge';
import type { SyncTransport } from './transport';

/**
 * Reconciling a wardrobe with the cloud.
 *
 * The local database stays the source of truth: every screen reads IndexedDB,
 * so the app is instant and works with no signal whether or not anyone is
 * signed in. This engine moves changes in both directions using the pure rules
 * in ./merge, over whatever transport it is handed.
 *
 * Three properties it has to hold, because losing someone's clothes is not a
 * recoverable error:
 *
 *  - It never removes local data except when a strictly newer deletion says to.
 *  - It is safe to interrupt. There is no two-phase commit anywhere; a run that
 *    dies halfway leaves both sides internally consistent and the next run
 *    finishes the job.
 *  - It is idempotent. Running it again changes nothing.
 */

export const SYNCED_STORES: SyncedStore[] = [
  'items',
  'outfits',
  'wearLogs',
  'calendar',
  'packing',
  'wishlist',
  'signals',
];

export type SyncMode =
  /**
   * The normal path. Changes go both ways, unless this device is known to hold
   * another account's wardrobe — in which case nothing local is uploaded.
   */
  | 'auto'
  /**
   * Deliberately claim the wardrobe on this device for the account that is
   * signed in. Only ever reached from a button the person pressed.
   */
  | 'adopt';

export interface SyncReport {
  /** True when local data was held back because it belongs to another account. */
  heldBackLocalData: boolean;
  pulled: number;
  pushed: number;
  deletedLocally: number;
  photosUploaded: number;
  photosDownloaded: number;
  ms: number;
}

const EMPTY_STATE: SyncState = { uploadedPhotoIds: [] };

export async function readSyncState(): Promise<SyncState> {
  return (await readMeta('sync')) ?? EMPTY_STATE;
}

/** Thrown when the caller and the server disagree about who is signed in. */
export class IdentityMismatch extends Error {
  constructor(readonly expected: string, readonly actual: string) {
    super(`Signed in as ${actual}, not ${expected}`);
    this.name = 'IdentityMismatch';
  }
}

export async function runSync(
  expectedUserId: string,
  transport: SyncTransport,
  mode: SyncMode = 'auto',
): Promise<SyncReport> {
  const started = Date.now();

  /*
   * Establish identity at the server before touching anything. The caller's
   * idea of who is signed in comes from a cache that can be stale, and acting
   * on a stale one is how one person's wardrobe ends up in another person's
   * account. Everything below uses the server's answer.
   */
  const userId = await transport.identify();
  if (userId !== expectedUserId) throw new IdentityMismatch(expectedUserId, userId);
  const report: SyncReport = {
    heldBackLocalData: false,
    pulled: 0,
    pushed: 0,
    deletedLocally: 0,
    photosUploaded: 0,
    photosDownloaded: 0,
    ms: 0,
  };

  const state = await readSyncState();

  /*
   * Is this device carrying somebody else's clothes? True if the last sync was
   * for another account, or if a previous run already found that and said so.
   * The second half matters: a pull-only run records the new account id, so
   * without the sticky flag the very next run would see matching ids, decide
   * everything local belongs to this account, and upload it.
   */
  const differentAccount =
    Boolean(state.userId && state.userId !== userId) || Boolean(state.foreignWardrobe);
  const holdBackLocalData = differentAccount && mode !== 'adopt';

  // Another account's cursor means nothing here; re-read from the beginning.
  const since = differentAccount ? 0 : (state.lastPulledAt ?? 0);

  const localTombstones = await readTombstones();
  const remote = await transport.fetchTombstones(since);
  let newestStamp = Math.max(since, remote.newestStamp);

  for (const name of SYNCED_STORES) {
    const local = (await readAll(name)) as unknown as SyncRecord[];
    const fetched = await transport.fetchRecords(name, since);
    newestStamp = Math.max(newestStamp, fetched.newestStamp);

    const plan = mergeCollection<SyncRecord>({
      store: name,
      local,
      remote: fetched.records,
      localTombstones,
      remoteTombstones: remote.tombstones,
    });

    if (holdBackLocalData) {
      // Nothing local may leave this device: it belongs to another account.
      // Local deletions are held back too — they were somebody else's decision.
      plan.push.length = 0;
      plan.pushTombstones.length = 0;
      plan.deleteLocal.length = 0;
    }

    /*
     * Order matters. Incoming data is written before anything is removed, so an
     * interruption can only ever leave extra records behind — never a gap.
     */
    if (plan.writeLocal.length) {
      await putMany(name, plan.writeLocal as never[]);
      report.pulled += plan.writeLocal.length;
    }

    for (const tombstone of plan.adoptTombstones) {
      await putTombstone(tombstone);
    }

    if (plan.push.length) {
      await transport.pushRecords(name, plan.push);
      report.pushed += plan.push.length;
    }

    if (plan.pushTombstones.length) {
      await transport.pushTombstones(plan.pushTombstones);
    }

    for (const id of plan.deleteLocal) {
      await removeSilently(name, id);
      report.deletedLocally += 1;
    }
  }

  /* ------------------------------------------------------------- photos -- */

  const items = await readAll('items');
  const referencedIds = items
    .flatMap((item) => [item.photoId, item.cutoutId])
    .filter((id): id is string => Boolean(id));
  const localIds = await listPhotoIds();
  const remoteIds = await transport.listPhotoIds();

  const photoPlan = planPhotoSync({ referencedIds, localIds, remoteIds });

  if (!holdBackLocalData) {
    for (const id of photoPlan.upload) {
      const database = await db();
      const photo = await database.get('photos', id);
      if (!photo) continue;
      await transport.uploadPhoto(id, photo);
      report.photosUploaded += 1;
    }
  }

  for (const id of photoPlan.download) {
    const blob = await transport.downloadPhoto(id);
    // A missing file is a hole in one picture, not a reason to fail the sync.
    // The item still arrives, and the next run tries the file again.
    if (!blob) continue;
    // Not every context has createImageBitmap; dimensions are a nicety, and a
    // photo without them still renders.
    const bitmap =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(blob).catch(() => null)
        : null;
    const stored: StoredPhoto = {
      id,
      blob,
      width: bitmap?.width ?? 0,
      height: bitmap?.height ?? 0,
      createdAt: nowIso(),
    };
    bitmap?.close();
    await putPhoto(stored);
    report.photosDownloaded += 1;
  }

  await pruneTombstones();

  /*
   * The cursor is written last, and only after everything above succeeded. A
   * run that throws leaves the old cursor in place, so the next attempt re-reads
   * the same window rather than skipping past changes it never applied.
   */
  await writeMeta('sync', {
    userId,
    lastPulledAt: newestStamp,
    lastPushedAt: nowIso(),
    lastSyncedAt: nowIso(),
    // Adopting resolves it; anything else leaves the warning standing.
    foreignWardrobe: mode === 'adopt' ? false : holdBackLocalData,
    uploadedPhotoIds: [],
  });

  report.heldBackLocalData = holdBackLocalData;
  report.ms = Date.now() - started;
  return report;
}
