'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';

import { formatRelative } from '@/lib/date';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import type { ClothingItem, Outfit } from '@/types';

import { OutfitThumb } from './OutfitStack';

export function OutfitCard({
  outfit,
  items,
  className,
}: {
  outfit: Outfit;
  items: ClothingItem[];
  className?: string;
}) {
  return (
    <Link
      href={`/outfits/${outfit.id}`}
      className={cn('card pressable flex items-center gap-3.5 overflow-hidden p-3', className)}
    >
      <OutfitThumb items={items} className="size-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{outfit.name}</p>
          {outfit.favorite ? (
            <Heart size={14} className="shrink-0 text-[var(--brand)]" fill="currentColor" />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[0.8125rem] text-[var(--text-muted)]">
          {outfit.occasion ?? `${pluralize(items.length, 'piece')}`}
        </p>
        <p className="mt-1 text-[0.75rem] text-[var(--text-faint)]">
          {outfit.timesWorn > 0
            ? `Worn ${pluralize(outfit.timesWorn, 'time')} · last ${formatRelative(outfit.lastWornAt).toLowerCase()}`
            : 'Never worn'}
        </p>
      </div>
    </Link>
  );
}

/** Horizontal card for the home screen rows. */
export function OutfitPill({
  outfit,
  items,
}: {
  outfit: Outfit;
  items: ClothingItem[];
}) {
  return (
    <Link href={`/outfits/${outfit.id}`} className="pressable w-36 shrink-0">
      <OutfitThumb items={items} className="aspect-square w-full rounded-[var(--radius-tile)]" />
      <p className="mt-2 truncate px-0.5 text-[0.8125rem] font-medium">{outfit.name}</p>
      <p className="truncate px-0.5 text-[0.75rem] text-[var(--text-muted)]">
        {outfit.occasion ?? pluralize(items.length, 'piece')}
      </p>
    </Link>
  );
}
