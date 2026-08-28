'use client';

import { create } from 'zustand';

import { put, readAll, remove } from '@/db';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/date';
import type { WishlistItem } from '@/types';

interface WishlistState {
  items: WishlistItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (draft: Omit<WishlistItem, 'id' | 'createdAt' | 'purchased'>) => Promise<WishlistItem>;
  update: (id: string, patch: Partial<WishlistItem>) => Promise<void>;
  togglePurchased: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

export const useWishlist = create<WishlistState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const items = await readAll('wishlist');
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ items, hydrated: true });
  },

  add: async (draft) => {
    const item: WishlistItem = {
      ...draft,
      id: createId('wish'),
      purchased: false,
      createdAt: nowIso(),
    };
    await put('wishlist', item);
    set((state) => ({ items: [item, ...state.items] }));
    return item;
  },

  update: async (id, patch) => {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, ...patch, id };
    await put('wishlist', next);
    set((state) => ({ items: state.items.map((item) => (item.id === id ? next : item)) }));
  },

  togglePurchased: async (id) => {
    const item = get().items.find((entry) => entry.id === id);
    if (!item) return;
    await get().update(id, { purchased: !item.purchased });
  },

  removeItem: async (id) => {
    await remove('wishlist', id);
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
}));
