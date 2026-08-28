'use client';

import { create } from 'zustand';

import { put, readAll, remove } from '@/db';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/date';
import type { CalendarEntry, PackingList } from '@/types';

interface PlannerState {
  calendar: CalendarEntry[];
  packingLists: PackingList[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** One outfit per date: assigning again replaces what was there. */
  assign: (date: string, outfitId: string, label?: string) => Promise<void>;
  unassign: (date: string) => Promise<void>;
  entryFor: (date: string) => CalendarEntry | undefined;
  savePackingList: (list: Omit<PackingList, 'id' | 'createdAt' | 'packedItemIds'>) => Promise<PackingList>;
  togglePacked: (listId: string, itemId: string) => Promise<void>;
  deletePackingList: (id: string) => Promise<void>;
  packingById: (id: string) => PackingList | undefined;
}

export const usePlanner = create<PlannerState>((set, get) => ({
  calendar: [],
  packingLists: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const [calendar, packingLists] = await Promise.all([readAll('calendar'), readAll('packing')]);
    packingLists.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ calendar, packingLists, hydrated: true });
  },

  assign: async (date, outfitId, label) => {
    const existing = get().calendar.find((entry) => entry.date === date);
    if (existing) await remove('calendar', existing.id);
    const entry: CalendarEntry = {
      id: createId('cal'),
      date,
      outfitId,
      label,
      createdAt: nowIso(),
    };
    await put('calendar', entry);
    set((state) => ({
      calendar: [...state.calendar.filter((item) => item.date !== date), entry],
    }));
  },

  unassign: async (date) => {
    const existing = get().calendar.find((entry) => entry.date === date);
    if (!existing) return;
    await remove('calendar', existing.id);
    set((state) => ({ calendar: state.calendar.filter((entry) => entry.date !== date) }));
  },

  entryFor: (date) => get().calendar.find((entry) => entry.date === date),

  savePackingList: async (draft) => {
    const list: PackingList = {
      ...draft,
      id: createId('pack'),
      packedItemIds: [],
      createdAt: nowIso(),
    };
    await put('packing', list);
    set((state) => ({ packingLists: [list, ...state.packingLists] }));
    return list;
  },

  togglePacked: async (listId, itemId) => {
    const list = get().packingLists.find((entry) => entry.id === listId);
    if (!list) return;
    const packed = list.packedItemIds.includes(itemId)
      ? list.packedItemIds.filter((id) => id !== itemId)
      : [...list.packedItemIds, itemId];
    const next = { ...list, packedItemIds: packed };
    await put('packing', next);
    set((state) => ({
      packingLists: state.packingLists.map((entry) => (entry.id === listId ? next : entry)),
    }));
  },

  deletePackingList: async (id) => {
    await remove('packing', id);
    set((state) => ({ packingLists: state.packingLists.filter((list) => list.id !== id) }));
  },

  packingById: (id) => get().packingLists.find((list) => list.id === id),
}));
