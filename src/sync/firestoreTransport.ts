'use client';

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore';
import { getBlob, listAll, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';

import type { StoredPhoto } from '@/db/schema';
import type { SyncedStore, Tombstone } from '@/types';

import { firestore, storage } from './firebase';
import type { SyncRecord } from './merge';
import type { SyncTransport } from './transport';

/**
 * The Firestore and Cloud Storage adapter.
 *
 * Deliberately thin: everything that decides what happens to someone's data
 * lives in the engine and the merge rules, which are tested. This file only
 * knows how to move bytes.
 */

/** Firestore rejects `undefined`; optional fields have to be dropped instead. */
function clean(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function millisOf(value: unknown): number {
  const stamp = (value as Timestamp | undefined)?.toMillis?.();
  return typeof stamp === 'number' ? stamp : 0;
}

/** Firestore caps a batch at 500 writes; a tombstone costs two. */
function chunked<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

export function firestoreTransport(userId: string): SyncTransport {
  const store: Firestore = firestore();
  const bucket: FirebaseStorage = storage();
  const records = collection(store, 'wardrobes', userId, 'records');
  const deletions = collection(store, 'wardrobes', userId, 'deletions');
  const photoPath = (id: string) => `wardrobes/${userId}/photos/${id}`;

  return {
    async fetchRecords(name, since) {
      const q = since
        ? query(records, where('__store', '==', name), where('__syncedAt', '>', new Date(since)))
        : query(records, where('__store', '==', name));

      const snapshot = await getDocs(q);
      const out: SyncRecord[] = [];
      let newestStamp = since;

      snapshot.forEach((document) => {
        const data = document.data() as Record<string, unknown>;
        newestStamp = Math.max(newestStamp, millisOf(data.__syncedAt));
        delete data.__store;
        delete data.__syncedAt;
        out.push(data as unknown as SyncRecord);
      });

      return { records: out, newestStamp };
    },

    async fetchTombstones(since) {
      const q = since ? query(deletions, where('__syncedAt', '>', new Date(since))) : query(deletions);
      const snapshot = await getDocs(q);
      const out: Tombstone[] = [];
      let newestStamp = since;

      snapshot.forEach((document) => {
        const data = document.data() as Record<string, unknown>;
        newestStamp = Math.max(newestStamp, millisOf(data.__syncedAt));
        delete data.__syncedAt;
        out.push(data as unknown as Tombstone);
      });

      return { tombstones: out, newestStamp };
    },

    async pushRecords(name, toPush) {
      for (const group of chunked(toPush, 400)) {
        const batch = writeBatch(store);
        group.forEach((record) => {
          batch.set(doc(records, `${name}__${record.id}`), {
            ...clean(record as unknown as Record<string, unknown>),
            __store: name,
            __syncedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    },

    async pushTombstones(tombstones) {
      for (const group of chunked(tombstones, 200)) {
        const batch = writeBatch(store);
        group.forEach((tombstone) => {
          batch.set(doc(deletions, tombstone.id.replace(/\//g, '_')), {
            ...tombstone,
            __syncedAt: serverTimestamp(),
          });
          // Remove the record itself, so a fresh device never downloads it.
          batch.delete(doc(records, `${tombstone.store}__${tombstone.recordId}`));
        });
        await batch.commit();
      }
    },

    async listPhotoIds() {
      try {
        const listing = await listAll(ref(bucket, `wardrobes/${userId}/photos`));
        return listing.items.map((item) => item.name);
      } catch {
        // An empty or unreadable folder means "nothing up there yet", which is
        // the right answer on a first sync.
        return [];
      }
    },

    async uploadPhoto(id, photo) {
      await uploadBytes(ref(bucket, photoPath(id)), photo.blob, {
        contentType: photo.blob.type || 'image/jpeg',
        customMetadata: { width: String(photo.width), height: String(photo.height) },
      });
    },

    async downloadPhoto(id) {
      try {
        return await getBlob(ref(bucket, photoPath(id)));
      } catch {
        return null;
      }
    },
  };
}
