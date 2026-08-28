'use client';

import { create } from 'zustand';

import { readMeta, writeMeta } from '@/db';
import { askStylist, type AiSource } from '@/lib/ai';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/date';
import type { ClothingItem, StylistMessage } from '@/types';

interface StylistState {
  thread: StylistMessage[];
  pending: boolean;
  lastSource: AiSource | null;
  hydrate: () => Promise<void>;
  ask: (question: string, closet: ClothingItem[], weatherSummary?: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useStylist = create<StylistState>((set, get) => ({
  thread: [],
  pending: false,
  lastSource: null,

  hydrate: async () => {
    const stored = await readMeta('stylist');
    if (stored?.length) set({ thread: stored });
  },

  ask: async (question, closet, weatherSummary) => {
    const trimmed = question.trim();
    if (!trimmed || get().pending) return;

    const asked: StylistMessage = {
      id: createId('msg'),
      role: 'user',
      text: trimmed,
      createdAt: nowIso(),
    };
    const thread = [...get().thread, asked];
    set({ thread, pending: true });

    const result = await askStylist(thread, closet, weatherSummary);
    const reply: StylistMessage = {
      id: createId('msg'),
      role: 'assistant',
      text: result.answer,
      referencedItemIds: result.referencedItemIds,
      createdAt: nowIso(),
    };
    const next = [...thread, reply];
    set({ thread: next, pending: false, lastSource: result.source });
    // Keep the stored thread bounded — this is a chat, not an archive.
    await writeMeta('stylist', next.slice(-40));
  },

  clear: async () => {
    set({ thread: [], lastSource: null });
    await writeMeta('stylist', []);
  },
}));
