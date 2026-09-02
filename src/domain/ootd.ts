import type { ClothingItem } from '@/types';

/**
 * Today's pick, held still.
 *
 * The home screen rebuilt its suggestion from scratch on every render whose
 * inputs had moved, and the weather is one of those inputs — so an outfit could
 * quietly become a different outfit between breakfast and the front door. That
 * is a fine behaviour for a suggestion and a wrong one for something called the
 * Outfit of the Day: a thing with a name is a thing you can decide about, come
 * back to, and screenshot, and none of that survives it changing underneath you.
 *
 * So the day's pick is written down, and it is fed back into the engine as
 * pieces to include rather than laid over the top of it. That matters: the
 * name, the explanation and the colour notes are then all derived from the
 * outfit actually on screen, instead of describing whatever the engine would
 * have chosen a second ago.
 */
export interface PinnedOutfit {
  /** YYYY-MM-DD, local. */
  date: string;
  itemIds: string[];
}

/**
 * Whether a written-down pick can still be worn.
 *
 * A pin goes stale in more ways than by being yesterday's: a piece can be
 * archived, deleted, or thrown in the wash overnight. Any of those and the pin
 * is dropped and the day is picked again, because half an outfit is worse than
 * a fresh one.
 */
export function pinIsUsable(
  pin: PinnedOutfit | undefined,
  today: string,
  wearable: ClothingItem[],
): boolean {
  if (!pin || pin.date !== today) return false;
  if (pin.itemIds.length < 2) return false;
  const available = new Set(wearable.map((item) => item.id));
  return pin.itemIds.every((id) => available.has(id));
}

/** Whether what is on screen is already what is written down. */
export function pinMatches(pin: PinnedOutfit | undefined, today: string, itemIds: string[]): boolean {
  if (!pin || pin.date !== today) return false;
  if (pin.itemIds.length !== itemIds.length) return false;
  return pin.itemIds.every((id, index) => id === itemIds[index]);
}
