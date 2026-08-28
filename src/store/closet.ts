'use client';

import { useMemo } from 'react';
import { create } from 'zustand';

import { put, putMany, readAll, remove, deletePhoto, forgetPhotoUrl } from '@/db';
import { hexForColorName } from '@/domain/color';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/date';
import type { ClothingItem, LaundryStatus } from '@/types';

/** Everything an item needs at creation time; the rest is filled in here. */
export type NewClothingItem = Omit<
  ClothingItem,
  'id' | 'createdAt' | 'updatedAt' | 'favorite' | 'laundry' | 'wearCount'
> &
  Partial<Pick<ClothingItem, 'favorite' | 'laundry' | 'wearCount'>>;

interface ClosetState {
  items: ClothingItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addItem: (draft: NewClothingItem) => Promise<ClothingItem>;
  addItems: (drafts: NewClothingItem[]) => Promise<ClothingItem[]>;
  updateItem: (id: string, patch: Partial<ClothingItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setLaundry: (id: string, laundry: LaundryStatus) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  /** Called when an outfit is worn: bumps counts and dirties everything in it. */
  markWorn: (itemIds: string[]) => Promise<void>;
  /** Reverse a wear that was logged by mistake. */
  undoWorn: (itemIds: string[]) => Promise<void>;
  washAll: () => Promise<void>;
  byId: (id: string) => ClothingItem | undefined;
  resolve: (ids: string[]) => ClothingItem[];
}

function materialise(draft: NewClothingItem): ClothingItem {
  const timestamp = nowIso();
  return {
    favorite: false,
    laundry: 'clean',
    wearCount: 0,
    ...draft,
    primaryColorHex: draft.primaryColorHex || hexForColorName(draft.primaryColor),
    id: createId('item'),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const useCloset = create<ClosetState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const items = await readAll('items');
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ items, hydrated: true });
  },

  addItem: async (draft) => {
    const [item] = await get().addItems([draft]);
    return item;
  },

  addItems: async (drafts) => {
    const created = drafts.map(materialise);
    await putMany('items', created);
    set((state) => ({ items: [...created, ...state.items] }));
    return created;
  },

  updateItem: async (id, patch) => {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const next: ClothingItem = { ...current, ...patch, id, updatedAt: nowIso() };
    await put('items', next);
    set((state) => ({ items: state.items.map((item) => (item.id === id ? next : item)) }));
  },

  deleteItem: async (id) => {
    const item = get().items.find((entry) => entry.id === id);
    await remove('items', id);
    if (item?.photoId) {
      forgetPhotoUrl(item.photoId);
      await deletePhoto(item.photoId);
    }
    if (item?.cutoutId) {
      forgetPhotoUrl(item.cutoutId);
      await deletePhoto(item.cutoutId);
    }
    set((state) => ({ items: state.items.filter((entry) => entry.id !== id) }));
  },

  toggleFavorite: async (id) => {
    const item = get().items.find((entry) => entry.id === id);
    if (!item) return;
    await get().updateItem(id, { favorite: !item.favorite });
  },

  setLaundry: async (id, laundry) => {
    await get().updateItem(id, { laundry });
  },

  /**
   * Archiving is the honest alternative to deleting. The piece keeps its wear
   * history and its photo, and leaves the closet, the generator and the stats
   * — which is what someone actually wants when they say "I never wear this".
   */
  setArchived: async (id, archived) => {
    await get().updateItem(id, {
      archived,
      archivedAt: archived ? nowIso() : undefined,
    });
  },

  markWorn: async (itemIds) => {
    const stamp = nowIso();
    const updated = get()
      .items.filter((item) => itemIds.includes(item.id))
      .map((item) => ({
        ...item,
        wearCount: item.wearCount + 1,
        lastWornAt: stamp,
        // Accessories do not go in the wash every time they leave the house.
        laundry: needsWashing(item) ? ('dirty' as LaundryStatus) : item.laundry,
        updatedAt: stamp,
      }));
    if (!updated.length) return;
    await putMany('items', updated);
    const patch = new Map(updated.map((item) => [item.id, item]));
    set((state) => ({ items: state.items.map((item) => patch.get(item.id) ?? item) }));
  },

  /**
   * Undo a wear.
   *
   * Deliberately conservative: the count comes back down and anything this
   * would have dirtied goes back to clean, but a piece already in the wash for
   * another reason is left alone. `lastWornAt` is not restored — there is no
   * record of what it was before, and a wrong date is worse than a stale one.
   */
  undoWorn: async (itemIds) => {
    const stamp = nowIso();
    const affected = get()
      .items.filter((item) => itemIds.includes(item.id))
      .map((item) => ({
        ...item,
        wearCount: Math.max(0, item.wearCount - 1),
        laundry:
          needsWashing(item) && item.laundry === 'dirty'
            ? ('clean' as LaundryStatus)
            : item.laundry,
        updatedAt: stamp,
      }));
    if (!affected.length) return;
    await putMany('items', affected);
    const patch = new Map(affected.map((item) => [item.id, item]));
    set((state) => ({ items: state.items.map((item) => patch.get(item.id) ?? item) }));
  },

  washAll: async () => {
    const dirty = get().items.filter((item) => item.laundry !== 'clean');
    if (!dirty.length) return;
    const cleaned = dirty.map((item) => ({ ...item, laundry: 'clean' as const, updatedAt: nowIso() }));
    await putMany('items', cleaned);
    const patch = new Map(cleaned.map((item) => [item.id, item]));
    set((state) => ({ items: state.items.map((item) => patch.get(item.id) ?? item) }));
  },

  byId: (id) => get().items.find((item) => item.id === id),

  resolve: (ids) => {
    const index = new Map(get().items.map((item) => [item.id, item]));
    return ids.map((id) => index.get(id)).filter((item): item is ClothingItem => Boolean(item));
  },
}));

/** Shoes, outerwear and accessories survive a wear; the rest goes in the basket. */
function needsWashing(item: ClothingItem): boolean {
  const exempt = ['sneakers', 'boots', 'dress-shoes', 'loafers', 'sandals', 'watch', 'belt',
    'necklace', 'bracelet', 'ring', 'sunglasses', 'bag', 'hat', 'cap', 'jacket', 'coat',
    'parka', 'blazer'];
  return !exempt.includes(item.category);
}

/**
 * Resolve outfit ids to items.
 *
 * This exists as a hook rather than a selector because zustand v5 compares
 * snapshots by reference: a selector that maps ids to a fresh array on every
 * call re-renders forever. Memoising on the id string fixes that.
 */
export function useResolvedItems(ids: string[] | undefined): ClothingItem[] {
  const items = useCloset((state) => state.items);
  const key = (ids ?? []).join(',');
  return useMemo(() => {
    if (!key) return [];
    const index = new Map(items.map((item) => [item.id, item]));
    return key
      .split(',')
      .map((id) => index.get(id))
      .filter((item): item is ClothingItem => Boolean(item));
  }, [items, key]);
}

/** The wardrobe in circulation: everything except what has been archived. */
export function useActiveItems(): ClothingItem[] {
  const items = useCloset((state) => state.items);
  return useMemo(() => items.filter((item) => !item.archived), [items]);
}
