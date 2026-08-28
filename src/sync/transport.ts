import type { StoredPhoto } from '@/db/schema';
import type { SyncRecord } from './merge';
import type { SyncedStore, Tombstone } from '@/types';

/**
 * Everything the engine needs from a server, and nothing else.
 *
 * Pulling this out of the engine is what makes sync testable: the Firestore
 * implementation is a thin adapter, and the same engine can be driven against
 * an in-memory server to prove that two devices converge, that a deletion does
 * not come back, and that an interrupted run leaves nothing broken.
 */
export interface SyncTransport {
  /**
   * Who the server believes is signed in.
   *
   * The engine trusts this over anything the client thinks, because the client
   * can be wrong: a cached identity from a previous session, a cookie that has
   * since changed. Getting this wrong once uploaded one person's wardrobe into
   * another person's account, so identity is now established at the source.
   */
  identify(): Promise<string>;

  /** Records changed after `since` (a server-side cursor, in milliseconds). */
  fetchRecords(
    store: SyncedStore,
    since: number,
  ): Promise<{ records: SyncRecord[]; newestStamp: number }>;

  fetchTombstones(since: number): Promise<{ tombstones: Tombstone[]; newestStamp: number }>;

  pushRecords(store: SyncedStore, records: SyncRecord[]): Promise<void>;

  /** Records the deletions and removes the underlying documents. */
  pushTombstones(tombstones: Tombstone[]): Promise<void>;

  listPhotoIds(): Promise<string[]>;

  uploadPhoto(id: string, photo: StoredPhoto): Promise<void>;

  /** `null` when the file is missing — a hole in a picture, not a failure. */
  downloadPhoto(id: string): Promise<Blob | null>;
}
