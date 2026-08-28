'use client';

import { CalendarHeart, Clock, Repeat, Sparkle, Tag } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ItemImage } from '@/components/closet/ItemImage';
import { findMemories, type MemoryKind } from '@/domain/memories';
import { cn } from '@/lib/cn';
import { useActiveItems, useResolvedItems } from '@/store/closet';
import { useOutfits } from '@/store/outfits';

const ICONS: Record<MemoryKind, typeof Clock> = {
  anniversary: CalendarHeart,
  'last-month': Clock,
  forgotten: Sparkle,
  'on-repeat': Repeat,
  'never-worn': Tag,
};

/**
 * The payoff for logging what you wore.
 *
 * One memory at a time, strongest first — a wall of them would read as a
 * dashboard, and the point is that it feels like the app noticed something.
 */
export function MemoryCard({ className }: { className?: string }) {
  const items = useActiveItems();
  const { outfits, wearLogs } = useOutfits();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const memories = useMemo(
    () => findMemories(items, outfits, wearLogs),
    [items, outfits, wearLogs],
  );

  const memory = memories.find((entry) => !dismissed.includes(entry.title));
  const shown = useResolvedItems(memory?.itemIds);

  if (!memory) return null;
  const Icon = ICONS[memory.kind];

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold">{memory.title}</h2>
          <p className="mt-0.5 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
            {memory.body}
          </p>
        </div>
      </div>

      {shown.length ? (
        <div className="mt-3 flex gap-2">
          {shown.slice(0, 5).map((item) => (
            <span
              key={item.id}
              className="size-12 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-alt)]"
            >
              <ItemImage item={item} className="size-full" showLabel={false} />
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <section className={cn('card p-4', className)}>
      {memory.outfitId ? (
        <Link href={`/outfits/${memory.outfitId}`} className="pressable block">
          {body}
        </Link>
      ) : shown.length === 1 ? (
        <Link href={`/closet/${shown[0].id}`} className="pressable block">
          {body}
        </Link>
      ) : (
        body
      )}

      <button
        type="button"
        onClick={() => setDismissed((current) => [...current, memory.title])}
        className="pressable -mb-1 mt-1.5 px-1.5 py-3 text-[0.8125rem] text-[var(--text-faint)]"
      >
        Show me something else
      </button>
    </section>
  );
}
