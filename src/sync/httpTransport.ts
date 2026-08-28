'use client';

import type { StoredPhoto } from '@/db/schema';
import type { SyncedStore, Tombstone } from '@/types';

import type { SyncRecord } from './merge';
import type { SyncTransport } from './transport';

/**
 * Talking to the wardrobe server.
 *
 * Deliberately thin: everything that decides what happens to someone's data
 * lives in the engine and the merge rules, which are tested. This only moves
 * bytes, over the same origin, with the session cookie the browser already
 * holds.
 */

interface PullResponse {
  userId: string;
  records: { id: string; store: SyncedStore; stamp: number; data: Record<string, unknown> }[];
  tombstones: { id: string; stamp: number; tombstone: Tombstone }[];
  newestStamp: number;
}

export class NotSignedIn extends Error {
  constructor() {
    super('Signed out');
    this.name = 'NotSignedIn';
  }
}

async function expectOk(response: Response): Promise<Response> {
  if (response.status === 401) throw new NotSignedIn();
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(
      (detail as { message?: string }).message ?? `The server returned ${response.status}`,
    );
  }
  return response;
}

export function httpTransport(): SyncTransport {
  /*
   * One pull serves every collection. The engine asks per store, so the first
   * call fetches and the rest read from this snapshot — otherwise a sync would
   * make six identical round trips.
   */
  let snapshot: { since: number; data: PullResponse } | null = null;

  async function load(since: number): Promise<PullResponse> {
    if (snapshot && snapshot.since === since) return snapshot.data;
    const response = await expectOk(
      await fetch(`/api/sync/pull?since=${since}`, { credentials: 'same-origin' }),
    );
    const data = (await response.json()) as PullResponse;
    snapshot = { since, data };
    return data;
  }

  return {
    async identify() {
      const data = await load(0);
      if (!data.userId) throw new NotSignedIn();
      return data.userId;
    },

    async fetchTombstones(since) {
      const data = await load(since);
      return {
        tombstones: data.tombstones.map((entry) => entry.tombstone),
        newestStamp: data.newestStamp,
      };
    },

    async fetchRecords(store, since) {
      const data = await load(since);
      return {
        records: data.records
          .filter((entry) => entry.store === store)
          .map((entry) => entry.data as unknown as SyncRecord),
        newestStamp: data.newestStamp,
      };
    },

    async pushRecords(store, records) {
      if (!records.length) return;
      await expectOk(
        await fetch('/api/sync/push', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            records: records.map((record) => ({ store, data: record })),
          }),
        }),
      );
      // The server assigned new stamps, so the cached snapshot is stale.
      snapshot = null;
    },

    async pushTombstones(tombstones) {
      if (!tombstones.length) return;
      await expectOk(
        await fetch('/api/sync/push', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tombstones }),
        }),
      );
      snapshot = null;
    },

    async listPhotoIds() {
      const response = await expectOk(
        await fetch('/api/sync/photos', { credentials: 'same-origin' }),
      );
      return ((await response.json()) as { ids: string[] }).ids;
    },

    async uploadPhoto(id: string, photo: StoredPhoto) {
      await expectOk(
        await fetch(`/api/sync/photos/${encodeURIComponent(id)}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'content-type': photo.blob.type || 'image/jpeg' },
          body: photo.blob,
        }),
      );
    },

    async downloadPhoto(id: string) {
      const response = await fetch(`/api/sync/photos/${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
      });
      if (response.status === 401) throw new NotSignedIn();
      if (!response.ok) return null;
      return response.blob();
    },
  };
}
