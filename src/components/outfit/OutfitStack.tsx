'use client';

import {
  ACCESSORY_POSITION_LABEL,
  ACCESSORY_POSITION_ORDER,
  SLOT_LABEL,
  SLOT_ORDER,
  accessoryPosition,
  slotOf,
} from '@/domain/taxonomy';
import { cn } from '@/lib/cn';
import type { ClothingItem, Slot } from '@/types';

import { ItemImage } from '@/components/closet/ItemImage';

/**
 * The outfit preview: pieces stacked head-to-toe in the order you would put
 * them on. Accessories collapse into a single row at the bottom, because five
 * equal-sized cards for a watch and a belt reads as five garments.
 */
export function OutfitStack({
  items,
  onSelect,
  className,
}: {
  items: ClothingItem[];
  onSelect?: (item: ClothingItem) => void;
  className?: string;
}) {
  const bySlot = new Map<Slot, ClothingItem[]>();
  items.forEach((item) => {
    const slot = slotOf(item.category);
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), item]);
  });

  const garmentSlots = SLOT_ORDER.filter((slot) => slot !== 'accessory');
  const accessories = bySlot.get('accessory') ?? [];

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {garmentSlots.map((slot) => {
        const slotItems = bySlot.get(slot);
        if (!slotItems?.length) return null;
        return slotItems.map((item) => (
          <Row key={item.id} item={item} label={SLOT_LABEL[slot]} onSelect={onSelect} />
        ));
      })}

      {accessories.length ? (
        <div className="tile flex items-center gap-3 p-3">
          <span className="text-label w-16 shrink-0 text-[var(--text-faint)]">
            {SLOT_LABEL.accessory}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {[...accessories]
              .sort(
                (a, b) =>
                  ACCESSORY_POSITION_ORDER.indexOf(accessoryPosition(a.category)) -
                  ACCESSORY_POSITION_ORDER.indexOf(accessoryPosition(b.category)),
              )
              .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item)}
                title={ACCESSORY_POSITION_LABEL[accessoryPosition(item.category)]}
                className="pressable flex items-center gap-2 rounded-xl bg-[var(--surface-alt)] py-1 pr-3 pl-1"
              >
                <span className="size-8 overflow-hidden rounded-lg">
                  <ItemImage item={item} className="size-full" showLabel={false} />
                </span>
                <span className="max-w-[8rem] truncate text-[0.8125rem]">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  item,
  label,
  onSelect,
}: {
  item: ClothingItem;
  label: string;
  onSelect?: (item: ClothingItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      className="tile pressable flex w-full items-center gap-3 p-3 text-left"
    >
      <span className="text-label w-16 shrink-0 text-[var(--text-faint)]">{label}</span>
      <span
        className={cn(
          'size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-alt)]',
          item.cutoutId && 'alpha-grid',
        )}
      >
        <ItemImage item={item} className="size-full" fit={item.cutoutId ? 'contain' : 'cover'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium">{item.name}</span>
        <span className="block truncate text-[0.8125rem] text-[var(--text-muted)]">
          {[item.primaryColor, item.material, item.brand].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );
}

/** A four-up collage used on outfit cards and calendar days. */
export function OutfitThumb({
  items,
  className,
}: {
  items: ClothingItem[];
  className?: string;
}) {
  const shown = items.slice(0, 4);
  if (!shown.length) {
    return <div className={cn('bg-[var(--surface-alt)]', className)} />;
  }
  return (
    <div className={cn('grid gap-px overflow-hidden bg-[var(--border)]', className)}
      style={{
        gridTemplateColumns: shown.length === 1 ? '1fr' : '1fr 1fr',
        gridTemplateRows: shown.length <= 2 ? '1fr' : '1fr 1fr',
      }}
    >
      {shown.map((item) => (
        <div key={item.id} className="min-h-0 min-w-0 bg-[var(--surface-alt)]">
          <ItemImage item={item} className="size-full" showLabel={false} />
        </div>
      ))}
    </div>
  );
}
