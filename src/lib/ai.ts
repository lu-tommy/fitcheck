'use client';

import { buildOutfitLocally, type EngineContext } from '@/domain/outfitEngine';
import { buildPackingLocally } from '@/domain/packingEngine';
import { slotOf } from '@/domain/taxonomy';
import type { TaggedItem } from '@/lib/aiSchemas';
import type {
  ClosetDigestItem,
  ClothingItem,
  GeneratedOutfit,
  PackingRequest,
  StylistMessage,
} from '@/types';

/**
 * The client's half of the AI layer.
 *
 * Every entry point returns a result and a `source`, because both paths are
 * first-class: with no key on the server the rule-based engines do the work and
 * the UI simply labels it differently. Nothing here throws on an AI failure —
 * it falls back and reports which path ran.
 */

export type AiSource = 'ai' | 'local';

let statusPromise: Promise<boolean> | null = null;

/** Cached for the tab: whether the server has a key configured. */
export function aiConfigured(): Promise<boolean> {
  if (!statusPromise) {
    statusPromise = fetch('/api/ai/status')
      .then((response) => (response.ok ? response.json() : { configured: false }))
      .then((data: { configured: boolean }) => data.configured)
      .catch(() => false);
  }
  return statusPromise;
}

/** Strip an item down to what the model is allowed to see. */
export function closetDigest(items: ClothingItem[]): ClosetDigestItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    slot: slotOf(item.category),
    primaryColor: item.primaryColor,
    secondaryColors: item.secondaryColors,
    pattern: item.pattern,
    material: item.material,
    brand: item.brand,
    formality: item.formality,
    seasons: item.seasons,
    styles: item.styles,
    favorite: item.favorite,
    wearCount: item.wearCount,
  }));
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- tagging -- */

export async function tagPhoto(blob: Blob, hint?: string): Promise<TaggedItem | null> {
  if (!(await aiConfigured())) return null;
  const mediaType = blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg';
  const imageBase64 = await blobToBase64(blob);
  return postJson<TaggedItem>('/api/ai/tag', { imageBase64, mediaType, hint });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  // Chunked so a multi-megabyte photo does not blow the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/* ------------------------------------------------------- outfit design -- */

export interface OutfitResult {
  outfit: GeneratedOutfit;
  source: AiSource;
}

export async function generateOutfit(context: EngineContext): Promise<OutfitResult> {
  const local = () => ({ outfit: buildOutfitLocally(context), source: 'local' as const });

  if (!(await aiConfigured())) return local();

  const remote = await postJson<GeneratedOutfit>('/api/ai/outfit', {
    request: context.request,
    closet: closetDigest(context.closet),
    weather: context.weather ?? null,
    avoidColors: context.avoidColors,
    preferredStyles: context.preferredStyles,
  });
  if (!remote) return local();

  // The model can still name an id that no longer exists; drop those rather
  // than render an outfit with holes in it.
  const known = new Set(context.closet.map((item) => item.id));
  const itemIds = remote.itemIds.filter((id) => known.has(id));
  if (itemIds.length < 2) return local();

  const warnings = itemIds.length === remote.itemIds.length
    ? undefined
    : ['Some suggested pieces are no longer in your closet and were dropped.'];

  return {
    outfit: {
      ...remote,
      itemIds,
      alternatives: (remote.alternatives ?? []).filter((entry) => known.has(entry.itemId)),
      warnings,
    },
    source: 'ai',
  };
}

/* ------------------------------------------------------------- stylist -- */

export interface StylistResult {
  answer: string;
  referencedItemIds: string[];
  source: AiSource;
}

export async function askStylist(
  thread: StylistMessage[],
  closet: ClothingItem[],
  weatherSummary?: string,
): Promise<StylistResult> {
  if (!(await aiConfigured())) {
    return { ...localStylistAnswer(thread, closet), source: 'local' };
  }
  const remote = await postJson<{ answer: string; referencedItemIds: string[] }>(
    '/api/ai/stylist',
    {
      messages: thread.map((message) => ({ role: message.role, text: message.text })),
      closet: closetDigest(closet),
      weatherSummary,
    },
  );
  if (!remote) return { ...localStylistAnswer(thread, closet), source: 'local' };
  const known = new Set(closet.map((item) => item.id));
  return {
    answer: remote.answer,
    referencedItemIds: (remote.referencedItemIds ?? []).filter((id) => known.has(id)),
    source: 'ai',
  };
}

/**
 * Without a key the stylist still answers, by running the outfit engine and
 * narrating the result. It is narrower than the model but it is never wrong
 * about what is in the closet.
 */
function localStylistAnswer(
  thread: StylistMessage[],
  closet: ClothingItem[],
): { answer: string; referencedItemIds: string[] } {
  const question = thread.filter((message) => message.role === 'user').at(-1)?.text ?? '';
  if (!closet.length) {
    return {
      answer: 'Your closet is empty, so there is nothing for me to suggest yet. Add a few pieces and ask again.',
      referencedItemIds: [],
    };
  }
  const built = buildOutfitLocally({
    request: {
      prompt: question,
      includeItemIds: [],
      excludeItemIds: [],
      cleanOnly: true,
    },
    closet,
  });
  const names = closet
    .filter((item) => built.itemIds.includes(item.id))
    .map((item) => item.name)
    .join(', ');
  return {
    answer:
      `Working from what is clean right now: ${names}. ${built.explanation} ${built.colorNotes}\n\n` +
      'This is the built-in engine — add an Anthropic API key on the server for answers that read your question properly.',
    referencedItemIds: built.itemIds,
  };
}

/* ------------------------------------------------------------- packing -- */

export interface PackingResult {
  summary: string;
  itemIds: string[];
  dayPlans: { day: number; label: string; itemIds: string[] }[];
  notes: string;
  source: AiSource;
}

export async function planPacking(
  request: PackingRequest,
  closet: ClothingItem[],
): Promise<PackingResult> {
  const local = (): PackingResult => ({ ...buildPackingLocally(request, closet), source: 'local' });
  if (!(await aiConfigured())) return local();

  const remote = await postJson<Omit<PackingResult, 'source'>>('/api/ai/packing', {
    request,
    closet: closetDigest(closet),
  });
  if (!remote) return local();

  const known = new Set(closet.map((item) => item.id));
  const itemIds = remote.itemIds.filter((id) => known.has(id));
  if (!itemIds.length) return local();

  return {
    ...remote,
    itemIds,
    dayPlans: (remote.dayPlans ?? []).map((plan) => ({
      ...plan,
      itemIds: plan.itemIds.filter((id) => known.has(id)),
    })),
    source: 'ai',
  };
}

/* ------------------------------------------------------------ wishlist -- */

export interface WishlistSuggestion {
  name: string;
  category: ClothingItem['category'];
  colorName: string;
  reason: string;
}

export async function suggestWishlist(
  closet: ClothingItem[],
  goal?: string,
): Promise<WishlistSuggestion[] | null> {
  if (!(await aiConfigured())) return null;
  const remote = await postJson<{ suggestions: WishlistSuggestion[] }>('/api/ai/wishlist', {
    closet: closetDigest(closet),
    goal,
  });
  return remote?.suggestions ?? null;
}
