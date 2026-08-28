'use client';

import { create } from 'zustand';

import { put, putMany, readAll, remove } from '@/db';
import { createId } from '@/lib/id';
import { nowIso, todayKey } from '@/lib/date';
import type { GeneratedOutfit, Outfit, WearLog } from '@/types';

import { useCloset } from './closet';

export type NewOutfit = Omit<
  Outfit,
  'id' | 'createdAt' | 'updatedAt' | 'timesWorn' | 'favorite'
> &
  Partial<Pick<Outfit, 'favorite' | 'timesWorn'>>;

interface OutfitState {
  outfits: Outfit[];
  wearLogs: WearLog[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveOutfit: (draft: NewOutfit) => Promise<Outfit>;
  saveGenerated: (
    generated: GeneratedOutfit,
    context: { occasion?: string; weatherContext?: string },
  ) => Promise<Outfit>;
  updateOutfit: (id: string, patch: Partial<Outfit>) => Promise<void>;
  deleteOutfit: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<Outfit | undefined>;
  /** Log an outfit as worn today: bumps the outfit, its items, and history. */
  wearOutfit: (id: string, options?: { date?: string; note?: string }) => Promise<void>;
  wearItems: (itemIds: string[], options?: { date?: string; occasion?: string }) => Promise<void>;
  deleteWearLog: (id: string) => Promise<void>;
  /** Undo a logged wear completely — the log, the counts and the laundry. */
  undoWear: (logId: string) => Promise<void>;
  /** What was worn on a given day, most recent first. */
  wornOn: (date: string) => WearLog[];
  byId: (id: string) => Outfit | undefined;
}

export const useOutfits = create<OutfitState>((set, get) => ({
  outfits: [],
  wearLogs: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const [outfits, wearLogs] = await Promise.all([readAll('outfits'), readAll('wearLogs')]);
    outfits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    wearLogs.sort((a, b) => b.date.localeCompare(a.date));
    set({ outfits, wearLogs, hydrated: true });
  },

  saveOutfit: async (draft) => {
    const stamp = nowIso();
    const outfit: Outfit = {
      favorite: false,
      timesWorn: 0,
      ...draft,
      id: createId('fit'),
      createdAt: stamp,
      updatedAt: stamp,
    };
    await put('outfits', outfit);
    set((state) => ({ outfits: [outfit, ...state.outfits] }));
    return outfit;
  },

  saveGenerated: async (generated, context) =>
    get().saveOutfit({
      name: generated.name,
      itemIds: generated.itemIds,
      occasion: context.occasion,
      explanation: generated.explanation,
      colorNotes: generated.colorNotes,
      weatherContext: context.weatherContext,
      source: 'ai',
    }),

  updateOutfit: async (id, patch) => {
    const current = get().outfits.find((outfit) => outfit.id === id);
    if (!current) return;
    const next: Outfit = { ...current, ...patch, id, updatedAt: nowIso() };
    await put('outfits', next);
    set((state) => ({ outfits: state.outfits.map((o) => (o.id === id ? next : o)) }));
  },

  deleteOutfit: async (id) => {
    await remove('outfits', id);
    set((state) => ({ outfits: state.outfits.filter((outfit) => outfit.id !== id) }));
  },

  toggleFavorite: async (id) => {
    const outfit = get().outfits.find((entry) => entry.id === id);
    if (!outfit) return;
    await get().updateOutfit(id, { favorite: !outfit.favorite });
  },

  duplicate: async (id) => {
    const outfit = get().outfits.find((entry) => entry.id === id);
    if (!outfit) return undefined;
    return get().saveOutfit({
      name: `${outfit.name} copy`,
      itemIds: [...outfit.itemIds],
      occasion: outfit.occasion,
      notes: outfit.notes,
      explanation: outfit.explanation,
      colorNotes: outfit.colorNotes,
      weatherContext: outfit.weatherContext,
      source: 'manual',
    });
  },

  wearOutfit: async (id, options) => {
    const outfit = get().outfits.find((entry) => entry.id === id);
    if (!outfit) return;
    const date = options?.date ?? todayKey();
    const stamp = nowIso();
    const log: WearLog = {
      id: createId('wear'),
      outfitId: outfit.id,
      itemIds: [...outfit.itemIds],
      date,
      occasion: outfit.occasion,
      note: options?.note,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await put('wearLogs', log);
    await get().updateOutfit(id, { timesWorn: outfit.timesWorn + 1, lastWornAt: nowIso() });
    await useCloset.getState().markWorn(outfit.itemIds);
    set((state) => ({ wearLogs: [log, ...state.wearLogs] }));
  },

  wearItems: async (itemIds, options) => {
    if (!itemIds.length) return;
    const stamp = nowIso();
    const log: WearLog = {
      id: createId('wear'),
      itemIds: [...itemIds],
      date: options?.date ?? todayKey(),
      occasion: options?.occasion,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await put('wearLogs', log);
    await useCloset.getState().markWorn(itemIds);
    set((state) => ({ wearLogs: [log, ...state.wearLogs] }));
  },

  deleteWearLog: async (id) => {
    await remove('wearLogs', id);
    set((state) => ({ wearLogs: state.wearLogs.filter((log) => log.id !== id) }));
  },

  undoWear: async (logId) => {
    const log = get().wearLogs.find((entry) => entry.id === logId);
    if (!log) return;

    if (log.outfitId) {
      const outfit = get().outfits.find((entry) => entry.id === log.outfitId);
      if (outfit) {
        await get().updateOutfit(outfit.id, {
          timesWorn: Math.max(0, outfit.timesWorn - 1),
        });
      }
    }
    await useCloset.getState().undoWorn(log.itemIds);
    await remove('wearLogs', logId);
    set((state) => ({ wearLogs: state.wearLogs.filter((entry) => entry.id !== logId) }));
  },

  wornOn: (date) => get().wearLogs.filter((log) => log.date === date),

  byId: (id) => get().outfits.find((outfit) => outfit.id === id),
}));

/** Re-exported so screens can persist reordered outfits in one call. */
export async function persistOutfits(outfits: Outfit[]): Promise<void> {
  await putMany('outfits', outfits);
}
