'use client';

import { create } from 'zustand';

import { clearAll, onExternalChange, readAll } from '@/db';
import { IdentityMismatch, runSync, type SyncMode, type SyncReport } from '@/sync/engine';
import { httpTransport, NotSignedIn } from '@/sync/httpTransport';

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
  /** Clear the other account's wardrobe off this device and start fresh. */
  discardForeignWardrobe: (userId: string) => Promise<void>;
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
  status: 'idle',
  lastSyncedAt: null,
  lastReport: null,
  error: null,
  foreignWardrobe: false,

  sync: async (userId, mode) => {
    // One at a time. Two concurrent runs would fight over the same cursor.
    if (running) return running;

    running = (async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        set({ status: 'offline' });
        return;
      }

      set({ status: 'syncing', error: null });
      try {
        // The engine decides whether local data may be uploaded — it is the only
        // place that can see the sticky flag, and it must not be second-guessed.
        const report = await runSync(userId, httpTransport(), mode ?? 'auto');
        await refreshFromDatabase();

        set({
          status: 'idle',
          lastSyncedAt: new Date().toISOString(),
          lastReport: report,
          error: null,
          foreignWardrobe: report.heldBackLocalData,
        });
      } catch (error) {
        if (error instanceof IdentityMismatch) {
          // Somebody else is signed in on this device. Stop rather than write
          // one person's wardrobe into another person's account.
          set({
            status: 'error',
            error: 'Signed in as somebody else. Reload the app to continue.',
          });
          return;
        }
        if (error instanceof NotSignedIn) {
          // The session expired. Say so plainly rather than reporting a failure
          // the user cannot act on.
          set({ status: 'error', error: 'Signed out. Sign in again to keep backing up.' });
          return;
        }
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
    await get().sync(userId, 'adopt');
  },

  /**
   * The other option, and usually the right one on a shared tablet: wipe what
   * is on this device and download the signed-in account instead. Safe because
   * the wardrobe being cleared is already backed up under its own account.
   */
  discardForeignWardrobe: async (userId) => {
    await clearAll();
    await refreshFromDatabase();
    set({ foreignWardrobe: false });
    await get().sync(userId);
  },

  reset: () => set({ status: 'idle', error: null, lastReport: null }),
}));

/** Other tabs write to the same database; keep this one honest about it. */
export function watchForExternalChanges(): () => void {
  return onExternalChange(() => {
    void refreshFromDatabase();
  });
}
