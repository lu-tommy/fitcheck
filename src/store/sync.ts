'use client';

import { create } from 'zustand';

import { onExternalChange, readAll } from '@/db';
import { runSync, readSyncState, type SyncMode, type SyncReport } from '@/sync/engine';
import { firebaseReady } from '@/sync/firebase';
import { firestoreTransport } from '@/sync/firestoreTransport';

import { useCloset } from './closet';
import { useOutfits } from './outfits';
import { usePlanner } from './planner';
import { useWishlist } from './wishlist';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'offline';

interface SyncStore {
  status: SyncStatus;
  lastSyncedAt: string | null;
  lastReport: SyncReport | null;
  error: string | null;
  /**
   * Set when this device already holds a wardrobe belonging to a different
   * account. Until it is resolved nothing local is uploaded, so one person's
   * clothes can never end up in another person's account.
   */
  foreignWardrobe: boolean;
  sync: (userId: string, mode?: SyncMode) => Promise<void>;
  adoptLocalWardrobe: (userId: string) => Promise<void>;
  reset: () => void;
}

/** Re-read every store from IndexedDB after data arrives from elsewhere. */
export async function refreshFromDatabase(): Promise<void> {
  const [items, outfits, wearLogs, calendar, packing, wishlist] = await Promise.all([
    readAll('items'),
    readAll('outfits'),
    readAll('wearLogs'),
    readAll('calendar'),
    readAll('packing'),
    readAll('wishlist'),
  ]);

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  outfits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  wearLogs.sort((a, b) => b.date.localeCompare(a.date));
  packing.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  wishlist.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  useCloset.setState({ items, hydrated: true });
  useOutfits.setState({ outfits, wearLogs, hydrated: true });
  usePlanner.setState({ calendar, packingLists: packing, hydrated: true });
  useWishlist.setState({ items: wishlist, hydrated: true });
}

let running: Promise<void> | null = null;

export const useSync = create<SyncStore>((set, get) => ({
  status: firebaseReady() ? 'idle' : 'off',
  lastSyncedAt: null,
  lastReport: null,
  error: null,
  foreignWardrobe: false,

  sync: async (userId, mode) => {
    if (!firebaseReady()) return;
    // One at a time. Two concurrent runs would fight over the same cursor.
    if (running) return running;

    running = (async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        set({ status: 'offline' });
        return;
      }

      set({ status: 'syncing', error: null });
      try {
        const state = await readSyncState();
        const foreign = Boolean(state.userId && state.userId !== userId);
        const chosen: SyncMode = mode ?? (foreign ? 'pull-only' : 'merge');

        const report = await runSync(userId, firestoreTransport(userId), chosen);
        await refreshFromDatabase();

        set({
          status: 'idle',
          lastSyncedAt: new Date().toISOString(),
          lastReport: report,
          error: null,
          foreignWardrobe: foreign && chosen === 'pull-only',
        });
      } catch (error) {
        const message = (error as Error)?.message ?? 'Sync failed';
        // A failed sync is never data loss: the local copy is untouched and the
        // next run picks up exactly where this one stopped.
        set({ status: 'error', error: message });
      } finally {
        running = null;
      }
    })();

    return running;
  },

  /** Merge this device's existing wardrobe into the account that is signed in. */
  adoptLocalWardrobe: async (userId) => {
    set({ foreignWardrobe: false });
    await get().sync(userId, 'merge');
  },

  reset: () => set({ status: firebaseReady() ? 'idle' : 'off', error: null, lastReport: null }),
}));

/** Other tabs write to the same database; keep this one honest about it. */
export function watchForExternalChanges(): () => void {
  return onExternalChange(() => {
    void refreshFromDatabase();
  });
}
