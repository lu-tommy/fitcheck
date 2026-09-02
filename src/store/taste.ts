'use client';

import { create } from 'zustand';

import { put, putMany, readAll, remove } from '@/db';
import { nowIso, todayKey } from '@/lib/date';
import { createId } from '@/lib/id';
import type { SignalKind, StyleSignal } from '@/types';

/**
 * The record of what somebody actually chose.
 *
 * Writes are fire-and-forget on purpose: recording a preference must never be
 * able to make a tap feel slow, and losing one to a closed tab costs nothing
 * that the next tap will not replace. Nothing in the app reads a signal
 * synchronously.
 */
interface TasteState {
  signals: StyleSignal[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** One decision. `against` is the other side of a swap, when there was one. */
  record: (itemId: string, kind: SignalKind, against?: string) => Promise<void>;
  /** A whole outfit going out of the door. */
  recordWorn: (itemIds: string[]) => Promise<void>;
  /** Unlearn everything about one piece — what "that's wrong" does. */
  forgetItem: (itemId: string) => Promise<void>;
  /** Unlearn the lot. */
  forgetAll: () => Promise<void>;
}

function signal(itemId: string, kind: SignalKind, against?: string): StyleSignal {
  const stamp = nowIso();
  return {
    id: createId('sig'),
    itemId,
    kind,
    againstItemId: against,
    date: todayKey(),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export const useTaste = create<TasteState>((set, get) => ({
  signals: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const signals = await readAll('signals');
    set({ signals, hydrated: true });
  },

  record: async (itemId, kind, against) => {
    const entry = signal(itemId, kind, against);
    set((state) => ({ signals: [...state.signals, entry] }));
    await put('signals', entry);
  },

  recordWorn: async (itemIds) => {
    if (!itemIds.length) return;
    const entries = itemIds.map((id) => signal(id, 'worn'));
    set((state) => ({ signals: [...state.signals, ...entries] }));
    await putMany('signals', entries);
  },

  forgetItem: async (itemId) => {
    const doomed = get().signals.filter((entry) => entry.itemId === itemId);
    set((state) => ({ signals: state.signals.filter((entry) => entry.itemId !== itemId) }));
    // Through `remove`, so the deletion leaves a tombstone and does not come
    // back on the next sync from another device.
    await Promise.all(doomed.map((entry) => remove('signals', entry.id)));
  },

  forgetAll: async () => {
    const doomed = get().signals;
    set({ signals: [] });
    await Promise.all(doomed.map((entry) => remove('signals', entry.id)));
  },
}));
