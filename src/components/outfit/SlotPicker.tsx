'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ItemImage } from '@/components/closet/ItemImage';
import {
  ACCESSORY_POSITION_LABEL,
  SLOT_LABEL,
  accessoryPosition,
  slotOf,
} from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import type { ClothingItem } from '@/types';

/**
 * One row per piece, with a way to change just that piece.
 *
 * The collage is the picture; this is the controls. Arrows because a swipe is
 * invisible until somebody discovers it, and because a mouse has no swipe —
 * the same action, reachable both ways, with tap targets big enough to hit.
 */
/** "Accessories" tells her nothing when three of them are on screen. */
function labelFor(item: ClothingItem): string {
  const slot = slotOf(item.category);
  return slot === 'accessory'
    ? ACCESSORY_POSITION_LABEL[accessoryPosition(item.category)]
    : SLOT_LABEL[slot];
}

export function SlotPicker({
  items,
  onCycle,
  optionCounts,
  className,
}: {
  items: ClothingItem[];
  onCycle: (item: ClothingItem, direction: 1 | -1) => void;
  /** How many garments could fill each slot, so a lone option reads as fixed. */
  optionCounts?: Record<string, number>;
  className?: string;
}) {
  return (
    <ul className={cn('divide-y divide-[var(--border)]', className)}>
      {items.map((item) => {
        const options = optionCounts?.[item.id] ?? 2;
        const fixed = options < 2;

        return (
          <li key={item.id} className="flex items-center gap-2.5 py-2">
            <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]">
              <ItemImage item={item} className="size-full" showLabel={false} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="text-label block text-[var(--text-faint)]">{labelFor(item)}</span>
              <span className="block truncate text-[0.875rem] font-medium">{item.name}</span>
            </span>

            {fixed ? (
              <span className="shrink-0 pr-1 text-[0.75rem] text-[var(--text-faint)]">
                only one
              </span>
            ) : (
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-label={`Previous ${labelFor(item).toLowerCase()}`}
                  onClick={() => onCycle(item, -1)}
                  className="pressable grid size-11 place-items-center rounded-full text-[var(--text-muted)]"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label={`Next ${labelFor(item).toLowerCase()}`}
                  onClick={() => onCycle(item, 1)}
                  className="pressable grid size-11 place-items-center rounded-full text-[var(--text-muted)]"
                >
                  <ChevronRight size={18} />
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
